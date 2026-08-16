'use strict';

/**
 * tests/auth.test.js
 * Authentication endpoint tests using Node's built-in test runner.
 *
 * Run: npm run test:auth
 *
 * Prerequisites:
 *   - MySQL running with schema.sql + seed.sql applied
 *   - backend/.env configured
 */

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');

// ── Minimal fetch helper ──────────────────────────────────────────────────────
const BASE = `http://localhost:${process.env.PORT || 5005}/api`;

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

async function get(path, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { headers });
  return { status: res.status, body: await res.json() };
}

// ── Load env & start server ───────────────────────────────────────────────────
let server;
before(async () => {
  require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
  // Import server AFTER dotenv loads
  server = require('../server');
  // Give the server a moment to bind
  await new Promise(r => setTimeout(r, 300));
});

after(() => {
  if (server?.close) server.close();
});

// ── Test: Register ────────────────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  const uniqueEmail = `testuser_${Date.now()}@oceanroute.com`;

  test('registers a new user successfully', async () => {
    const { status, body } = await post('/auth/register', {
      name: 'Test User',
      email: uniqueEmail,
      password: 'testpass123',
      role: 'crew',
    });
    assert.equal(status, 201, `Expected 201, got ${status}: ${JSON.stringify(body)}`);
    assert.equal(body.success, true);
    assert.ok(body.data.id);
    assert.equal(body.data.email, uniqueEmail);
    assert.equal(body.data.role, 'crew');
    // Must never expose password
    assert.equal(body.data.password, undefined);
    assert.equal(body.data.password_hash, undefined);
  });

  test('rejects duplicate email with 409', async () => {
    const { status, body } = await post('/auth/register', {
      name: 'Test User 2',
      email: uniqueEmail, // same email
      password: 'testpass456',
    });
    assert.equal(status, 409);
    assert.equal(body.success, false);
    assert.equal(body.code, 'CONFLICT');
  });

  test('rejects missing name with 422', async () => {
    const { status, body } = await post('/auth/register', {
      email: `x_${Date.now()}@example.com`,
      password: 'testpass123',
    });
    assert.equal(status, 422);
    assert.equal(body.code, 'VALIDATION_ERROR');
  });

  test('rejects invalid email with 422', async () => {
    const { status, body } = await post('/auth/register', {
      name: 'Bad Email', email: 'not-an-email', password: 'pass123',
    });
    assert.equal(status, 422);
  });

  test('rejects password shorter than 6 characters', async () => {
    const { status, body } = await post('/auth/register', {
      name: 'Short Pass', email: `sp_${Date.now()}@example.com`, password: '123',
    });
    assert.equal(status, 422);
  });
});

// ── Test: Login ───────────────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  let captainToken;

  test('logs in demo captain successfully', async () => {
    const { status, body } = await post('/auth/login', {
      email: 'demo@oceanroute.com',
      password: 'demo123',
    });
    assert.equal(status, 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
    assert.equal(body.success, true);
    assert.ok(body.data.token, 'Token must be present');
    assert.equal(body.data.user.role, 'captain');
    captainToken = body.data.token;
  });

  test('rejects wrong password with 401', async () => {
    const { status, body } = await post('/auth/login', {
      email: 'demo@oceanroute.com',
      password: 'wrongpassword',
    });
    assert.equal(status, 401);
    assert.equal(body.success, false);
    assert.equal(body.code, 'UNAUTHORIZED');
  });

  test('rejects unknown email with 401 (no user enumeration)', async () => {
    const { status, body } = await post('/auth/login', {
      email: 'nobody@oceanroute.com',
      password: 'demo123',
    });
    assert.equal(status, 401);
    assert.equal(body.message, 'Invalid email or password.'); // same message for both cases
  });

  test('rejects missing password with 422', async () => {
    const { status } = await post('/auth/login', { email: 'demo@oceanroute.com' });
    assert.equal(status, 422);
  });

  // ── GET /api/auth/me ────────────────────────────────────────────────────────
  test('GET /api/auth/me returns user for valid token', async () => {
    const { status, body } = await get('/auth/me', captainToken);
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.email, 'demo@oceanroute.com');
    assert.equal(body.data.password_hash, undefined, 'Must not expose password_hash');
  });

  test('GET /api/auth/me returns 401 with no token', async () => {
    const { status, body } = await get('/auth/me');
    assert.equal(status, 401);
    assert.equal(body.code, 'UNAUTHORIZED');
  });

  test('GET /api/auth/me returns 401 with invalid token', async () => {
    const { status, body } = await get('/auth/me', 'not.a.real.token');
    assert.equal(status, 401);
    assert.equal(body.code, 'UNAUTHORIZED');
  });

  test('GET /api/auth/me returns 401 with expired token', async () => {
    const jwt = require('jsonwebtoken');
    const expiredToken = jwt.sign(
      { userId: 1, role: 'captain' },
      process.env.JWT_SECRET,
      { expiresIn: '0s' }
    );
    await new Promise(r => setTimeout(r, 100));
    const { status, body } = await get('/auth/me', expiredToken);
    assert.equal(status, 401);
    assert.equal(body.code, 'UNAUTHORIZED');
  });
});

// ── Test: Legacy /api/login ───────────────────────────────────────────────────
describe('POST /api/login (legacy compatibility)', () => {
  test('returns token in legacy shape', async () => {
    const { status, body } = await post('/login', {
      email: 'demo@oceanroute.com',
      password: 'demo123',
    });
    assert.equal(status, 200);
    assert.ok(body.token, 'Legacy shape must include top-level token');
    assert.ok(body.user?.email);
  });
});

// ── Test: Role-based access ───────────────────────────────────────────────────
describe('Role-based authorization', () => {
  let captainToken, crewToken;

  before(async () => {
    const cap = await post('/auth/login', { email: 'demo@oceanroute.com', password: 'demo123' });
    captainToken = cap.body.data.token;
    const crew = await post('/auth/login', { email: 'crew@oceanroute.com', password: 'demo123' });
    crewToken = crew.body.data.token;
  });

  test('captain can create a ship', async () => {
    const { status } = await post('/ships', {
      shipCode: `TST${Date.now()}`.slice(0, 10),
      name: 'Test Vessel',
      type: 'Tanker',
      maxSpeed: 15,
      draft: 10,
    }, captainToken);
    // 201 = success, 409 = duplicate (also fine, ship was created)
    assert.ok([201, 409].includes(status), `Expected 201 or 409, got ${status}`);
  });

  test('crew cannot create a ship — returns 403', async () => {
    const { status, body } = await post('/ships', {
      shipCode: `TST${Date.now()}`.slice(0, 10),
      name: 'Crew Test Vessel',
    }, crewToken);
    assert.equal(status, 403);
    assert.equal(body.code, 'FORBIDDEN');
  });

  test('unauthenticated cannot create a ship — returns 401', async () => {
    const { status } = await post('/ships', { shipCode: 'TEST', name: 'No Auth' });
    assert.equal(status, 401);
  });
});
