'use strict';

/**
 * validators/auth.validator.js
 * express-validator rules for auth endpoints.
 */

const { body, validationResult } = require('express-validator');
const { AppError } = require('../middleware/error.middleware');

/**
 * Run validation chain and forward errors to the global error handler.
 */
function handleValidation(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const err = new AppError(
      result.array().map((e) => e.msg).join('; '),
      'VALIDATION_ERROR'
    );
    return next(err);
  }
  next();
}

const validateRegister = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required.')
    .isLength({ min: 2, max: 120 }).withMessage('Name must be 2–120 characters.'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('Invalid email address.')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required.')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
  body('role')
    .optional()
    .isIn(['captain', 'crew']).withMessage("Role must be 'captain' or 'crew'."),
  handleValidation,
];

const validateLogin = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('Invalid email address.')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required.'),
  handleValidation,
];

module.exports = { validateRegister, validateLogin };
