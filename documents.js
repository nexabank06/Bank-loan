const express = require('express');
const router = express.Router();

// List documents for authenticated user (demo)
router.get('/', async (req, res) => {
  try {
    // return empty list by default
    res.json({ ok: true, documents: [] });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Failed to fetch documents' });
  }
});

// Accept uploads (demo): respond OK so frontend upload doesn't fail during demo
router.post('/', async (req, res) => {
  try {
    // In production you'd use multer to parse form-data and store files
    res.json({ ok: true, message: 'Upload received (demo mode)' });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Upload failed' });
  }
});

module.exports = router;
