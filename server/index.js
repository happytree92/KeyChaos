'use strict';

require('dotenv').config();
const express = require('express');
const basicAuth = require('express-basic-auth');
const path = require('path');
const fs = require('fs');
const { createPwdPushRouter } = require('./routes/pwdpush');

const app = express();
const PORT = process.env.PORT || 3000;
const VERSION = '1.2.0';

// ─── Startup Diagnostics ─────────────────────────────────────────────────────
console.log(`🔑 KeyChaos v${VERSION} starting…`);
console.log(`   NODE_ENV : ${process.env.NODE_ENV || 'development'}`);
console.log(`   PORT     : ${PORT}`);

const staticDir = path.join(__dirname, '..', 'dist');
const fallbackDir = path.join(__dirname, '..', 'public');
const serveDir = fs.existsSync(staticDir) ? staticDir : fallbackDir;
const indexExists = fs.existsSync(path.join(serveDir, 'index.html'));
console.log(`   UI dir   : ${serveDir} (index.html ${indexExists ? '✅' : '❌ MISSING'})`);

// ─── Auth ────────────────────────────────────────────────────────────────────
const authDisabled = process.env.KC_AUTH_DISABLED === 'true';

if (authDisabled) {
  console.warn('⚠️  WARNING: Basic Auth is DISABLED. Do not expose without a protected reverse proxy.');
} else {
  const user = process.env.KC_AUTH_USER;
  const pass = process.env.KC_AUTH_PASS;

  if (!user || !pass) {
    console.error('❌ FATAL: KC_AUTH_USER and KC_AUTH_PASS must be set, or KC_AUTH_DISABLED=true.');
    process.exit(1);
  }

  console.log(`   Auth     : Enabled ✅ (user: ${user})`);

  const auth = basicAuth({
    users: { [user]: pass },
    challenge: true,
    realm: 'KeyChaos',
  });

  // /api/health is exempt so the Docker healthcheck doesn't need credentials
  app.use((req, res, next) => {
    if (req.path === '/api/health') return next();
    return auth(req, res, next);
  });
}

// ─── Request Logging ─────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`${res.statusCode} ${req.method} ${req.path} ${ms}ms`);
  });
  next();
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/pwdpush', createPwdPushRouter());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: VERSION });
});

// ─── Static UI ────────────────────────────────────────────────────────────────
app.use(express.static(serveDir));

// SPA fallback
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
});
