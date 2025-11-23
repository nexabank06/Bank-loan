const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'please-set-a-secret';
const COOKIE_NAME = process.env.COOKIE_NAME || 'nexa_token';

async function requireAuth(req, res, next) {
  try {
    // Accept token from cookie OR Authorization: Bearer <token>
    let token = null;
    if (req.cookies && req.cookies[COOKIE_NAME]) token = req.cookies[COOKIE_NAME];
    const authHeader = req.headers && (req.headers.authorization || req.headers.Authorization);
    if (!token && authHeader && typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
      token = authHeader.slice(7).trim();
    }

    if (!token) return res.status(401).json({ ok: false, error: 'Not authenticated' });

    const payload = jwt.verify(token, JWT_SECRET);
    // Support tokens issued for a seeded admin (no DB lookup) — tokens created with
    // payload { role: 'admin', admin: true, email: '...' } will be accepted.
    if (payload && payload.role === 'admin' && payload.admin) {
      req.user = { id: 'admin', email: payload.email || process.env.ADMIN_EMAIL || 'admin@nexa.bank', first_name: 'Admin', role: 'admin' };
      return next();
    }

    // payload may come from different implementations: { userId } or { id } or { sub }
    const userId = payload.userId || payload.id || payload.sub || null;
    if (!userId) return res.status(401).json({ ok: false, error: 'Invalid token payload' });

    // attach minimal user info from DB
    const r = await db.query('SELECT id, email, first_name, last_name, role FROM users WHERE id = $1', [userId]);
    const user = r.rows && r.rows[0];
    if (!user) return res.status(401).json({ ok: false, error: 'User not found' });

    req.user = user;
    next();
  } catch (err) {
    console.warn('auth error', err && (err.message || err));
    return res.status(401).json({ ok: false, error: 'Invalid token' });
  }
}

async function requireAdmin(req, res, next) {
  // Reuse requireAuth to validate/authenticate first
  await requireAuth(req, res, async () => {
    if (!req.user || req.user.role !== 'admin') return res.status(403).json({ ok: false, error: 'Admin access required' });
    next();
  });
}

module.exports = { requireAuth, requireAdmin };
