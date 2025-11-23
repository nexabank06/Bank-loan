// Admin routes: metrics, user management, audit, documents, etc.
const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

// List all users for admin (show info)
router.get('/admin/users', requireAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT id, first_name, last_name, email, phone, dob, role, created_at FROM users ORDER BY created_at DESC');
    res.json({ users: result.rows });
  } catch (e) {
    console.error('admin/users error', e && e.stack ? e.stack : e);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update a user (admin)
router.put('/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const { first_name, last_name, email, phone, dob, role } = req.body || {};
    const result = await db.query(
      `UPDATE users SET first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name), email = COALESCE($3, email), phone = COALESCE($4, phone), dob = COALESCE($5, dob), role = COALESCE($6, role) WHERE id = $7 RETURNING id, first_name, last_name, email, phone, dob, role, created_at`,
      [first_name || null, last_name || null, email || null, phone || null, dob || null, role || null, id]
    );
    if (!result.rows || !result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (e) {
    console.error('admin/users PUT error', e && e.stack ? e.stack : e);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Placeholder: Real-time metrics bar
router.get('/admin/metrics', requireAdmin, async (req, res) => {
  // TODO: Aggregate stats from DB
  res.json({
    totalApplications: 0,
    approved: 0,
    rejected: 0,
    disbursed: 0,
    overdue: 0
  });
});

// Placeholder: Activity heatmap data
router.get('/admin/activity-heatmap', requireAdmin, async (req, res) => {
  // TODO: Return activity data for chart
  res.json({ data: [] });
});

// Placeholder: Flagged applications
router.get('/admin/flagged', requireAdmin, async (req, res) => {
  // TODO: Return flagged apps
  res.json({ flagged: [] });
});

// Placeholder: Workload distribution
router.get('/admin/workload', requireAdmin, async (req, res) => {
  // TODO: Return workload per officer
  res.json({ officers: [] });
});

// Placeholder: Messaging system
router.get('/admin/messages', requireAdmin, async (req, res) => {
  // TODO: Return messages
  res.json({ messages: [] });
});

// Placeholder: Document verification
router.get('/admin/documents', requireAdmin, async (req, res) => {
  // TODO: Return documents to verify
  res.json({ documents: [] });
});

// Placeholder: Audit trail
router.get('/admin/audit', requireAdmin, async (req, res) => {
  // TODO: Return audit records
  res.json({ audit: [] });
});

// Placeholder: Reports
router.get('/admin/reports', requireAdmin, async (req, res) => {
  // TODO: Return reports
  res.json({ reports: [] });
});

// Placeholder: Credit bureau
router.get('/admin/credit-bureau', requireAdmin, async (req, res) => {
  // TODO: Return credit bureau data
  res.json({ credit: {} });
});

// Placeholder: Permissions/role manager
router.get('/admin/roles', requireAdmin, async (req, res) => {
  // TODO: Return users/roles
  res.json({ users: [] });
});

// Placeholder: Multi-branch support
router.get('/admin/branches', requireAdmin, async (req, res) => {
  // TODO: Return branch metrics
  res.json({ branches: [] });
});

// Placeholder: Loan product manager
router.get('/admin/products', requireAdmin, async (req, res) => {
  // TODO: Return loan products
  res.json({ products: [] });
});

// Placeholder: Communication log
router.get('/admin/communications', requireAdmin, async (req, res) => {
  // TODO: Return comm log
  res.json({ communications: [] });
});

// Placeholder: Fraud detection
router.get('/admin/fraud', requireAdmin, async (req, res) => {
  // TODO: Return fraud alerts
  res.json({ alerts: [] });
});

module.exports = router;
