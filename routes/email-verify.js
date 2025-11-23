// Email verification and password reset routes
const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { sendEmail } = require('../helpers/email');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP to email
router.post('/send-otp', async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ ok: false, error: 'Email required' });

    // Find user or create pending verification
    const user = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    const userId = user.rows && user.rows[0] ? user.rows[0].id : null;
    
    if (!userId) return res.status(404).json({ ok: false, error: 'User not found' });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db.query(
      'DELETE FROM email_verifications WHERE user_id = $1',
      [userId]
    );

    await db.query(
      'INSERT INTO email_verifications (user_id, email, otp, expires_at) VALUES ($1, $2, $3, $4)',
      [userId, email.toLowerCase(), otp, expiresAt]
    );

    await sendEmail({
      to: email,
      subject: 'Nexa Bank - Email Verification OTP',
      html: `<h2>Email Verification</h2><p>Your OTP is: <strong>${otp}</strong></p><p>Valid for 10 minutes.</p>`
    });

    res.json({ ok: true, message: 'OTP sent to email' });
  } catch (err) { next(err); }
});

// Verify OTP
router.post('/verify-otp', async (req, res, next) => {
  try {
    const { email, otp } = req.body || {};
    if (!email || !otp) return res.status(400).json({ ok: false, error: 'Email and OTP required' });

    const verification = await db.query(
      'SELECT id, user_id, expires_at FROM email_verifications WHERE email = $1 AND otp = $2',
      [email.toLowerCase(), otp]
    );

    const record = verification.rows && verification.rows[0];
    if (!record) return res.status(401).json({ ok: false, error: 'Invalid OTP' });

    if (new Date() > new Date(record.expires_at)) {
      return res.status(401).json({ ok: false, error: 'OTP expired' });
    }

    await db.query('UPDATE users SET email_verified = true, email_verified_at = now() WHERE id = $1', [record.user_id]);
    await db.query('DELETE FROM email_verifications WHERE id = $1', [record.id]);

    res.json({ ok: true, message: 'Email verified successfully' });
  } catch (err) { next(err); }
});

// Request password reset
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ ok: false, error: 'Email required' });

    const user = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (!user.rows || !user.rows[0]) {
      // Don't reveal if email exists
      return res.json({ ok: true, message: 'If email exists, reset link sent' });
    }

    const userId = user.rows[0].id;
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.query(
      'DELETE FROM password_resets WHERE user_id = $1',
      [userId]
    );

    await db.query(
      'INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [userId, token, expiresAt]
    );

    const resetLink = `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`;

    await sendEmail({
      to: email,
      subject: 'Nexa Bank - Password Reset',
      html: `<h2>Password Reset</h2><p><a href="${resetLink}">Click here to reset your password</a></p><p>Valid for 1 hour.</p>`
    });

    res.json({ ok: true, message: 'If email exists, reset link sent' });
  } catch (err) { next(err); }
});

// Reset password with token
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ ok: false, error: 'Token and password required' });

    if (password.length < 8) return res.status(400).json({ ok: false, error: 'Password must be at least 8 characters' });

    const reset = await db.query(
      'SELECT user_id, expires_at FROM password_resets WHERE token = $1',
      [token]
    );

    const record = reset.rows && reset.rows[0];
    if (!record) return res.status(401).json({ ok: false, error: 'Invalid or expired token' });

    if (new Date() > new Date(record.expires_at)) {
      return res.status(401).json({ ok: false, error: 'Token expired' });
    }

    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash(password, 10);

    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, record.user_id]);
    await db.query('DELETE FROM password_resets WHERE token = $1', [token]);

    res.json({ ok: true, message: 'Password reset successfully' });
  } catch (err) { next(err); }
});

module.exports = router;
