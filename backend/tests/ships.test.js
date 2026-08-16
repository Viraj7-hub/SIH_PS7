'use strict';

/**
 * tests/ships.test.js
 * Run: npm run test:ships
 */

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');

const BASE = `http://localhost:${process.env.PORT || 5005}/api`;

async function get(path, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${BASE}${path}`, { headers });
  return { status: res.status, body: await res.json() };
}
async function post(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}

let server;
before(async () => {
  require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
  server = require('../server');
  await new Promise(r => setTimeout(r, 300));
});
after(() => server?.close?.());

describe('GET /api/ships', () => {
  test('returns all ships', async () => {
    const { status, body } = await get('/ships');
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 3, 'Seed data must include at least 3 ships');
  });
});

describe('GET /api/ships/:shipId', () => {
  test('returns SHIP001 with correct frontend shape', async () => {
    const { status, body } = await get('/ships/SHIP001');
    assert.equal(status, 200);
    assert.equal(body.success, true);
    const ship = body.data;
    assert.equal(ship.shipId, 'SHIP001');
    assert.ok(ship.shipName, 'shipName must be present');
    assert.ok(ship.source !== undefined, 'source must be present');
    assert.ok(ship.destination !== undefined, 'destination must be present');
    assert.ok(typeof ship.currentPosition?.lat === 'number');
    assert.ok(typeof ship.currentPosition?.lon === 'number');
    assert.ok(typeof ship.speed === 'number');
  });

  test('returns SHIP002', async () => {
    const { status, body } = await get('/ships/SHIP002');
    assert.equal(status, 200);
    assert.equal(body.data.shipId, 'SHIP002');
  });

  test('returns 404 for unknown ship', async () => {
    const { status, body } = await get('/ships/XXXXXX');
    assert.equal(status, 404);
    assert.equal(body.success, false);
    assert.equal(body.code, 'NOT_FOUND');
  });

  test('lowercase ship id is auto-uppercased', async () => {
    const { status, body } = await get('/ships/ship001');
    assert.equal(status, 200);
    assert.equal(body.data.shipId, 'SHIP001');
  });
});

describe('GET /api/ships/:shipId/position', () => {
  test('returns position data for SHIP001', async () => {
    const { status, body } = await get('/ships/SHIP001/position');
    assert.equal(status, 200);
    assert.equal(body.success, true);
    const pos = body.data;
    assert.ok(typeof pos.lat === 'number');
    assert.ok(typeof pos.lon === 'number');
    assert.ok(typeof pos.speed === 'number');
    assert.equal(pos.shipId, 'SHIP001');
  });

  test('returns 404 for unknown ship position', async () => {
    const { status } = await get('/ships/UNKNOWN/position');
    assert.equal(status, 404);
  });
});

describe('POST /api/ships (captain only)', () => {
  let captainToken;
  before(async () => {
    const res = await post('/auth/login', { email: 'demo@oceanroute.com', password: 'demo123' });
    captainToken = res.body.data.token;
  });

  test('creates a ship as captain', async () => {
    const code = `VES${Date.now()}`.slice(0, 12);
    const { status, body } = await post('/ships', {
      shipCode: code, name: 'Test Vessel Alpha',
      type: 'Container Ship', maxSpeed: 16, draft: 11,
    }, captainToken);
    assert.ok([201, 409].includes(status));
    if (status === 201) {
      assert.equal(body.success, true);
      assert.ok(body.data.shipId);
    }
  });

  test('rejects invalid shipCode (non-alphanumeric)', async () => {
    const { status, body } = await post('/ships', {
      shipCode: 'INVALID CODE!', name: 'Bad Ship',
    }, captainToken);
    assert.equal(status, 422);
    assert.equal(body.code, 'VALIDATION_ERROR');
  });
});
