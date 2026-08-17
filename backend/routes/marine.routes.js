'use strict';

/**
 * routes/marine.routes.js
 * ═══════════════════════════════════════════════════════════════════
 * BE3-owned routes for cyclone hazards and marine weather grid.
 *
 * Endpoints:
 *   GET /api/cyclones            — all active cyclones from DB
 *   GET /api/cyclones/near-route — cyclones within 300 NM of a route
 *   GET /api/cyclones/:id        — single cyclone by id
 *   GET /api/marine-weather      — cached marine weather grid
 *
 * Rate limiting:
 *   /api/cyclones         — general apiLimiter
 *   /api/marine-weather   — marineWeatherLimiter (6 req/min per IP)
 */

const router         = require('express').Router();
const cycloneService = require('../services/cyclone.service');
const weatherService = require('../services/weather.service');
const { AppError }   = require('../middleware/error.middleware');
const { marineWeatherLimiter } = require('../middleware/rateLimiter.middleware');
const logger         = require('../utils/logger');

// ── GET /api/cyclones ─────────────────────────────────────────────────────────
// Returns all currently active cyclones from the database.
router.get('/cyclones', async (req, res, next) => {
  try {
    const cyclones = await cycloneService.getActiveCyclones();
    res.json({
      success: true,
      count:   cyclones.length,
      data:    cyclones,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/cyclones/near-route ──────────────────────────────────────────────
// Find cyclones within NEAR_ROUTE_THRESHOLD_NM of a route.
// Query param: waypoints — JSON array of [lat,lon] pairs OR {lat,lon} objects
//   Example: ?waypoints=[[18.9,72.8],[14.0,74.8],[6.94,79.84]]
router.get('/cyclones/near-route', async (req, res, next) => {
  try {
    const raw = req.query.waypoints;
    if (!raw) {
      throw new AppError('Query parameter "waypoints" is required.', 'VALIDATION_ERROR');
    }

    let waypoints;
    try {
      waypoints = JSON.parse(raw);
    } catch {
      throw new AppError('waypoints must be a valid JSON array.', 'VALIDATION_ERROR');
    }

    if (!Array.isArray(waypoints) || waypoints.length === 0) {
      throw new AppError('waypoints must be a non-empty array.', 'VALIDATION_ERROR');
    }

    const threats = await cycloneService.getCyclonesNearRoute(waypoints);
    res.json({
      success:         true,
      waypointCount:   waypoints.length,
      threatsDetected: threats.length,
      data:            threats,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/cyclones/:id ─────────────────────────────────────────────────────
// Returns a single cyclone by its internal numeric ID.
router.get('/cyclones/:id', async (req, res, next) => {
  try {
    const isShipCode = /^SHIP\d+$/i.test(req.params.id);
    if (isShipCode) {
      return next('route');
    }

    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0 || !/^\d+$/.test(req.params.id)) {
      throw new AppError('Cyclone ID must be a positive integer.', 'VALIDATION_ERROR');
    }

    const cyclone = await cycloneService.getCycloneById(id);
    if (!cyclone) {
      throw new AppError(`Cyclone with ID ${id} not found.`, 'NOT_FOUND');
    }

    res.json({ success: true, data: cyclone });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/marine-weather ───────────────────────────────────────────────────
// Returns the marine weather grid with caching.
//
// Query params (all optional):
//   bbox  — "latMin,lonMin,latMax,lonMax"  e.g. ?bbox=-10,50,25,90
//   step  — grid step in degrees           e.g. ?step=1.5
//   parameter — filter by specific parameter (not implemented, for future)
//
// Rate limited to 6 req/min per IP to prevent hammering Open-Meteo.
router.get('/marine-weather', marineWeatherLimiter, async (req, res, next) => {
  try {
    // Parse optional bbox
    let bbox;
    if (req.query.bbox) {
      const parts = req.query.bbox.split(',').map(Number);
      if (parts.length !== 4 || parts.some(isNaN)) {
        throw new AppError('bbox must be "latMin,lonMin,latMax,lonMax".', 'VALIDATION_ERROR');
      }
      const [latMin, lonMin, latMax, lonMax] = parts;
      // Validate ranges
      if (latMin < -90 || latMax > 90 || lonMin < -180 || lonMax > 180 || latMin >= latMax || lonMin >= lonMax) {
        throw new AppError('bbox values are out of valid coordinate range.', 'VALIDATION_ERROR');
      }
      bbox = { latMin, latMax, lonMin, lonMax };
    }

    const step = req.query.step ? parseFloat(req.query.step) : undefined;
    if (step != null && (isNaN(step) || step < 0.5 || step > 10)) {
      throw new AppError('step must be a number between 0.5 and 10.', 'VALIDATION_ERROR');
    }

    const { data, weatherDataStatus } = await weatherService.getMarineWeatherGrid(bbox, step);

    logger.info('Marine weather grid served', {
      pointCount: data.length, weatherDataStatus,
    });

    res.json({ success: true, weatherDataStatus, count: data.length, data });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/tides ────────────────────────────────────────────────────────────
// Returns real tide station observations (MSL height, flood/ebb state).
router.get('/tides', async (req, res, next) => {
  try {
    const shipId = req.query.shipId || 'SHIP001';
    const result = await weatherService.getTides(shipId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/ocean-currents ───────────────────────────────────────────────────
// Returns ocean current vectors along the active route / region grid.
router.get('/ocean-currents', async (req, res, next) => {
  try {
    const shipId = req.query.shipId || 'SHIP001';
    const result = await weatherService.getOceanCurrents(shipId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

