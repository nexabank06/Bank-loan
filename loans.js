// Loan application routes
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Calculate eligibility score
function calculateEligibility(data) {
  let score = 0;
  const { age, income, employment_status, existing_loans, defaults } = data;

  if (age >= 21 && age <= 60) score += 20;
  if (income > 300000) score += 25;
  if (employment_status === 'employed') score += 20;
  if (!existing_loans || existing_loans === 0) score += 20;
  if (!defaults || defaults === false) score += 15;

  return Math.min(score, 100);
}

// Create loan application
router.post('/applications', requireAuth, async (req, res, next) => {
  try {
    const { loan_type, amount_requested, tenure_months, purpose, age, income, employment_status } = req.body || {};
    
    if (!loan_type || !amount_requested || !tenure_months || !purpose) {
      return res.status(400).json({ ok: false, error: 'Missing required fields' });
    }

    const eligibility_score = calculateEligibility({ age, income, employment_status });

    const result = await db.query(
      `INSERT INTO loan_applications (user_id, loan_type, amount_requested, tenure_months, purpose, eligibility_score)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, status, eligibility_score`,
      [req.user.id, loan_type, amount_requested, tenure_months, purpose, eligibility_score]
    );

    res.json({ ok: true, application: result.rows[0] });
  } catch (err) { next(err); }
});

// Get user's loan applications
router.get('/applications', requireAuth, async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, loan_type, amount_requested, tenure_months, purpose, status, eligibility_score, created_at FROM loan_applications WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );

    res.json({ ok: true, applications: result.rows || [] });
  } catch (err) { next(err); }
});

// Get user's loans (compatibility: /api/loans)
router.get('/loans', requireAuth, async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, loan_type, amount_requested, tenure_months, status, eligibility_score, created_at, approved_amount, approved_rate FROM loan_applications WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ ok: true, loans: result.rows || [] });
  } catch (err) { next(err); }
});

// Get application details
router.get('/applications/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM loan_applications WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (!result.rows || !result.rows[0]) return res.status(404).json({ ok: false, error: 'Application not found' });

    res.json({ ok: true, application: result.rows[0] });
  } catch (err) { next(err); }
});

// Admin: Get all applications
router.get('/admin/applications', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ ok: false, error: 'Unauthorized' });

    const { status, page = 1, limit = 20 } = req.query || {};
    const offset = (page - 1) * limit;

    let query = 'SELECT la.id, la.user_id, la.loan_type, la.amount_requested, la.status, la.eligibility_score, la.created_at, u.first_name, u.email FROM loan_applications la JOIN users u ON la.user_id = u.id';
    const params = [];

    if (status) {
      query += ' WHERE la.status = $1';
      params.push(status);
    }

    query += ' ORDER BY la.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await db.query(query, params);
    res.json({ ok: true, applications: result.rows || [] });
  } catch (err) { next(err); }
});

// Alias for frontend helper: /api/applications/admin
router.get('/applications/admin', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ ok: false, error: 'Unauthorized' });

    const { status, page = 1, limit = 20 } = req.query || {};
    const offset = (page - 1) * limit;

    let query = 'SELECT la.id, la.user_id, la.loan_type, la.amount_requested, la.status, la.eligibility_score, la.created_at, u.first_name, u.email FROM loan_applications la JOIN users u ON la.user_id = u.id';
    const params = [];

    if (status) {
      query += ' WHERE la.status = $1';
      params.push(status);
    }

    query += ' ORDER BY la.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await db.query(query, params);
    res.json({ ok: true, applications: result.rows || [] });
  } catch (err) { next(err); }
});

// Admin: Approve loan application
router.patch('/admin/applications/:id/approve', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ ok: false, error: 'Unauthorized' });

    const { approved_amount, approved_rate, admin_notes } = req.body || {};
    if (!approved_amount || !approved_rate) {
      return res.status(400).json({ ok: false, error: 'Approved amount and rate required' });
    }

    const result = await db.query(
      'UPDATE loan_applications SET status = $1, approved_amount = $2, approved_rate = $3, admin_notes = $4, updated_at = now() WHERE id = $5 RETURNING *',
      ['approved', approved_amount, approved_rate, admin_notes, req.params.id]
    );

    if (!result.rows || !result.rows[0]) return res.status(404).json({ ok: false, error: 'Application not found' });

    res.json({ ok: true, application: result.rows[0] });
  } catch (err) { next(err); }
});

// Admin: Reject loan application
router.patch('/admin/applications/:id/reject', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ ok: false, error: 'Unauthorized' });

    const { admin_notes } = req.body || {};

    const result = await db.query(
      'UPDATE loan_applications SET status = $1, admin_notes = $2, updated_at = now() WHERE id = $3 RETURNING *',
      ['rejected', admin_notes, req.params.id]
    );

    if (!result.rows || !result.rows[0]) return res.status(404).json({ ok: false, error: 'Application not found' });

    res.json({ ok: true, application: result.rows[0] });
  } catch (err) { next(err); }
});

// Compatibility: PATCH /applications/:id -> admin actions (approve/reject) from frontend helpers
router.patch('/applications/:id', requireAuth, async (req, res, next) => {
  try {
    // Only admins may change application status via this endpoint
    if (req.user.role !== 'admin') return res.status(403).json({ ok: false, error: 'Unauthorized' });

    const { status, approved_amount, approved_rate, admin_notes, note } = req.body || {};
    if (!status) return res.status(400).json({ ok: false, error: 'Status required' });

    let result;
    if (status === 'approved') {
      if (!approved_amount || !approved_rate) return res.status(400).json({ ok: false, error: 'Approved amount and rate required' });
      result = await db.query(
        'UPDATE loan_applications SET status = $1, approved_amount = $2, approved_rate = $3, admin_notes = $4, updated_at = now() WHERE id = $5 RETURNING *',
        ['approved', approved_amount, approved_rate, admin_notes || null, req.params.id]
      );
    } else if (status === 'rejected') {
      result = await db.query(
        'UPDATE loan_applications SET status = $1, admin_notes = $2, updated_at = now() WHERE id = $3 RETURNING *',
        ['rejected', admin_notes || note || null, req.params.id]
      );
    } else {
      // Generic status update
      result = await db.query(
        'UPDATE loan_applications SET status = $1, admin_notes = COALESCE($2, admin_notes), updated_at = now() WHERE id = $3 RETURNING *',
        [status, admin_notes || null, req.params.id]
      );
    }

    if (!result.rows || !result.rows[0]) return res.status(404).json({ ok: false, error: 'Application not found' });
    res.json({ ok: true, application: result.rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
