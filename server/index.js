'use strict';

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { createPwdPushRouter } = require('./routes/pwdpush');

const app = express();
const PORT = process.env.PORT || 3000;
const VERSION = '1.3.0';

// ─── Startup Diagnostics ─────────────────────────────────────────────────────
console.log(`🔑 KeyChaos v${VERSION} starting…`);
console.log(`   NODE_ENV : ${process.env.NODE_ENV || 'development'}`);
console.log(`   PORT     : ${PORT}`);

const staticDir = path.join(__dirname, '..', 'dist');
const fallbackDir = path.join(__dirname, '..', 'public');
const serveDir = fs.existsSync(staticDir) ? staticDir : fallbackDir;
const indexExists = fs.existsSync(path.join(serveDir, 'index.html'));
console.log(`   UI dir   : ${serveDir} (index.html ${indexExists ? '✅' : '❌ MISSING'})`);

if (!process.env.PWD_PUSH_TOKEN) {
  console.warn('⚠️  PWD_PUSH_TOKEN is not set — PwdPush may rate-limit unauthenticated requests.');
}

// ─── Security: Helmet (CSP, HSTS, X-Frame-Options, noSniff, etc.) ────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'"],
      styleSrc:       ["'self'", "'unsafe-inline'"],
      imgSrc:         ["'self'", "data:"],
      connectSrc:     ["'self'"],
      fontSrc:        ["'self'"],
      objectSrc:      ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));

// ─── Security: Same-origin CORS ──────────────────────────────────────────────
// No Access-Control-Allow-Origin header is set, so browsers enforce same-origin
// by default. Additionally, reject API requests that explicitly carry a foreign Origin.
app.use('/api/', (req, res, next) => {
  const origin = req.get('Origin');
  if (!origin) return next();
  try {
    const originHost = new URL(origin).host;
    const serverHost = (req.get('Host') || '').split(':')[0];
    const originHostName = originHost.split(':')[0];
    if (originHostName !== serverHost) {
      console.warn(`[CORS] Blocked cross-origin API request — Origin: ${origin}`);
      return res.status(403).json({ error: 'Cross-origin requests are not allowed.' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid Origin header.' });
  }
  next();
});

// ─── Security: Rate Limiting ─────────────────────────────────────────────────
const RATE_PER_MIN  = parseInt(process.env.RATE_LIMIT_PER_MIN  || '20',  10);
const RATE_PER_HOUR = parseInt(process.env.RATE_LIMIT_PER_HOUR || '200', 10);

const limiterMinute = rateLimit({
  windowMs: 60 * 1000,
  max: RATE_PER_MIN,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`[RATE LIMIT] Per-minute exceeded — IP: ${req.ip} at ${new Date().toISOString()}`);
    res.status(429).json({ error: 'Too many requests — slow down.' });
  },
});

const limiterHour = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: RATE_PER_HOUR,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`[RATE LIMIT] Per-hour exceeded — IP: ${req.ip} at ${new Date().toISOString()}`);
    res.status(429).json({ error: 'Hourly request limit exceeded.' });
  },
});

app.use('/api/', limiterMinute);
app.use('/api/', limiterHour);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));

// ─── Request Logging ─────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${res.statusCode} ${req.method} ${req.path} ${Date.now() - start}ms`);
  });
  next();
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/pwdpush', createPwdPushRouter());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: VERSION });
});

// ─── Static UI ────────────────────────────────────────────────────────────────
app.use(express.static(serveDir));

app.get('*', (req, res) => {
  const indexPath = path.join(serveDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('KeyChaos UI not found — dist/ missing. Was the Vite build run?');
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ KeyChaos v${VERSION} listening on 0.0.0.0:${PORT}`);
  console.log(`   Rate limits : ${RATE_PER_MIN}/min  ${RATE_PER_HOUR}/hr per IP`);
});
