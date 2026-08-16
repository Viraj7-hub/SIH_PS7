'use strict';

/**
 * routes/auth.routes.js
 */

const router     = require('express').Router();
const controller = require('../controllers/auth.controller');
const { validateRegister, validateLogin } = require('../validators/auth.validator');
const { authenticateToken } = require('../middleware/auth.middleware');
const { authLimiter } = require('../middleware/rateLimiter.middleware');

// POST /api/auth/register
router.post('/register', authLimiter, validateRegister, controller.register);

// POST /api/auth/login
router.post('/login', authLimiter, validateLogin, controller.login);

// GET /api/auth/me  (requires valid JWT)
router.get('/me', authenticateToken, controller.getMe);

module.exports = router;
