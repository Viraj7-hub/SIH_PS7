'use strict';

/**
 * tests/ports.test.js
 * Run: npm run test:ports
 */

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');

const BASE = `http://localhost:${process.env.PORT || 5005}/api`;
async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, body: await res.json() };
}

let server;
before(async () => {
  require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
  server = require('../server');
  await new Promise(r => setTimeout(r, 300));
});
after(() => server?.close?.());

describe('GET /api/ports', () => {
  test('returns all seeded ports', async () => {
    const { status, body } = await get('/ports');
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 48, 'Seed must have at least 48 ports');
  });

  test('each port has id, name, country, latitude, longitude', async () => {
    const { body } = await get('/ports');
    const port = body.data[0];
    assert.ok(port.id);
    assert.ok(port.name);
    assert.ok(port.country);
    assert.ok(typeof port.latitude  === 'number' || typeof port.latitude  === 'string');
    assert.ok(typeof port.longitude === 'number' || typeof port.longitude === 'string');
  });
});

describe('GET /api/ports/:id', () => {
  test('returns Mumbai Port by id', async () => {
    const { status, body } = await get('/ports/in-mum');
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.id, 'in-mum');
    assert.ok(body.data.name.includes('Mumbai'));
  });

  test('returns Port of Singapore', async () => {
    const { status, body } = await get('/ports/sg-sg');
    assert.equal(status, 200);
    assert.equal(body.data.country, 'Singapore');
  });

  test('returns 404 for unknown port', async () => {
    const { status, body } = await get('/ports/xx-unknown');
    assert.equal(status, 404);
    assert.equal(body.code, 'NOT_FOUND');
  });
});

describe('GET /api/ports/search', () => {
  test('finds ports by name fragment', async () => {
    const { status, body } = await get('/ports/search?q=mumbai');
    assert.equal(status, 200);
    assert.ok(body.data.length > 0);
    const found = body.data.some(p => p.name.toLowerCase().includes('mumbai'));
    assert.ok(found, 'Must find Mumbai-related port');
  });

  test('finds ports by country name', async () => {
    const { status, body } = await get('/ports/search?q=Australia');
    assert.equal(status, 200);
    assert.ok(body.data.length >= 4, 'At least 4 Australian ports in seed');
  });

  test('returns all ports for empty query', async () => {
    const { status, body } = await get('/ports/search?q=');
    assert.equal(status, 200);
    assert.ok(body.data.length > 0);
  });
});

describe('GET /api/ports/country/:country', () => {
  test('returns Indian ports', async () => {
    const { status, body } = await get('/ports/country/India');
    assert.equal(status, 200);
    assert.ok(body.data.length >= 6, 'Seed has 6 Indian ports');
    assert.ok(body.data.every(p => p.country === 'India'));
  });

  test('returns 404 for nonexistent country', async () => {
    const { status } = await get('/ports/country/Neverland');
    assert.equal(status, 404);
  });
});
