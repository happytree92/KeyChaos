'use strict';

const express = require('express');

function createPwdPushRouter() {
  const router = express.Router();

  const BASE_URL = (process.env.PWD_PUSH_URL || 'https://pwpush.com').replace(/\/$/, '');
  const TOKEN = process.env.PWD_PUSH_TOKEN || '';
  const API_VERSION = process.env.PWD_PUSH_API_VERSION || 'v2';

  console.log(`   PwdPush  : ${BASE_URL} (API ${API_VERSION}) token:${TOKEN ? '✅' : 'none'}`);

  // POST /api/pwdpush/push
  router.post('/push', async (req, res) => {
    const { payload, ttl = 3, maxViews = 5, deletable = true, note = '' } = req.body;

    if (!payload) {
      return res.status(400).json({ error: 'payload is required' });
    }

    const headers = {
      'Content-Type': 'application/json',
      ...(TOKEN && { Authorization: `Bearer ${TOKEN}` }),
    };

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

    try {
      console.log(`PwdPush POST ${endpoint}`);
      const { default: fetch } = await import('node-fetch');
      const response = await fetch(endpoint, { method: 'POST', headers, body });

      const text = await response.text();

      if (!response.ok) {
        console.error(`PwdPush error ${response.status}: ${text}`);
        return res.status(response.status).json({ error: `PwdPush returned ${response.status}` });
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        console.error(`PwdPush non-JSON response: ${text}`);
        return res.status(502).json({ error: 'PwdPush returned a non-JSON response' });
      }

      const urlToken = data.url_token;
      if (!urlToken) {
        console.error(`PwdPush response missing url_token:`, JSON.stringify(data));
        return res.status(502).json({ error: 'PwdPush response missing url_token' });
      }

      const pushUrl = `${BASE_URL}/p/${urlToken}`;
      console.log(`PwdPush push created: ${pushUrl}`);
      return res.json({ pushUrl, urlToken });

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
        const response = await fetch(`${BASE_URL}/api/v2/version`, {
          headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {},
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return res.json({ ok: true, version: data.application_version, edition: data.edition });
      } else {
        // v1 probe — GET /p.json should return 200 with an empty array
        const response = await fetch(`${BASE_URL}/p.json`, { method: 'GET' });
        const ok = response.status === 200;
        return res.json({ ok, version: 'v1/legacy', status: response.status });
      }
    } catch (err) {
      console.error('PwdPush test error:', err.message);
      return res.json({ ok: false, error: err.message });
    }
  });

  return router;
}

module.exports = { createPwdPushRouter };
