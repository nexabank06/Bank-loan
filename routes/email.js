const express = require('express');
const router = express.Router();
const sendSupportEmail = require('../helpers/email').sendSupportEmail;

// POST /api/email/support
router.post('/support', async (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  try {
    await sendSupportEmail({ name, email, subject, message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send email.' });
  }
});

module.exports = router;
