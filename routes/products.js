const express = require('express');
const router = express.Router();

// Simple products list (stub)
router.get('/', async (req, res) => {
  try {
    // Return a small set of demo loan products
    const products = [
      { id: 'home-loan', name: 'Home Loan', rate: 8.5, min_amount: 100000 },
      { id: 'personal-loan', name: 'Personal Loan', rate: 12.5, min_amount: 50000 },
      { id: 'auto-loan', name: 'Auto Loan', rate: 9.5, min_amount: 50000 }
    ];
    res.json({ ok: true, products });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Failed to fetch products' });
  }
});

module.exports = router;
