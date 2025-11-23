require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../db');

// Support either SEED_ADMIN_* or ADMIN_* env var names
const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'nexa.bank06@gmail.com').toLowerCase();
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASS || process.env.ADMIN_PASSWORD || 'Nexa@123';
const FIRST_NAME = process.env.SEED_ADMIN_FIRST_NAME || process.env.ADMIN_FIRST_NAME || 'Nexa';
const LAST_NAME = process.env.SEED_ADMIN_LAST_NAME || process.env.ADMIN_LAST_NAME || 'Bank';

async function run() {
  try {
    const r = await db.query("SELECT id FROM users WHERE email = $1", [ADMIN_EMAIL]);
    if (r.rows && r.rows.length) {
      console.log('Admin already exists. Updating password to provided value.');
      const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await db.query('UPDATE users SET password_hash = $1, role = $2 WHERE email = $3', [hash, 'admin', ADMIN_EMAIL]);
      console.log('Admin password updated.');
      return;
    }

    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const inserted = await db.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, role) VALUES ($1,$2,$3,$4,'admin') RETURNING id, email`,
      [FIRST_NAME, LAST_NAME, ADMIN_EMAIL, hash]
    );
    console.log('Admin user created:', inserted.rows[0]);
  } catch (err) {
    console.error('Failed to seed admin:', err && err.message);
    process.exitCode = 1;
  } finally {
    try { await db.pool.end(); } catch (e) {}
  }
}

run();
