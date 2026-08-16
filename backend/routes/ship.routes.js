'use strict';

/**
 * routes/ship.routes.js
 * Updated to use positionService for GET/POST /:shipId/position.
 */

const router          = require('express').Router();
const controller      = require('../controllers/ship.controller');
const positionService = require('../services/position.service');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');
const { validateCreateShip, validateUpdateShip } = require('../validators/ship.validator');
const { AppError }    = require('../middleware/error.middleware');
const shipModel       = require('../models/ship.model');

// GET /api/ships — public
router.get('/', controller.getAllShips);

// GET /api/ships/:shipId — public (ShipSelect + Dashboard)
router.get('/:shipId', controller.getShip);

// POST /api/ships — captain only
router.post('/', authenticateToken, requireRole('captain'), validateCreateShip, controller.createShip);

// PUT /api/ships/:shipId — captain only
router.put('/:shipId', authenticateToken, requireRole('captain'), validateUpdateShip, controller.updateShip);

// ── GET /api/ships/:shipId/position ──────────────────────────────────────────
// Frontend Dashboard polls this every 5 seconds.
// Returns the live (or demo-simulated) position.
router.get('/:shipId/position', async (req, res, next) => {
  try {
    const position = await positionService.getLatestPosition(req.params.shipId);
    if (!position) {
      throw new AppError('Ship position unavailable.', 'NOT_FOUND');
    }
    res.json({ success: true, data: position });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/ships/:shipId/position ─────────────────────────────────────────
// Record a new ship position (AIS update, manual entry, or integration).
// In DEMO_MODE this is a no-op that returns the simulated position.
//
// Body: { lat, lon, speed, heading }
router.post('/:shipId/position', async (req, res, next) => {
  try {
    const { lat, lon, speed, heading } = req.body || {};

    if (lat == null || lon == null) {
      throw new AppError('lat and lon are required.', 'VALIDATION_ERROR');
    }

    const position = await positionService.recordPosition(req.params.shipId, {
      lat:     parseFloat(lat),
      lon:     parseFloat(lon),
      speed:   speed   != null ? parseFloat(speed)   : null,
      heading: heading != null ? parseFloat(heading) : null,
    });

    res.status(201).json({ success: true, data: position });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
