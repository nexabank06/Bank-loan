const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { verify2FA, logAuditAction } = require('./security');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'please-set-a-secret';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';
const COOKIE_NAME = process.env.COOKIE_NAME || 'nexa_token';

// Optional seeded admin credentials (no DB lookup). Configure via .env:
// ADMIN_EMAIL and ADMIN_PASSWORD. If not set, defaults are used for local dev.
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@nexa.bank').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminPass123!';

function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function cookieOptions() {
  const secure = process.env.NODE_ENV === 'production';
  const sameSiteEnv = (process.env.COOKIE_SAMESITE || 'lax').toString().toLowerCase();
  const sameSite = ['lax', 'strict', 'none'].includes(sameSiteEnv) ? sameSiteEnv : 'lax';
  if (sameSite === 'none' && !secure) console.warn('COOKIE_SAMESITE=None set while not running in production+HTTPS');
  return { httpOnly: true, secure, sameSite, maxAge: 7 * 24 * 3600 * 1000 };
}

// Register
// Register (now saves DOB)
router.post('/register', async (req, res, next) => {
  try {
    const { first_name, last_name, email, password, phone, dob } = req.body || {};
    if (!first_name || !email || !password || !dob) return res.status(400).json({ ok: false, error: 'Missing fields' });

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows && existing.rows.length) return res.status(409).json({ ok: false, error: 'Email already registered' });

    const password_hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, phone, dob)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, email, first_name, last_name, role, dob, phone`,
      [first_name, last_name || null, email.toLowerCase(), password_hash, phone || null, dob]
    );

    const user = result.rows[0];
    const token = createToken({ userId: user.id, role: user.role });

    res.cookie(COOKIE_NAME, token, cookieOptions());
    res.json({ ok: true, user: { id: user.id, email: user.email, first_name: user.first_name, role: user.role, dob: user.dob, phone: user.phone } });
  } catch (err) { next(err); }
});

// Login (with optional 2FA)
router.post('/login', async (req, res, next) => {
  try {
    const { email, password, totp_token } = req.body || {};
    if (!email || !password) return res.status(400).json({ ok: false, error: 'Missing fields' });

    // Shortcut: if credentials match the seeded admin (configured via env),
    // skip DB lookup and issue an admin token.
    if (email.toLowerCase() === ADMIN_EMAIL) {
      if (password !== ADMIN_PASSWORD) return res.status(401).json({ ok: false, error: 'Invalid credentials' });
      const token = createToken({ role: 'admin', admin: true, email: ADMIN_EMAIL });
      res.cookie(COOKIE_NAME, token, cookieOptions());
      return res.json({ ok: true, user: { id: 'admin', email: ADMIN_EMAIL, first_name: 'Admin', role: 'admin' } });
    }

    const result = await db.query('SELECT id, password_hash, first_name, last_name, email, role, phone, totp_enabled FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = result.rows && result.rows[0];
    if (!user) return res.status(401).json({ ok: false, error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password_hash || '');
    if (!ok) return res.status(401).json({ ok: false, error: 'Invalid credentials' });

    // Check 2FA if enabled
    if (user.totp_enabled) {
      if (!totp_token) return res.status(403).json({ ok: false, error: '2FA token required', needs2FA: true });
      const verified = await verify2FA(user.id, totp_token);
      if (!verified) return res.status(401).json({ ok: false, error: 'Invalid 2FA token' });
    }

    const token = createToken({ userId: user.id, role: user.role });
    res.cookie(COOKIE_NAME, token, cookieOptions());

    try {
      await db.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
      await logAuditAction(user.id, 'LOGIN', 'users', user.id, {}, {}, req.ip);
    } catch (e) { console.warn('failed to update last_login_at or audit log', e); }

    res.json({ ok: true, user: { id: user.id, email: user.email, first_name: user.first_name, role: user.role, phone: user.phone || null } });
  } catch (err) { next(err); }
});

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { httpOnly: true });
  res.json({ ok: true });
});

module.exports = router;
