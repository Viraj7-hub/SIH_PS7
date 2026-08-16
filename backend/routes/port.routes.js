'use strict';

/**
 * routes/port.routes.js
 * IMPORTANT: /search and /country/:country must be registered BEFORE /:id
 * to avoid Express treating 'search' as an id parameter.
 */

const router     = require('express').Router();
const controller = require('../controllers/port.controller');

// GET /api/ports
router.get('/', controller.getAllPorts);

// GET /api/ports/search?q=mumbai
router.get('/search', controller.searchPorts);

// GET /api/ports/country/India
router.get('/country/:country', controller.getPortsByCountry);

// GET /api/ports/in-mum
router.get('/:id', controller.getPort);

module.exports = router;
