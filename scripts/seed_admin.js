require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../db');

// Support either SEED_ADMIN_* or ADMIN_* env var names
const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'nexabank06@gmail.com').toLowerCase();
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASS || process.env.ADMIN_PASSWORD || 'Nexa@123';
const FIRST_NAME = process.env.SEED_ADMIN_FIRST_NAME || process.env.ADMIN_FIRST_NAME || 'Nexa';
const LAST_NAME = process.env.SEED_ADMIN_LAST_NAME || process.env.ADMIN_LAST_NAME || 'Bank';

console.log('Admin credentials are managed via environment variables only. No admin user is seeded in the database.');
