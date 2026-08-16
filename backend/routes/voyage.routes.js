'use strict';

/**
 * routes/voyage.routes.js
 */

const router     = require('express').Router();
const controller = require('../controllers/voyage.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { validateCreateVoyage, validateUpdateVoyageStatus } = require('../validators/voyage.validator');

// All voyage routes require authentication
router.use(authenticateToken);

// POST /api/voyages
router.post('/', validateCreateVoyage, controller.createVoyage);

// GET /api/voyages
router.get('/', controller.getVoyages);

// GET /api/voyages/:id
router.get('/:id', controller.getVoyage);

// PUT /api/voyages/:id/status
router.put('/:id/status', validateUpdateVoyageStatus, controller.updateVoyageStatus);

module.exports = router;
