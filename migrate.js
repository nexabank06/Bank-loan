// migrate.js - apply migrations. If a `migrations/` folder exists, apply files there
// otherwise run the fallback SQL to create core tables.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./db');

const migrationsDir = path.join(__dirname, 'migrations');

const fallbackSql = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  role TEXT DEFAULT 'user',
  phone TEXT,
  dob DATE,
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP,
  email_verified BOOLEAN DEFAULT false,
  email_verified_at TIMESTAMP,
  totp_secret TEXT,
  totp_enabled BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS email_verifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  otp TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS password_resets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS loan_applications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  loan_type TEXT NOT NULL,
  amount_requested DECIMAL(12,2),
  tenure_months INT,
  purpose TEXT,
  status TEXT DEFAULT 'submitted',
  eligibility_score INT,
  documents_uploaded TEXT,
  admin_notes TEXT,
  approved_amount DECIMAL(12,2),
  approved_rate DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS loan_disbursements (
  id SERIAL PRIMARY KEY,
  application_id INTEGER NOT NULL,
  amount DECIMAL(12,2),
  disbursed_at TIMESTAMP,
  account_number TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES loan_applications(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS emi_schedules (
  id SERIAL PRIMARY KEY,
  application_id INTEGER NOT NULL,
  emi_number INT,
  due_date DATE,
  amount DECIMAL(10,2),
  principal DECIMAL(10,2),
  interest DECIMAL(10,2),
  status TEXT DEFAULT 'pending',
  paid_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES loan_applications(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id SERIAL PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone TEXT,
  message TEXT,
  status TEXT DEFAULT 'unread',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS login_activity (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  email TEXT,
  ip_address TEXT,
  action TEXT,
  status TEXT,
  when_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER,
  action TEXT,
  table_name TEXT,
  record_id INTEGER,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL
);
`;

async function ensureMigrationsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
  `);
}

async function appliedMigrations() {
  const r = await db.query('SELECT filename FROM schema_migrations');
  return new Set((r.rows || []).map(r => r.filename));
}

async function applyMigration(filename, sql) {
  console.log('Applying', filename);
  await db.pool.query(sql);
  await db.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
}

async function run() {
  try {
    if (fs.existsSync(migrationsDir)) {
      await ensureMigrationsTable();
      const applied = await appliedMigrations();
      const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
      for (const f of files) {
        if (applied.has(f)) {
          console.log('Skipping already applied:', f);
          continue;
        }
        const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
        await applyMigration(f, sql);
      }
      console.log('All migrations applied from migrations/');
    } else {
      console.log('No migrations/ folder found — running fallback SQL');
      await db.pool.query(fallbackSql);
      console.log('Fallback migrations applied');
    }
  } catch (err) {
    console.error('Migration failed:', err && err.message);
    process.exitCode = 1;
  } finally {
    try { await db.pool.end(); } catch (e) {}
  }
}

run();
