'use strict';

/**
 * tests/health.test.js
 * Run: npm run test:health
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const BASE = `http://localhost:${process.env.PORT || 5005}/api`;

let server;
before(async () => {
  require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
  server = require('../server');
  await new Promise(r => setTimeout(r, 400));
});
after(() => server?.close?.());

test('GET /api/health — server is running', async () => {
  const res = await fetch(`${BASE}/health`);
  assert.equal(res.status, 200);
});

test('GET /api/health — database is connected', async () => {
  const res  = await fetch(`${BASE}/health`);
  const body = await res.json();
  assert.equal(body.success, true, `Health check failed: ${JSON.stringify(body)}`);
  assert.equal(body.status, 'ok');
  assert.equal(body.database, 'connected', 'MySQL must be connected and reachable');
  assert.ok(body.timestamp, 'Timestamp must be present');
});

test('GET /api/health — returns valid ISO timestamp', async () => {
  const { timestamp } = await fetch(`${BASE}/health`).then(r => r.json());
  assert.doesNotThrow(() => new Date(timestamp).toISOString());
});
