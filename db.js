require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/nexa_db';
const pool = new Pool({
  connectionString,
  ssl: (process.env.NODE_ENV === 'production') ? { rejectUnauthorized: false } : false,
});

if (process.env.NODE_ENV === 'production') {
  console.log('DB: Using production SSL configuration for Postgres connection');
} else {
  console.log('DB: Running in development mode; SSL for Postgres is disabled');
}

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query };
