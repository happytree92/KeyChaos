'use strict';

const { log } = require('../logger');

// ─── IP extraction ────────────────────────────────────────────────────────────
// Pangolin / Traefik set X-Forwarded-For; fall back to socket address.

function getIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
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
