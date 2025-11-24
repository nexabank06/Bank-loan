// helpers/email.js — SendGrid only (no SMTP, no nodemailer)

const sgMail = require('@sendgrid/mail');

let sendgridInitialized = false;

function initSendGrid() {
  if (sendgridInitialized) return;

  // Prefer SENDGRID_API_KEY, fallback to MAIL_PASS if you still keep it
  const apiKey = process.env.SENDGRID_API_KEY || process.env.MAIL_PASS;

  if (!apiKey) {
    console.warn('[EMAIL] SendGrid not configured. Set SENDGRID_API_KEY (or MAIL_PASS).');
    return;
  }

  sgMail.setApiKey(apiKey);
  sendgridInitialized = true;
}

async function sendEmail({ to, subject, html, text }) {
  initSendGrid();

  const apiKey = process.env.SENDGRID_API_KEY || process.env.MAIL_PASS;
  if (!apiKey) {
    console.log(`[EMAIL DEMO] To: ${to}, Subject: ${subject}`);
    return { ok: true, message: 'Email logged (SendGrid not configured)' };
  }

  const from = process.env.MAIL_FROM;
  if (!from) {
    throw new Error('MAIL_FROM is not set in environment.');
  }

  const msg = {
    to,
    from,
    subject,
    text: text || (html ? html.replace(/<[^>]+>/g, '') : undefined),
    html: html || text,
  };

  try {
    const [response] = await sgMail.send(msg);
    console.log('[SENDGRID] Email sent, status:', response.statusCode);
    return { ok: true, statusCode: response.statusCode };
  } catch (err) {
    console.error('SendGrid send error:', err && err.message);
    throw err;
  }
}

async function sendBulkEmail({ recipients, subject, html, text }) {
  const results = [];
  for (const to of recipients) {
    try {
      await sendEmail({ to, subject, html, text });
      results.push({ to, ok: true });
    } catch (err) {
      results.push({ to, ok: false, error: err && err.message });
    }
  }
  return results;
}

async function sendSupportEmail({ name, email, subject, message }) {
  const supportTo = process.env.MAIL_FROM;
  const mailSubject = `[Support] ${subject}`;
  const html = `<div style="font-family:sans-serif;font-size:1.1em;">
    <b>From:</b> ${name} (${email})<br>
    <b>Subject:</b> ${subject}<br><br>
    <b>Message:</b><br>
    <div style="margin:1em 0;padding:1em;background:#f3f4f6;color:#23263a;border-radius:8px;">
      ${message.replace(/\n/g, '<br>')}
    </div>
  </div>`;

  const text = `From: ${name} (${email})\nSubject: ${subject}\n\n${message}`;
  return sendEmail({ to: supportTo, subject: mailSubject, html, text });
}

module.exports = { sendEmail, sendBulkEmail, sendSupportEmail };
