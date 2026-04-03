'use strict';

const pino = require('pino');

// ─── Pino instance ────────────────────────────────────────────────────────────
// messageKey:'event' → the string passed to logger.info() lands in "event" field
// timestamp:false    → we inject "ts" ourselves as ISO 8601
const _pino = pino({
  base:       null,   // omit default pid / hostname
  timestamp:  false,
  messageKey: 'event',
});

/**
 * Emit one structured log line.
 * NEVER pass: passwords, generated output, PwdPush URLs, tokens, auth headers.
 *
 * @param {string} event  - event name (see spec)
 * @param {object} fields - additional fields (ip, mode, reason, …)
 */
function log(event, fields = {}) {
  _pino.info({ ts: new Date().toISOString(), ...fields }, event);
}

// ─── Rate-limit threshold tracker ─────────────────────────────────────────────
// Fires rate_limit_threshold when the same IP triggers a limit 3× in 1 hour.

const THRESHOLD_COUNT     = 3;
const THRESHOLD_WINDOW_MS = 60 * 60 * 1000;            // 1 hour
const _ipHits             = new Map();                  // ip → number[]  (timestamps)

/**
 * Record one rate-limit hit for an IP.
 * Returns the total hit count within the window so the caller can decide
 * whether to emit rate_limit_threshold.
 *
 * @param {string} ip
 * @returns {number} hits in the last hour (including this one)
 */
function recordRateLimitHit(ip) {
  const now    = Date.now();
  const cutoff = now - THRESHOLD_WINDOW_MS;
  const hits   = (_ipHits.get(ip) || []).filter(t => t > cutoff);
  hits.push(now);
  _ipHits.set(ip, hits);
  return hits.length;
}

module.exports = { log, recordRateLimitHit, THRESHOLD_COUNT };
