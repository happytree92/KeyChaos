'use strict';

require('dotenv').config();
const express = require('express');
const basicAuth = require('express-basic-auth');
const path = require('path');
const { createPwdPushRouter } = require('./routes/pwdpush');

const app = express();
const PORT = process.env.PORT || 3000;
const VERSION = '1.2.0';

// ─── Auth ────────────────────────────────────────────────────────────────────
const authDisabled = process.env.KC_AUTH_DISABLED === 'true';

if (authDisabled) {
  console.warn('⚠️  WARNING: Basic Auth is DISABLED (KC_AUTH_DISABLED=true). Do not expose this to the internet without a protected reverse proxy.');
} else {
  const user = process.env.KC_AUTH_USER;
  const pass = process.env.KC_AUTH_PASS;

  if (!user || !pass) {
    console.error('❌ FATAL: KC_AUTH_USER and KC_AUTH_PASS must be set, or set KC_AUTH_DISABLED=true (not recommended).');
    process.exit(1);
  }

  const auth = basicAuth({
    users: { [user]: pass },
    challenge: true,
    realm: 'KeyChaos',
  });

  // Exempt /api/health so the Docker healthcheck doesn't need credentials
  app.use((req, res, next) => {
    if (req.path === '/api/health') return next();
    return auth(req, res, next);
  });
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/pwdpush', createPwdPushRouter());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: VERSION });
});

// ─── Static UI ────────────────────────────────────────────────────────────────
// Serves the Vite build output (dist/) or the placeholder public/ dir
const staticDir = path.join(__dirname, '..', 'dist');
const fallbackDir = path.join(__dirname, '..', 'public');
const fs = require('fs');

const serveDir = fs.existsSync(staticDir) ? staticDir : fallbackDir;
app.use(express.static(serveDir));

// SPA fallback — send index.html for any unmatched route
app.get('*', (req, res) => {
  const indexPath = path.join(serveDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('KeyChaos is starting up — no UI built yet.');
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🔑 KeyChaos v${VERSION} running on port ${PORT}`);
  console.log(`   Auth: ${authDisabled ? 'DISABLED ⚠️' : 'Enabled ✅'}`);
});
