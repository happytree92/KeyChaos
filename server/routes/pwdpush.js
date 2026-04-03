'use strict';

const express = require('express');
const { log } = require('../logger');

// TTL enum (sent from UI) → expire_after_days
// 6=1day, 12=1week, 15=1month (kept as UI enum; converted here before sending upstream)
const DURATION_TO_DAYS = { 6: 1, 12: 7, 15: 30 };
const VALID_DURATIONS  = new Set([6, 12, 15]);

function createPwdPushRouter() {
  const router = express.Router();

  const BASE_URL    = (process.env.PWD_PUSH_URL     || 'https://pwpush.com').replace(/\/$/, '');
  const TOKEN       = process.env.PWD_PUSH_TOKEN     || '';
  const API_VERSION = process.env.PWD_PUSH_VERSION   ||
                      process.env.PWD_PUSH_API_VERSION || 'v2';

  console.log(`   PwdPush  : ${BASE_URL} (API ${API_VERSION}) token:${TOKEN ? '✅' : 'none ⚠️'}`);

  // POST /api/pwdpush/push
  router.post('/push', async (req, res) => {
    const ip = req.clientIp || req.ip;
    let { payload, ttl, maxViews, deletable = true, name = '' } = req.body;

    if (!payload || typeof payload !== 'string') {
      log('invalid_params', { ip, reason: 'payload missing or not a string' });
      return res.status(400).json({ error: 'payload is required and must be a string.' });
    }
    if (payload.length > 10_000) {
      log('invalid_params', { ip, reason: 'payload exceeds 10,000 characters' });
      return res.status(400).json({ error: 'payload exceeds maximum length of 10,000 characters.' });
    }

    // Clamp and validate ttl (expire_after_duration enum)
    ttl = parseInt(ttl, 10);
    if (!VALID_DURATIONS.has(ttl)) ttl = 6; // default: 1 day

    // Clamp maxViews to 1–100
    maxViews = parseInt(maxViews, 10);
    if (isNaN(maxViews) || maxViews < 1)   maxViews = 1;
    if (maxViews > 100)                     maxViews = 100;

    const authHeaders = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

    try {
      const { default: fetch } = await import('node-fetch');
      let endpoint, body;

      const expireDays = DURATION_TO_DAYS[ttl] ?? 1;

      if (API_VERSION === 'v2') {
        // pwpush.com / Pro — REST API v2
        endpoint = `${BASE_URL}/api/v2/pushes`;
        body = JSON.stringify({
          push: {
            payload,
            expire_after_duration: ttl,
            expire_after_views:    maxViews,
            deletable_by_viewer:   deletable,
          },
        });
      } else {
        // v1 / OSS self-hosted
        endpoint = `${BASE_URL}/p.json`;
        body = JSON.stringify({
          password: {
            payload,
            expire_after_days:   DURATION_TO_DAYS[ttl] ?? 1,
            expire_after_views:  maxViews,
            deletable_by_viewer: deletable,
          },
        });
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept':       'application/json',
          ...authHeaders,
        },
        body,
      });

      // Propagate 429 with Retry-After to the client
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
        log('pwdpush_error', { ip, status_code: 429 });
        return res.status(429).json({ error: 'PwdPush rate limit hit.', retryAfter });
      }

      const text = await response.text();
      if (!response.ok) {
        log('pwdpush_error', { ip, status_code: response.status });
        return res.status(response.status).json({ error: `PwdPush returned ${response.status}.` });
      }

      let data;
      try { data = JSON.parse(text); }
      catch {
        log('pwdpush_error', { ip, status_code: response.status, reason: 'non-JSON response' });
        return res.status(502).json({ error: 'PwdPush returned a non-JSON response.' });
      }

      // v2 uses html_url directly; v1 constructs from url_token
      const pushUrl = data.html_url || (data.url_token ? `${BASE_URL}/p/${data.url_token}` : null);
      if (!pushUrl) {
        log('pwdpush_error', { ip, status_code: response.status, reason: 'missing url in response' });
        return res.status(502).json({ error: 'PwdPush response missing shareable URL.' });
      }

      // Log the push event — never log the URL or payload
      log('pwdpush', { ip, ttl, maxViews });

      return res.json({
        pushUrl,
        expiresAt:      data.expires_at      ?? null,
        viewsRemaining: data.views_remaining  ?? maxViews,
      });

    } catch (err) {
      log('pwdpush_error', { ip, status_code: 0, reason: 'network error' });
      return res.status(502).json({ error: 'Failed to reach PwdPush — check PWD_PUSH_URL and network connectivity.' });
    }
  });

  // GET /api/pwdpush/test
  router.get('/test', async (req, res) => {
    try {
      const { default: fetch } = await import('node-fetch');

      if (API_VERSION === 'v2') {
        // Probe the authenticated API with a GET — expect 200 or 401 (reachable), not 404
        const response = await fetch(`${BASE_URL}/api/v2/version`, {
          headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return res.json({ ok: true, version: data.application_version, edition: data.edition });
      } else {
        const response = await fetch(`${BASE_URL}/p.json`, { method: 'GET' });
        return res.json({ ok: response.status === 200, version: 'v1/legacy', status: response.status });
      }
    } catch (err) {
      return res.json({ ok: false, error: err.message });
    }
  });

  return router;
}

module.exports = { createPwdPushRouter };
