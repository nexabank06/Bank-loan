// Email helper using NodeMailer
const nodemailer = require('nodemailer');

let transporter = null;

function initializeMailer() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'smtp.sendgrid.net',
    port: parseInt(process.env.MAIL_PORT || '587'),
    secure: process.env.MAIL_PORT === '465',
    auth: {
      user: process.env.MAIL_USER || 'apikey',
      pass: process.env.MAIL_PASS,
    },
  });

  return transporter;
}

async function sendEmail({ to, subject, html, text }) {
  try {
    const mailer = initializeMailer();

    if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
      console.warn('Email not configured. Set MAIL_USER and MAIL_PASS in .env');
      console.log(`[EMAIL] To: ${to}, Subject: ${subject}`);
      return { ok: true, message: 'Email logged (not configured)' };
    }

    const mailOptions = {
      from: process.env.MAIL_FROM || process.env.MAIL_USER,
      to,
      subject,
      html: html || text,
      text,
    };

    const info = await mailer.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error('Email send error:', err && err.message);
    throw err;
  }
}

async function sendBulkEmail({ recipients, subject, html, text }) {
  const results = [];
  for (const to of recipients) {
    try {
      const result = await sendEmail({ to, subject, html, text });
      results.push({ to, ok: true });
    } catch (err) {
      results.push({ to, ok: false, error: err.message });
    }
  }
  return results;
}


// Send support email from contact form
async function sendSupportEmail({ name, email, subject, message }) {
  const supportTo = process.env.MAIL_FROM;
  const mailSubject = `[Support] ${subject}`;
  const html = `<div style="font-family:sans-serif;font-size:1.1em;">
    <b>From:</b> ${name} (${email})<br>
    <b>Subject:</b> ${subject}<br><br>
    <b>Message:</b><br>
    <div style="margin:1em 0;padding:1em;background:#f3f4f6;color:#23263a;border-radius:8px;">${message.replace(/\n/g,'<br>')}</div>
  </div>`;
  const text = `From: ${name} (${email})\nSubject: ${subject}\n\n${message}`;
  return sendEmail({ to: supportTo, subject: mailSubject, html, text });
}

module.exports = { sendEmail, sendBulkEmail, sendSupportEmail };
