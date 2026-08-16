'use strict';

/**
 * controllers/auth.controller.js
 * Thin handler layer — delegates all logic to auth.service.js
 */

const authService = require('../services/auth.service');

async function register(req, res, next) {
  try {
    const { name, email, password, role = 'crew' } = req.body;
    const user = await authService.register({ name, email, password, role });
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const user = await authService.getMe(req.user.userId);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, getMe };
