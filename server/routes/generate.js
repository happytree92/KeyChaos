'use strict';

const express = require('express');
const { generateSmartPass, calculateEntropy } = require('../lib/smartpass');
const { log } = require('../logger');

const VALID_DIGIT_COUNTS = new Set([2, 3, 4]);
const VALID_SYMBOL_SETS  = new Set(['safe', 'none']);
const VALID_COUNTS       = new Set([1, 3, 5]);

function createGenerateRouter() {
  const router = express.Router();

  // POST /api/generate/smartpass
  // Body: { digitCount: 2|3|4, symbolSet: 'safe'|'none', count: 1|3|5 }
  // Returns: { passwords: string[], entropy_bits: number }
  router.post('/smartpass', (req, res) => {
    const ip = req.clientIp || req.ip;
    const { digitCount, symbolSet, count } = req.body;

    if (!VALID_DIGIT_COUNTS.has(Number(digitCount))) {
      log('invalid_params', { ip, reason: 'invalid digitCount' });
      return res.status(400).json({ error: 'invalid_params' });
    }
    if (!VALID_SYMBOL_SETS.has(symbolSet)) {
      log('invalid_params', { ip, reason: 'invalid symbolSet' });
      return res.status(400).json({ error: 'invalid_params' });
    }
    if (!VALID_COUNTS.has(Number(count))) {
      log('invalid_params', { ip, reason: 'invalid count' });
      return res.status(400).json({ error: 'invalid_params' });
    }

    const opts        = { digitCount: Number(digitCount), symbolSet, count: Number(count) };
    const passwords   = generateSmartPass(opts);
    const entropy_bits = calculateEntropy(opts);

    log('generate', { mode: 'smartpass', count: opts.count, ip });

    return res.json({ passwords, entropy_bits });
  });

  return router;
}

module.exports = { createGenerateRouter };
