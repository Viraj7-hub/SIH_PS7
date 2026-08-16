'use strict';

/**
 * routes/route.routes.js
 * Mounts the Nautilus route optimization endpoints.
 *
 * POST /api/routes/optimize  — run full multi-objective optimization
 * GET  /api/routes/:id       — retrieve a saved route result
 */

const router = require('express').Router();
const routeController = require('../controllers/route.controller');
const { validateOptimizeRoute, validateRouteId } = require('../validators/route.validator');

router.post('/optimize', validateOptimizeRoute, routeController.optimizeRoute);
router.get('/:id',       validateRouteId,        routeController.getRoute);

module.exports = router;
