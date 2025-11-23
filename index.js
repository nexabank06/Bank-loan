// Consolidated Express server
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const path = require('path');
const authRoutes = require('./routes/auth');
const { requireAuth } = require('./middleware/auth');
const emailVerifyRoutes = require('./routes/email-verify');
const loansRoutes = require('./routes/loans');
const usersRoutes = require('./routes/users');

const { router: securityRoutes } = require('./routes/security');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 4000;

// FRONTEND_URL may be a single origin or a comma-separated list of allowed origins
const FRONTEND = process.env.FRONTEND_URL || process.env.FRONTEND || 'http://localhost:8000';
const ALLOW_NULL_ORIGIN = (process.env.ALLOW_NULL_ORIGIN === 'true') || (process.env.NODE_ENV !== 'production');

// Safety checks in production
if (process.env.NODE_ENV === 'production') {
  if (!process.env.DATABASE_URL) {
    console.error('FATAL: DATABASE_URL is not set in production.');
    process.exit(1);
  }
  if (!process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET is not set in production.');
    process.exit(1);
  }
}

app.use(helmet());
app.use(morgan('tiny'));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Configure CORS safely: do NOT throw from the origin callback (that becomes a 500).
const corsOptions = {
  origin: (origin, cb) => {
    // origin === undefined for same-site navigations or tools that don't set Origin
    // origin === null for file:// contexts
    if (typeof origin === 'undefined') return cb(null, true);
    if (origin === null) {
      if (ALLOW_NULL_ORIGIN) return cb(null, true);
      // Deny but don't throw - return false so the middleware proceeds without ACAO header
      return cb(null, false);
    }

    const allowed = FRONTEND.split(',').map(s => s.trim()).filter(Boolean);
    // Helpful defaults used during development
    allowed.push('https://aayu061.github.io');
    allowed.push('https://aayu061.github.io/Bank-loan');

    if (allowed.includes(origin)) return cb(null, true);
    // Deny but do not create an exception (avoid 500 on OPTIONS). Browser will block the request.
    return cb(null, false);
  },
  credentials: true,
};

app.use(cors(corsOptions));
// Ensure preflight requests receive the same CORS handling
app.options('*', cors(corsOptions));

const limiter = rateLimit({ windowMs: 60 * 1000, max: 200 });
app.use(limiter);

// Trust proxy for secure cookies behind proxies like Render
app.set('trust proxy', true);

// Serve frontend static files (optional)
const frontendDir = path.join(__dirname, '..', 'Frontend');
app.use(express.static(frontendDir));

// Mount routes (auth mandatory, others optional)
app.use('/api/auth', authRoutes);
app.use('/api', authRoutes);
app.use('/api/email', emailVerifyRoutes);
app.use('/api/loans', loansRoutes);
// Also expose loans routes at /api for compatibility with frontend calls to /api/applications
app.use('/api', loansRoutes);
app.use('/api/users', usersRoutes);

app.use('/api/security', securityRoutes);
app.use('/api', adminRoutes); // All /api/admin/* endpoints

try { const debugRoutes = require('./routes/debug'); app.use('/api/debug', debugRoutes); } catch (e) {}
try { const productsRoutes = require('./routes/products'); app.use('/api/products', productsRoutes); } catch (e) {}
try { const applicationsRoutes = require('./routes/applications'); app.use('/api/applications', applicationsRoutes); } catch (e) {}
try { const paymentsRoutes = require('./routes/payments'); app.use('/api/pay', paymentsRoutes); } catch (e) {}
try { const dashboardRoutes = require('./routes/dashboard'); app.use('/api', dashboardRoutes); } catch (e) {}
try { const documentsRoutes = require('./routes/documents'); app.use('/api/documents', documentsRoutes); } catch (e) {}

// Example protected route
app.get('/api/me', requireAuth, async (req, res) => {
  res.json({ ok: true, user: req.user });
});

app.get('/health', (req, res) => res.json({ ok: true, now: new Date() }));

// SPA fallback for non-API routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/health')) return next();
  const indexPath = path.join(frontendDir, 'index.html');
  res.sendFile(indexPath, err => { if (err) next(); });
});

// Generic error handler
app.use((err, req, res, next) => {
  console.error(err && (err.stack || err));
  res.status(err && err.status ? err.status : 500).json({ ok: false, error: err && err.message ? err.message : 'Server error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Nexa backend listening on port ${PORT}`);
    console.log(`NODE_ENV=${process.env.NODE_ENV || 'development'} FRONTEND=${FRONTEND}`);
  });
}

module.exports = app;

