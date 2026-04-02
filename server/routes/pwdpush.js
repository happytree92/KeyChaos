'use strict';

const express = require('express');

function createPwdPushRouter() {
  const router = express.Router();

  const BASE_URL = process.env.PWD_PUSH_URL || 'https://pwpush.com';
  const TOKEN = process.env.PWD_PUSH_TOKEN || '';
  const API_VERSION = process.env.PWD_PUSH_API_VERSION || 'v2'; // 'v1' or 'v2'

  // POST /api/pwdpush/push
  // Body: { payload, ttl, maxViews, deletable, note }
  router.post('/push', async (req, res) => {
    const { payload, ttl = 3, maxViews = 5, deletable = true, note = '' } = req.body;

    if (!payload) {
      return res.status(400).json({ error: 'payload is required' });
    }

    const headers = {
      'Content-Type': 'application/json',
      ...(TOKEN && { Authorization: `Bearer ${TOKEN}` }),
    };

    try {
      let endpoint, body;

      if (API_VERSION === 'v2') {
        endpoint = `${BASE_URL}/api/v2/pushes`;
        body = JSON.stringify({
          push: {
            payload,
            expire_after_duration: ttl,
            expire_after_views: maxViews,
            deletable_by_viewer: deletable,
            note,
          },
        });
      } else {
        // v1 / Legacy (self-hosted OSS)
        endpoint = `${BASE_URL}/p.json`;
        body = JSON.stringify({
          password: {
            payload,
            expire_after_days: ttl,
            expire_after_views: maxViews,
            deletable_by_viewer: deletable,
            note,
          },
        });
      }

      const { default: fetch } = await import('node-fetch');
      const response = await fetch(endpoint, { method: 'POST', headers, body });

      if (!response.ok) {
        const text = await response.text();
        return res.status(response.status).json({ error: `PwdPush error: ${text}` });
      }

      const data = await response.json();
      const urlToken = data.url_token;
      const pushUrl = `${BASE_URL}/p/${urlToken}`;

      return res.json({ pushUrl, urlToken });
    } catch (err) {
      console.error('PwdPush proxy error:', err);
      return res.status(502).json({ error: 'Failed to reach PwdPush. Check PWD_PUSH_URL and connectivity.' });
    }
  });

  // GET /api/pwdpush/test — "Test Connection" button
  router.get('/test', async (req, res) => {
    try {
      const { default: fetch } = await import('node-fetch');

      if (API_VERSION === 'v2') {
        const response = await fetch(`${BASE_URL}/api/v2/version`, {
          headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {},
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return res.json({ ok: true, version: data.application_version, edition: data.edition });
      } else {
        // v1 probe — just check reachability
        const response = await fetch(`${BASE_URL}/p.json`, { method: 'GET' });
        return res.json({ ok: response.status < 500, version: 'v1/legacy' });
      }
    } catch (err) {
      return res.json({ ok: false, error: err.message });
    }
  });

  return router;
}

module.exports = { createPwdPushRouter };
