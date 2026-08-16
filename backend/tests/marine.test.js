'use strict';

/**
 * tests/marine.test.js
 * ═══════════════════════════════════════════════════════════════════
 * BE3 Integration Test Suite — Marine Intelligence
 * ═══════════════════════════════════════════════════════════════════
 *
 * Run:  npm run test:marine
 *
 * Prerequisites:
 *   - MySQL running with schema.sql + seed.sql applied
 *   - backend/.env configured (DEMO_MODE=true recommended for CI)
 *   - npm install has been run
 *
 * Tests cover:
 *   GET /api/weather/:shipId
 *   GET /api/ocean/:shipId
 *   GET /api/cyclones
 *   GET /api/cyclones/near-route
 *   GET /api/cyclones/:id
 *   GET /api/ships/:shipId/position
 *   POST /api/ships/:shipId/position
 *   POST /api/chat
 *   GET /api/marine-weather
 *
 * Failure cases: invalid shipId, out-of-range coordinates,
 * missing required fields, malformed JSON.
 */

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');

const BASE = `http://localhost:${process.env.PORT || 5005}/api`;

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function get(path, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { headers });
  return { status: res.status, body: await res.json() };
}

async function post(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

// ── Server lifecycle ──────────────────────────────────────────────────────────

let server;
before(async () => {
  require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
  server = require('../server');
  await new Promise((r) => setTimeout(r, 500)); // wait for bind
});

after(() => {
  if (server?.close) server.close();
});

// =============================================================================
// Weather
// =============================================================================

describe('GET /api/weather/:shipId', () => {
  test('returns an array of weather risk points for valid ship', async () => {
    const { status, body } = await get('/weather/SHIP001');
    assert.equal(status, 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
    assert.ok(Array.isArray(body), 'Response must be an array');
    if (body.length > 0) {
      const pt = body[0];
      assert.ok(pt.lat != null, 'Each point must have lat');
      assert.ok(pt.lon != null, 'Each point must have lon');
      assert.ok(typeof pt.risk === 'number', 'Each point must have numeric risk');
      assert.ok(typeof pt.condition === 'string', 'Each point must have condition string');
      assert.ok(pt.risk >= 0 && pt.risk <= 100, `Risk must be 0-100, got ${pt.risk}`);
    }
  });

  test('returns 404 for unknown ship', async () => {
    const { status, body } = await get('/weather/SHIP_DOES_NOT_EXIST');
    assert.equal(status, 404);
    assert.equal(body.success, false);
  });
});

// =============================================================================
// Ocean Conditions
// =============================================================================

describe('GET /api/ocean/:shipId', () => {
  test('returns ocean conditions for valid ship', async () => {
    const { status, body } = await get('/ocean/SHIP001');
    assert.equal(status, 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
    // waveHeight may be null if data is unavailable, but key must exist
    assert.ok(Object.prototype.hasOwnProperty.call(body, 'waveHeight'), 'Must have waveHeight');
    assert.ok(Object.prototype.hasOwnProperty.call(body, 'currentSpeed'), 'Must have currentSpeed');
    assert.ok(Object.prototype.hasOwnProperty.call(body, 'currentDirection'), 'Must have currentDirection');
    assert.ok(Object.prototype.hasOwnProperty.call(body, 'weatherDataStatus'), 'Must have weatherDataStatus');
    assert.ok(['fresh', 'stale', 'unavailable'].includes(body.weatherDataStatus),
      `weatherDataStatus must be one of fresh/stale/unavailable, got: ${body.weatherDataStatus}`);
    if (body.riskScore != null) {
      assert.ok(body.riskScore >= 0 && body.riskScore <= 100, `riskScore out of range: ${body.riskScore}`);
    }
  });

  test('returns 404 for unknown ship', async () => {
    const { status, body } = await get('/ocean/SHIP_INVALID');
    assert.equal(status, 404);
    assert.equal(body.success, false);
  });
});

// =============================================================================
// Cyclones — List
// =============================================================================

describe('GET /api/cyclones', () => {
  test('returns cyclone list with expected shape', async () => {
    const { status, body } = await get('/cyclones');
    assert.equal(status, 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data), 'data must be an array');
    assert.ok(typeof body.count === 'number', 'count must be a number');
    assert.equal(body.count, body.data.length);

    // Verify shape of each cyclone record
    for (const c of body.data) {
      assert.ok(typeof c.name === 'string', 'cyclone must have name');
      assert.ok(typeof c.latitude === 'number', 'cyclone must have latitude');
      assert.ok(typeof c.longitude === 'number', 'cyclone must have longitude');
      assert.ok(c.latitude >= -90 && c.latitude <= 90, `Invalid latitude: ${c.latitude}`);
      assert.ok(c.longitude >= -180 && c.longitude <= 180, `Invalid longitude: ${c.longitude}`);
      assert.ok(c.riskScore >= 0 && c.riskScore <= 100, `riskScore out of range: ${c.riskScore}`);
      // Must not return hardcoded demo data in production
      assert.notEqual(c.name, 'Demo Cyclone', 'Must not return hardcoded Demo Cyclone name');
    }
  });
});

// =============================================================================
// Cyclones — Near Route
// =============================================================================

describe('GET /api/cyclones/near-route', () => {
  const mumColomboRoute = JSON.stringify([
    [18.9, 72.8], [16.0, 74.0], [12.0, 75.5], [8.0, 77.0], [6.94, 79.84]
  ]);

  test('returns threats array for valid route', async () => {
    const { status, body } = await get(`/cyclones/near-route?waypoints=${encodeURIComponent(mumColomboRoute)}`);
    assert.equal(status, 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(typeof body.waypointCount === 'number');
    assert.ok(typeof body.threatsDetected === 'number');
  });

  test('returns 422 if waypoints param missing', async () => {
    const { status, body } = await get('/cyclones/near-route');
    assert.equal(status, 422);
    assert.equal(body.success, false);
    assert.equal(body.code, 'VALIDATION_ERROR');
  });

  test('returns 422 if waypoints is invalid JSON', async () => {
    const { status, body } = await get('/cyclones/near-route?waypoints=not_json');
    assert.equal(status, 422);
    assert.equal(body.success, false);
  });

  test('returns 422 if waypoints is empty array', async () => {
    const { status, body } = await get(`/cyclones/near-route?waypoints=${encodeURIComponent('[]')}`);
    assert.equal(status, 422);
    assert.equal(body.success, false);
  });
});

// =============================================================================
// Cyclones — By ID
// =============================================================================

describe('GET /api/cyclones/:id', () => {
  test('returns 404 for non-existent cyclone id', async () => {
    const { status, body } = await get('/cyclones/999999');
    assert.equal(status, 404);
    assert.equal(body.success, false);
    assert.equal(body.code, 'NOT_FOUND');
  });

  test('returns 422 for non-numeric id', async () => {
    const { status, body } = await get('/cyclones/abc');
    assert.equal(status, 422);
    assert.equal(body.success, false);
    assert.equal(body.code, 'VALIDATION_ERROR');
  });

  test('returns valid cyclone if seed data exists', async () => {
    // Seed data includes a cyclone — try id=1
    const { status, body } = await get('/cyclones/1');
    if (status === 200) {
      assert.equal(body.success, true);
      assert.ok(body.data.name, 'Must have name');
      assert.ok(body.data.latitude != null, 'Must have latitude');
      assert.ok(body.data.longitude != null, 'Must have longitude');
    } else {
      // Cyclone 1 may have been deactivated — 404 is acceptable
      assert.equal(status, 404);
    }
  });
});

// =============================================================================
// Ship Position — GET
// =============================================================================

describe('GET /api/ships/:shipId/position', () => {
  test('returns position for valid ship', async () => {
    const { status, body } = await get('/ships/SHIP001/position');
    assert.equal(status, 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
    assert.equal(body.success, true);
    const pos = body.data;
    assert.ok(pos, 'data must be present');
    assert.ok(typeof pos.lat === 'number', 'lat must be a number');
    assert.ok(typeof pos.lon === 'number', 'lon must be a number');
    assert.ok(pos.lat >= -90  && pos.lat <= 90,  `lat out of range: ${pos.lat}`);
    assert.ok(pos.lon >= -180 && pos.lon <= 180, `lon out of range: ${pos.lon}`);
    assert.ok(typeof pos.speed === 'number', 'speed must be present');
    assert.ok(pos.speed >= 0, 'speed must be non-negative');
    if (pos.heading != null) {
      assert.ok(pos.heading >= 0 && pos.heading <= 360, `heading out of range: ${pos.heading}`);
    }
  });

  test('returns 404 for unknown ship', async () => {
    const { status, body } = await get('/ships/SHIP_DOES_NOT_EXIST/position');
    assert.equal(status, 404);
    assert.equal(body.success, false);
    assert.equal(body.code, 'NOT_FOUND');
  });
});

// =============================================================================
// Ship Position — POST
// =============================================================================

describe('POST /api/ships/:shipId/position', () => {
  test('records a valid position', async () => {
    const { status, body } = await post('/ships/SHIP001/position', {
      lat: 15.5, lon: 74.2, speed: 18.0, heading: 150,
    });
    // 201 = new record created; in DEMO_MODE returns current simulated pos
    assert.ok([201, 200].includes(status), `Expected 200 or 201, got ${status}: ${JSON.stringify(body)}`);
    assert.equal(body.success, true);
    const pos = body.data;
    assert.ok(pos.lat != null && pos.lon != null, 'Position must be returned');
  });

  test('rejects invalid latitude (out of range)', async () => {
    const { status, body } = await post('/ships/SHIP001/position', {
      lat: 91, lon: 72, speed: 18, heading: 150,
    });
    assert.equal(status, 422);
    assert.equal(body.code, 'VALIDATION_ERROR');
  });

  test('rejects invalid longitude (out of range)', async () => {
    const { status, body } = await post('/ships/SHIP001/position', {
      lat: 18, lon: 200, speed: 18, heading: 150,
    });
    assert.equal(status, 422);
    assert.equal(body.code, 'VALIDATION_ERROR');
  });

  test('rejects negative speed', async () => {
    const { status, body } = await post('/ships/SHIP001/position', {
      lat: 15, lon: 74, speed: -5, heading: 150,
    });
    assert.equal(status, 422);
    assert.equal(body.code, 'VALIDATION_ERROR');
  });

  test('rejects heading > 360', async () => {
    const { status, body } = await post('/ships/SHIP001/position', {
      lat: 15, lon: 74, speed: 18, heading: 400,
    });
    assert.equal(status, 422);
    assert.equal(body.code, 'VALIDATION_ERROR');
  });

  test('rejects missing lat/lon', async () => {
    const { status, body } = await post('/ships/SHIP001/position', { speed: 18 });
    assert.equal(status, 422);
    assert.equal(body.code, 'VALIDATION_ERROR');
  });

  test('returns 404 for unknown ship', async () => {
    const { status, body } = await post('/ships/SHIP_INVALID/position', {
      lat: 15, lon: 74, speed: 18, heading: 150,
    });
    assert.equal(status, 404);
    assert.equal(body.code, 'NOT_FOUND');
  });
});

// =============================================================================
// Chat
// =============================================================================

describe('POST /api/chat', () => {
  const QUESTIONS = [
    'Where is my ship?',
    'What is my current speed?',
    'How far is the destination?',
    'When will we arrive?',
    'Is the route safe?',
    'What is the weather?',
    'Are there any cyclones?',
    'What are the ocean conditions?',
    'Why was this route selected?',
  ];

  test('returns a non-empty reply for each known question type', async () => {
    for (const q of QUESTIONS) {
      const { status, body } = await post('/chat', { shipId: 'SHIP001', message: q });
      assert.equal(status, 200, `Question "${q}" returned ${status}: ${JSON.stringify(body)}`);
      assert.ok(body.reply, `Reply must be non-empty for: ${q}`);
      assert.ok(typeof body.reply === 'string', `Reply must be a string for: ${q}`);
      assert.ok(body.reply.length > 10, `Reply too short for: ${q}`);
    }
  });

  test('reply must not contain hardcoded fallback number "1,190 km"', async () => {
    const { status, body } = await post('/chat', { shipId: 'SHIP001', message: 'How far is the destination?' });
    assert.equal(status, 200);
    assert.ok(
      !body.reply.includes('1,190 km'),
      `Reply must not contain hardcoded "1,190 km" — got: "${body.reply}"`
    );
  });

  test('reply must not contain hardcoded "28 hours and 36 minutes"', async () => {
    const { status, body } = await post('/chat', { shipId: 'SHIP001', message: 'When will we arrive?' });
    assert.equal(status, 200);
    assert.ok(
      !body.reply.includes('28 hours and 36 minutes'),
      `Reply must not be hardcoded — got: "${body.reply}"`
    );
  });

  test('returns 404 for unknown ship', async () => {
    const { status, body } = await post('/chat', { shipId: 'SHIP_NONE', message: 'hello' });
    assert.equal(status, 404);
    assert.equal(body.success, false);
    assert.equal(body.code, 'NOT_FOUND');
  });

  test('returns 422 if shipId missing', async () => {
    const { status, body } = await post('/chat', { message: 'hello' });
    assert.equal(status, 422);
    assert.equal(body.code, 'VALIDATION_ERROR');
  });

  test('returns 422 if message missing', async () => {
    const { status, body } = await post('/chat', { shipId: 'SHIP001' });
    assert.equal(status, 422);
    assert.equal(body.code, 'VALIDATION_ERROR');
  });
});

// =============================================================================
// Marine Weather Grid
// =============================================================================

describe('GET /api/marine-weather', () => {
  test('returns grid data with status field', async () => {
    // Use a small bbox to avoid hammering Open-Meteo in test
    const { status, body } = await get('/marine-weather?bbox=10,70,14,76&step=2');
    assert.equal(status, 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data), 'data must be an array');
    assert.ok(typeof body.count === 'number', 'count must be a number');
    assert.ok(['fresh', 'stale', 'unavailable'].includes(body.weatherDataStatus),
      `Unexpected weatherDataStatus: ${body.weatherDataStatus}`);
  });

  test('second call with same bbox should be faster (cache hit)', async () => {
    const bbox = 'bbox=15,72,17,74&step=2';
    const t1 = Date.now();
    await get(`/marine-weather?${bbox}`);
    const firstCallMs = Date.now() - t1;

    const t2 = Date.now();
    const { status } = await get(`/marine-weather?${bbox}`);
    const secondCallMs = Date.now() - t2;

    assert.equal(status, 200);
    // Second call should be at least 2x faster than first (cache hit vs API fetch)
    // We use a generous ratio to avoid flakiness in CI
    if (firstCallMs > 200) { // Only assert if first call was non-trivial
      assert.ok(
        secondCallMs < firstCallMs * 0.9,
        `Cache miss: second call (${secondCallMs}ms) was not faster than first (${firstCallMs}ms)`
      );
    }
  });

  test('returns 422 for malformed bbox', async () => {
    const { status, body } = await get('/marine-weather?bbox=not,valid,data');
    assert.equal(status, 422);
    assert.equal(body.code, 'VALIDATION_ERROR');
  });

  test('returns 422 for out-of-range bbox', async () => {
    const { status, body } = await get('/marine-weather?bbox=-200,-200,200,200');
    assert.equal(status, 422);
    assert.equal(body.code, 'VALIDATION_ERROR');
  });

  test('returns 422 for invalid step', async () => {
    const { status, body } = await get('/marine-weather?step=100');
    assert.equal(status, 422);
    assert.equal(body.code, 'VALIDATION_ERROR');
  });

  test('default (no bbox) still works without error', async () => {
    // Don't do a default full-grid request in CI — just check the rate limit catches it
    // or returns successfully. We use a VERY small step to limit points.
    const { status } = await get('/marine-weather?step=10');
    assert.ok([200, 429].includes(status), `Expected 200 or 429, got ${status}`);
  });
});

// =============================================================================
// Risk Service Unit Tests (no HTTP)
// =============================================================================

describe('Risk Service — unit tests', () => {
  const riskService = require('../services/risk.service');

  test('clear sky at calm sea → low risk', () => {
    const { riskScore, riskLevel } = riskService.computeRiskScore({
      waveHeight: 0.5, windSpeed: 5, currentSpeed: 0.2, weatherCode: 0,
    });
    assert.ok(riskScore >= 0 && riskScore <= 30, `Expected low risk, got ${riskScore}`);
    assert.equal(riskLevel, 'low');
  });

  test('heavy storm → high risk', () => {
    const { riskScore, riskLevel } = riskService.computeRiskScore({
      waveHeight: 6, windSpeed: 50, currentSpeed: 3, weatherCode: 95,
    });
    assert.ok(riskScore >= 61, `Expected high/severe risk, got ${riskScore}`);
    assert.ok(['high', 'severe'].includes(riskLevel));
  });

  test('riskScore is always 0–100', () => {
    const cases = [
      { waveHeight: 0, windSpeed: 0, currentSpeed: 0, weatherCode: 0 },
      { waveHeight: 100, windSpeed: 200, currentSpeed: 50, weatherCode: 99 },
      { waveHeight: null, windSpeed: null, currentSpeed: null, weatherCode: null },
    ];
    for (const c of cases) {
      const { riskScore } = riskService.computeRiskScore(c);
      assert.ok(riskScore >= 0 && riskScore <= 100, `riskScore out of range: ${riskScore} for ${JSON.stringify(c)}`);
    }
  });

  test('cyclone nearby increases risk', () => {
    const base = riskService.computeRiskScore({
      waveHeight: 1, windSpeed: 10, currentSpeed: 0.5,
      weatherCode: 0, lat: 14.5, lon: 75.5, cyclones: [],
    });
    const withCyclone = riskService.computeRiskScore({
      waveHeight: 1, windSpeed: 10, currentSpeed: 0.5,
      weatherCode: 0, lat: 14.5, lon: 75.5,
      cyclones: [{ latitude: 14.5, longitude: 75.5, is_active: 1 }],
    });
    assert.ok(withCyclone.riskScore > base.riskScore,
      `Cyclone nearby should increase risk: ${base.riskScore} → ${withCyclone.riskScore}`);
  });

  test('haversineNM returns correct distance (Mumbai to Colombo ~853 NM)', () => {
    const dist = riskService.haversineNM(18.94, 72.84, 6.95, 79.84);
    assert.ok(dist > 800 && dist < 950, `Expected ~853 NM, got ${dist.toFixed(1)} NM`);
  });
});
