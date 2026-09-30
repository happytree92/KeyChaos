'use strict';

const { log } = require('../logger');

// ─── IP extraction ────────────────────────────────────────────────────────────
// Use req.ip, which honours the app's 'trust proxy' setting (one hop when
// TRUST_PROXY is on). Reading X-Forwarded-For directly would let any client
// spoof its logged IP by sending the header itself.

function getIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

// ─── Internal health-check detection ─────────────────────────────────────────
// Docker's healthcheck runs wget/curl from 127.0.0.1 — suppress those.

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function isInternalHealthCheck(req, ip) {
  if (req.path !== '/api/health') return false;
  if (!LOOPBACK.has(ip))          return false;
  const ua = req.headers['user-agent'] || '';
  return /docker|curl|wget/i.test(ua);
}

// ─── Middleware ───────────────────────────────────────────────────────────────
// Attaches getIp helper to req, and fires health_check for external probes.

function requestLogger(req, res, next) {
  req.clientIp = getIp(req);

  if (req.path === '/api/health') {
    if (!isInternalHealthCheck(req, req.clientIp)) {
      log('health_check', { ip: req.clientIp });
    }
    return next();
  }

  next();
}

module.exports = { requestLogger, getIp };
