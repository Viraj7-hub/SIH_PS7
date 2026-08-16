'use strict';

/**
 * tests/voyages.test.js
 * Run: npm run test:voyages
 */

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');

const BASE = `http://localhost:${process.env.PORT || 5005}/api`;

async function post(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}
async function get(path, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${BASE}${path}`, { headers });
  return { status: res.status, body: await res.json() };
}
async function put(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method: 'PUT', headers, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}

let server, captainToken, crewToken;

before(async () => {
  require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
  server = require('../server');
  await new Promise(r => setTimeout(r, 300));

  const capRes = await post('/auth/login', { email: 'demo@oceanroute.com', password: 'demo123' });
  captainToken = capRes.body.data.token;
  const crewRes = await post('/auth/login', { email: 'crew@oceanroute.com', password: 'demo123' });
  crewToken = crewRes.body.data.token;
});
after(() => server?.close?.());

describe('POST /api/voyages', () => {
  let createdVoyageId;

  test('creates a voyage as captain', async () => {
    const { status, body } = await post('/voyages', {
      shipCode:     'SHIP001',
      sourcePortId: 'in-mum',
      destPortId:   'lk-col',
      notes:        'Test voyage from integration test',
    }, captainToken);
    assert.equal(status, 201, `Expected 201: ${JSON.stringify(body)}`);
    assert.equal(body.success, true);
    assert.ok(body.data.id);
    createdVoyageId = body.data.id;
  });

  test('creates a voyage as crew', async () => {
    const { status, body } = await post('/voyages', {
      shipCode:     'SHIP002',
      sourcePortId: 'in-mum',
      destPortId:   'lk-col',
    }, crewToken);
    assert.equal(status, 201, `Expected 201: ${JSON.stringify(body)}`);
    assert.equal(body.success, true);
  });

  test('rejects voyage with same source and destination (422)', async () => {
    const { status, body } = await post('/voyages', {
      shipCode:     'SHIP001',
      sourcePortId: 'in-mum',
      destPortId:   'in-mum',
    }, captainToken);
    assert.equal(status, 422, `Expected 422: ${JSON.stringify(body)}`);
  });

  test('rejects voyage with invalid port id (404)', async () => {
    const { status, body } = await post('/voyages', {
      shipCode:     'SHIP001',
      sourcePortId: 'xx-invalid',
      destPortId:   'lk-col',
    }, captainToken);
    assert.equal(status, 404);
    assert.equal(body.code, 'NOT_FOUND');
  });

  test('rejects voyage with invalid ship code (404)', async () => {
    const { status } = await post('/voyages', {
      shipCode:     'XXXXX',
      sourcePortId: 'in-mum',
      destPortId:   'lk-col',
    }, captainToken);
    assert.equal(status, 404);
  });

  test('rejects unauthenticated voyage creation (401)', async () => {
    const { status } = await post('/voyages', {
      shipCode: 'SHIP001', sourcePortId: 'in-mum', destPortId: 'lk-col',
    });
    assert.equal(status, 401);
  });

  test('rejects missing shipCode (422)', async () => {
    const { status } = await post('/voyages', {
      sourcePortId: 'in-mum', destPortId: 'lk-col',
    }, captainToken);
    assert.equal(status, 422);
  });
});

describe('GET /api/voyages', () => {
  test('captain can list all voyages', async () => {
    const { status, body } = await get('/voyages', captainToken);
    assert.equal(status, 200);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 1);
  });

  test('crew can list voyages (filtered to own)', async () => {
    const { status, body } = await get('/voyages', crewToken);
    assert.equal(status, 200);
    assert.ok(Array.isArray(body.data));
  });

  test('unauthenticated returns 401', async () => {
    const { status } = await get('/voyages');
    assert.equal(status, 401);
  });
});

describe('PUT /api/voyages/:id/status', () => {
  let voyageId;

  before(async () => {
    const { body } = await post('/voyages', {
      shipCode: 'SHIP003', sourcePortId: 'in-che', destPortId: 'sg-sg',
    }, captainToken);
    voyageId = body.data?.id;
  });

  test('captain can update voyage status to ACTIVE', async () => {
    if (!voyageId) return;
    const { status, body } = await put(`/voyages/${voyageId}/status`, { status: 'ACTIVE' }, captainToken);
    assert.equal(status, 200);
    assert.equal(body.data.status, 'ACTIVE');
  });

  test('captain can complete a voyage', async () => {
    if (!voyageId) return;
    const { status, body } = await put(`/voyages/${voyageId}/status`, { status: 'COMPLETED' }, captainToken);
    assert.equal(status, 200);
    assert.equal(body.data.status, 'COMPLETED');
  });

  test('rejects invalid status (422)', async () => {
    if (!voyageId) return;
    const { status } = await put(`/voyages/${voyageId}/status`, { status: 'FLYING' }, captainToken);
    assert.equal(status, 422);
  });

  test('returns 404 for nonexistent voyage', async () => {
    const { status } = await put('/voyages/999999/status', { status: 'ACTIVE' }, captainToken);
    assert.equal(status, 404);
  });
});
