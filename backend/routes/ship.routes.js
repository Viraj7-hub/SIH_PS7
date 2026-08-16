'use strict';

/**
 * routes/ship.routes.js
 */

const router     = require('express').Router();
const controller = require('../controllers/ship.controller');
const weatherService = require('../services/weather.service');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');
const { validateCreateShip, validateUpdateShip } = require('../validators/ship.validator');
const { AppError } = require('../middleware/error.middleware');
const shipModel = require('../models/ship.model');

// GET /api/ships — public
router.get('/', controller.getAllShips);

// GET /api/ships/:shipId — public (ShipSelect + Dashboard)
router.get('/:shipId', controller.getShip);

// POST /api/ships — captain only
router.post('/', authenticateToken, requireRole('captain'), validateCreateShip, controller.createShip);

// PUT /api/ships/:shipId — captain only
router.put('/:shipId', authenticateToken, requireRole('captain'), validateUpdateShip, controller.updateShip);

// GET /api/ships/:shipId/position — public (Dashboard polls this every 5s)
router.get('/:shipId/position', async (req, res, next) => {
  try {
    const position = await weatherService.getLivePosition(req.params.shipId);
    if (!position) {
      throw new AppError('Ship position unavailable.', 'NOT_FOUND');
    }
    res.json({ success: true, data: position });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
