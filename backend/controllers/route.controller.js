'use strict';

/**
 * controllers/route.controller.js
 * HTTP layer for the Nautilus Route Intelligence Engine.
 *
 * Endpoints handled:
 *   POST /api/routes/optimize  → optimizeRoute()
 *   GET  /api/routes/:id       → getRoute()
 */

const { validationResult } = require('express-validator');
const routeService = require('../services/route.service');
const { AppError } = require('../middleware/error.middleware');

/**
 * POST /api/routes/optimize
 *
 * Full multi-objective route optimization.
 * Returns standardRoute, optimizedRoute, metrics, algorithm, explanation.
 */
async function optimizeRoute(req, res, next) {
  try {
    // Check express-validator results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        message: errors.array().map((e) => e.msg).join('; '),
        code:    'VALIDATION_ERROR',
      });
    }

    const {
      sourcePortId,
      destinationPortId,
      vessel    = {},
      priorities = {},
    } = req.body;

    const data = await routeService.optimizeNautilusRoute({
      sourcePortId,
      destinationPortId,
      vessel,
      priorities,
    });

    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/routes/:id
 *
 * Retrieve a previously saved route result.
 */
async function getRoute(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        message: errors.array().map((e) => e.msg).join('; '),
        code:    'VALIDATION_ERROR',
      });
    }

    const result = await routeService.getRouteById(parseInt(req.params.id, 10));
    if (!result) {
      throw new AppError('Route result not found.', 'NOT_FOUND');
    }

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { optimizeRoute, getRoute };
