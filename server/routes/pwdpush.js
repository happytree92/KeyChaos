'use strict';

const express = require('express');

// TTL enum (sent from UI) → expire_after_days
// 6=1day, 12=1week, 15=1month (kept as UI enum; converted here before sending upstream)
const DURATION_TO_DAYS = { 6: 1, 12: 7, 15: 30 };
const VALID_DURATIONS = new Set([6, 12, 15]);

function createPwdPushRouter() {
  const router = express.Router();

  const BASE_URL    = (process.env.PWD_PUSH_URL     || 'https://pwpush.com').replace(/\/$/, '');
  const TOKEN       = process.env.PWD_PUSH_TOKEN     || '';
  // PWD_PUSH_VERSION is the canonical var; fall back to legacy PWD_PUSH_API_VERSION
  const API_VERSION = process.env.PWD_PUSH_VERSION   ||
                      process.env.PWD_PUSH_API_VERSION || 'v2';

  console.log(`   PwdPush  : ${BASE_URL} (API ${API_VERSION}) token:${TOKEN ? '✅' : 'none ⚠️'}`);

  // POST /api/pwdpush/push
  router.post('/push', async (req, res) => {
    let { payload, ttl, maxViews, deletable = true, name = '' } = req.body;

    if (!payload || typeof payload !== 'string') {
      return res.status(400).json({ error: 'payload is required and must be a string.' });
    }
    if (payload.length > 10_000) {
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

      const pwdBody = {
        password: {
          payload,
          expire_after_days:   expireDays,
          expire_after_views:  maxViews,
          deletable_by_viewer: deletable,
        },
      };

      if (API_VERSION === 'v2') {
        // pwpush.com authenticated REST API
        endpoint = `${BASE_URL}/api/v1/passwords`;
        body = JSON.stringify(pwdBody);
      } else {
        // v1 / legacy OSS self-hosted
        endpoint = `${BASE_URL}/p.json`;
        body = JSON.stringify(pwdBody);
      }

      console.log(`PwdPush POST ${endpoint} (ttl=${ttl} views=${maxViews})`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...authHeaders,
        },
        body,
      });

      // Propagate 429 with Retry-After to the client
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
        console.warn(`[RATE LIMIT] PwdPush upstream returned 429 — Retry-After: ${retryAfter}s`);
        return res.status(429).json({ error: 'PwdPush rate limit hit.', retryAfter });
      }

      const text = await response.text();
      if (!response.ok) {
        console.error(`PwdPush error ${response.status}: ${text}`);
        return res.status(response.status).json({ error: `PwdPush returned ${response.status}.` });
      }

      let data;
      try { data = JSON.parse(text); }
      catch {
        console.error(`PwdPush non-JSON response: ${text}`);
        return res.status(502).json({ error: 'PwdPush returned a non-JSON response.' });
      }

      // v2 uses html_url directly; v1 constructs from url_token
      const pushUrl = data.html_url || (data.url_token ? `${BASE_URL}/p/${data.url_token}` : null);
      if (!pushUrl) {
        console.error('PwdPush response missing html_url and url_token:', JSON.stringify(data));
        return res.status(502).json({ error: 'PwdPush response missing shareable URL.' });
      }

      console.log(`PwdPush push created: ${pushUrl}`);
      return res.json({
        pushUrl,
        expiresAt:      data.expires_at      ?? null,
        viewsRemaining: data.views_remaining  ?? maxViews,
      });

    } catch (err) {
      console.error('PwdPush proxy error:', err.message);
      return res.status(502).json({ error: 'Failed to reach PwdPush — check PWD_PUSH_URL and network connectivity.' });
    }
  });

  // GET /api/pwdpush/test
  router.get('/test', async (req, res) => {
    try {
      const { default: fetch } = await import('node-fetch');

      if (API_VERSION === 'v2') {
        // Probe the authenticated API with a GET — expect 200 or 401 (reachable), not 404
        const response = await fetch(`${BASE_URL}/api/v1/passwords`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
          },
        });
        const ok = response.status === 200 || response.status === 401;
        return res.json({ ok, status: response.status, version: 'v2/authenticated' });
      } else {
        const response = await fetch(`${BASE_URL}/p.json`, { method: 'GET' });
        return res.json({ ok: response.status === 200, version: 'v1/legacy', status: response.status });
      }
    } catch (err) {
      console.error('PwdPush test error:', err.message);
      return res.json({ ok: false, error: err.message });
    }
  });

  return router;
}

module.exports = { createPwdPushRouter };
