'use strict';

/**
 * routes/legacy.routes.js
 * Backwards-compatibility endpoints that the original frontend called.
 *
 * All business logic has been migrated to services. These shims delegate
 * to those services, preserving the original URL structure.
 *
 * Rate limiting:
 *   /api/login          — authLimiter
 *   /api/marine-weather — marineWeatherLimiter (now handled by marine.routes.js)
 *   /api/chat           — chatLimiter
 */

const router          = require('express').Router();
const authService     = require('../services/auth.service');
const routeService    = require('../services/route.service');
const weatherService  = require('../services/weather.service');
const chatService     = require('../services/chat.service');
const cycloneService  = require('../services/cyclone.service');
const { AppError }    = require('../middleware/error.middleware');
const { authLimiter, chatLimiter } = require('../middleware/rateLimiter.middleware');
const shipModel       = require('../models/ship.model');

// ── POST /api/login (compat wrapper → auth.service.login) ────────────────────
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      throw new AppError('Invalid email or password.', 'UNAUTHORIZED');
    }
    const result = await authService.login({ email, password });
    // Match the original response shape the frontend expects:
    // { token, user: { email, name } }
    res.json({
      success: true,
      token:   result.token,
      user: {
        email: result.user.email,
        name:  result.user.name,
        role:  result.user.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/route/optimize ─────────────────────────────────────────────────
router.post('/route/optimize', async (req, res, next) => {
  try {
    const { shipId, sourcePortId, destPortId, priorities, vessel } = req.body || {};
    if (!shipId) {
      throw new AppError('Unable to calculate the optimized route.', 'NOT_FOUND');
    }
    // Verify ship exists
    const ship = await shipModel.findByShipCode(shipId.toUpperCase());
    if (!ship) {
      throw new AppError('Unable to calculate the optimized route.', 'NOT_FOUND');
    }
    const result = await routeService.optimizeRoute({ shipId, sourcePortId, destPortId, priorities, vessel });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/weather/:shipId ──────────────────────────────────────────────────
router.get('/weather/:shipId', async (req, res, next) => {
  try {
    const ship = await shipModel.findByShipCode(req.params.shipId.toUpperCase());
    if (!ship) throw new AppError('Weather data temporarily unavailable.', 'NOT_FOUND');
    const data = await weatherService.getWeatherForShip(req.params.shipId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/ocean/:shipId ────────────────────────────────────────────────────
router.get('/ocean/:shipId', async (req, res, next) => {
  try {
    const ship = await shipModel.findByShipCode(req.params.shipId.toUpperCase());
    if (!ship) throw new AppError('Ocean data temporarily unavailable.', 'NOT_FOUND');
    const data = await weatherService.getOceanConditions(req.params.shipId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/cyclones/:shipId ─────────────────────────────────────────────────
// Legacy endpoint — returns active cyclones from DB (no longer hardcoded).
router.get('/cyclones/:shipId', async (req, res, next) => {
  try {
    const ship = await shipModel.findByShipCode(req.params.shipId.toUpperCase());
    if (!ship) throw new AppError('Cyclone data temporarily unavailable.', 'NOT_FOUND');
    // Use cyclone service directly — ship position is no longer needed for simple listing
    const activeCyclones = await cycloneService.getActiveCyclones();
    res.json({ cyclones: activeCyclones });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/chat ────────────────────────────────────────────────────────────
// Rate limited to prevent abuse of the context-building queries.
router.post('/chat', chatLimiter, async (req, res, next) => {
  try {
    const { shipId, message } = req.body || {};
    if (!shipId || !message) {
      throw new AppError('shipId and message are required.', 'VALIDATION_ERROR');
    }

    const ship = await shipModel.findByShipCode((shipId || '').toUpperCase());
    if (!ship) throw new AppError('Unable to access voyage assistance.', 'NOT_FOUND');

    const result = await chatService.handleChatMessage(shipId, message);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/marine-weather ───────────────────────────────────────────────────
// Delegates to weatherService.getMarineWeatherGrid() with caching.
// The rate limiter is now on marine.routes.js at /api/marine-weather.
// This legacy path is kept for backwards compat but also enforces the limiter.
// NOTE: marine.routes.js is mounted BEFORE legacy routes in server.js, so
// requests to /api/marine-weather will hit marine.routes.js first.
// This handler is kept as a safety net only.

module.exports = router;
