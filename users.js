// Contact and notifications routes
const express = require('express');
const db = require('../db');
const { sendEmail } = require('../helpers/email');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Submit contact form (public)
router.post('/contact', async (req, res, next) => {
  try {
    const { name, email, phone, message } = req.body || {};
    if (!name || !email || !message) {
      return res.status(400).json({ ok: false, error: 'Name, email, and message required' });
    }

    await db.query(
      'INSERT INTO contact_messages (name, email, phone, message) VALUES ($1, $2, $3, $4)',
      [name, email, phone || null, message]
    );

    // Send email to admin
    try {
      await sendEmail({
        to: process.env.ADMIN_EMAIL || 'admin@nexabank.com',
        subject: `New Contact: ${name}`,
        html: `<h3>New Contact Message</h3><p><strong>From:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Phone:</strong> ${phone || 'N/A'}</p><p><strong>Message:</strong></p><p>${message}</p>`,
      });
    } catch (e) {
      console.warn('Failed to send admin notification:', e.message);
    }

    res.json({ ok: true, message: 'Message sent successfully' });
  } catch (err) { next(err); }
});

// Get user's profile
router.get('/profile', requireAuth, async (req, res, next) => {
  try {
    const user = await db.query(
      'SELECT id, first_name, last_name, email, phone, address, role, email_verified, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (!user.rows || !user.rows[0]) return res.status(404).json({ ok: false, error: 'User not found' });

    res.json({ ok: true, user: user.rows[0] });
  } catch (err) { next(err); }
});

// Update user profile
router.put('/profile', requireAuth, async (req, res, next) => {
  try {
    const { first_name, last_name, phone, address } = req.body || {};

    const result = await db.query(
      'UPDATE users SET first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name), phone = COALESCE($3, phone), address = COALESCE($4, address) WHERE id = $5 RETURNING id, first_name, last_name, email, phone, address, role',
      [first_name, last_name, phone, address, req.user.id]
    );

    if (!result.rows || !result.rows[0]) return res.status(404).json({ ok: false, error: 'User not found' });

    res.json({ ok: true, user: result.rows[0] });
  } catch (err) { next(err); }
});

// Admin: Get all contact messages
router.get('/admin/contact-messages', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ ok: false, error: 'Unauthorized' });

    const result = await db.query(
      'SELECT id, name, email, phone, message, status, created_at FROM contact_messages ORDER BY created_at DESC LIMIT 100'
    );

    res.json({ ok: true, messages: result.rows || [] });
  } catch (err) { next(err); }
});

// Admin: Mark contact message as read
router.put('/admin/contact-messages/:id', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ ok: false, error: 'Unauthorized' });

    const { status } = req.body || {};

    const result = await db.query(
      'UPDATE contact_messages SET status = $1 WHERE id = $2 RETURNING *',
      [status || 'read', req.params.id]
    );

    res.json({ ok: true, message: result.rows[0] });
  } catch (err) { next(err); }
});

// Get eligibility score
router.post('/eligibility-check', async (req, res, next) => {
  try {
    const { age, income, employment_status, existing_loans, defaults } = req.body || {};

    let score = 0;
    const factors = {};

    if (age >= 21 && age <= 60) { score += 20; factors.age = true; }
    if (income > 300000) { score += 25; factors.income = true; }
    if (employment_status === 'employed') { score += 20; factors.employment = true; }
    if (!existing_loans || existing_loans === 0) { score += 20; factors.no_loans = true; }
    if (!defaults || defaults === false) { score += 15; factors.no_defaults = true; }

    const eligible = score >= 60;
    const message = eligible ? 'You may be eligible for a loan' : 'You need to improve some factors to be eligible';

    res.json({
      ok: true,
      score: Math.min(score, 100),
      eligible,
      message,
      factors,
    });
  } catch (err) { next(err); }
});

module.exports = router;
