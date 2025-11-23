// 2FA TOTP and audit logging routes
const express = require('express');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Generate 2FA secret and QR code
router.post('/2fa/setup', requireAuth, async (req, res, next) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `Nexa Bank (${req.user.email})`,
      issuer: 'Nexa Bank',
      length: 32,
    });

    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    res.json({
      ok: true,
      secret: secret.base32,
      qrCode,
      message: 'Scan QR code with authenticator app',
    });
  } catch (err) { next(err); }
});

// Enable 2FA
router.post('/2fa/enable', requireAuth, async (req, res, next) => {
  try {
    const { secret, token } = req.body || {};
    if (!secret || !token) {
      return res.status(400).json({ ok: false, error: 'Secret and token required' });
    }

    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!verified) {
      return res.status(401).json({ ok: false, error: 'Invalid token' });
    }

    await db.query(
      'UPDATE users SET totp_secret = $1, totp_enabled = true WHERE id = $2',
      [secret, req.user.id]
    );

    res.json({ ok: true, message: '2FA enabled successfully' });
  } catch (err) { next(err); }
});

// Disable 2FA
router.post('/2fa/disable', requireAuth, async (req, res, next) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ ok: false, error: 'Token required' });

    const user = await db.query(
      'SELECT totp_secret FROM users WHERE id = $1',
      [req.user.id]
    );

    if (!user.rows || !user.rows[0] || !user.rows[0].totp_secret) {
      return res.status(400).json({ ok: false, error: '2FA not enabled' });
    }

    const verified = speakeasy.totp.verify({
      secret: user.rows[0].totp_secret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!verified) return res.status(401).json({ ok: false, error: 'Invalid token' });

    await db.query(
      'UPDATE users SET totp_secret = NULL, totp_enabled = false WHERE id = $1',
      [req.user.id]
    );

    res.json({ ok: true, message: '2FA disabled successfully' });
  } catch (err) { next(err); }
});

// Verify 2FA token during login
async function verify2FA(userId, token) {
  const user = await db.query(
    'SELECT totp_secret FROM users WHERE id = $1 AND totp_enabled = true',
    [userId]
  );

  if (!user.rows || !user.rows[0]) return true; // 2FA not enabled

  const verified = speakeasy.totp.verify({
    secret: user.rows[0].totp_secret,
    encoding: 'base32',
    token,
    window: 2,
  });

  return verified;
}

// Log action in audit trail
async function logAuditAction(adminId, action, tableName, recordId, oldValues, newValues, ipAddress) {
  try {
    await db.query(
      'INSERT INTO audit_logs (admin_id, action, table_name, record_id, old_values, new_values, ip_address) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [adminId, action, tableName, recordId, JSON.stringify(oldValues), JSON.stringify(newValues), ipAddress]
    );
  } catch (err) {
    console.warn('Failed to log audit action:', err.message);
  }
}

// Get audit logs (admin only)
router.get('/audit-logs', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ ok: false, error: 'Unauthorized' });

    const { limit = 100, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    const result = await db.query(
      'SELECT al.id, al.admin_id, al.action, al.table_name, al.record_id, al.ip_address, al.created_at, u.first_name FROM audit_logs al LEFT JOIN users u ON al.admin_id = u.id ORDER BY al.created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    res.json({ ok: true, logs: result.rows || [] });
  } catch (err) { next(err); }
});

module.exports = { router, verify2FA, logAuditAction };
