const express = require('express');
const router = express.Router();

// Simple payment endpoint (demo). In production integrate with payment gateway.
router.post('/pay', async (req, res) => {
  try {
    // Accept a payment payload and return a demo success
    res.json({ ok: true, message: 'Payment processed (demo)' });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Payment failed' });
  }
});

// Get payments for a loan (demo)
router.get('/loan/:loanId', async (req, res) => {
  try {
    res.json({ ok: true, payments: [] });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Failed to fetch payments' });
  }
});

module.exports = router;
