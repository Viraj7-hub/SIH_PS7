'use strict';

/**
 * validators/ship.validator.js
 * express-validator rules for ship endpoints.
 */

const { body, param, validationResult } = require('express-validator');
const { AppError } = require('../middleware/error.middleware');

function handleValidation(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return next(new AppError(result.array().map((e) => e.msg).join('; '), 'VALIDATION_ERROR'));
  }
  next();
}

const validateCreateShip = [
  body('shipCode')
    .trim()
    .notEmpty().withMessage('shipCode is required.')
    .isAlphanumeric().withMessage('shipCode must be alphanumeric.')
    .isLength({ min: 3, max: 20 }).withMessage('shipCode must be 3–20 characters.'),
  body('name')
    .trim()
    .notEmpty().withMessage('Ship name is required.')
    .isLength({ max: 120 }).withMessage('Ship name must be ≤120 characters.'),
  body('type')
    .optional()
    .isLength({ max: 80 }).withMessage('Type must be ≤80 characters.'),
  body('maxSpeed')
    .optional()
    .isFloat({ min: 1, max: 50 }).withMessage('maxSpeed must be between 1 and 50 knots.'),
  body('draft')
    .optional()
    .isFloat({ min: 0.5, max: 30 }).withMessage('draft must be between 0.5 and 30 metres.'),
  body('fuelConsumption')
    .optional()
    .isFloat({ min: 0 }).withMessage('fuelConsumption must be a positive number.'),
  handleValidation,
];

const validateUpdateShip = [
  body('name').optional().trim().isLength({ min: 1, max: 120 }).withMessage('Invalid name.'),
  body('status').optional().isIn(['active', 'inactive', 'maintenance']).withMessage('Invalid status.'),
  body('maxSpeed').optional().isFloat({ min: 1, max: 50 }).withMessage('Invalid maxSpeed.'),
  body('draft').optional().isFloat({ min: 0.5, max: 30 }).withMessage('Invalid draft.'),
  handleValidation,
];

module.exports = { validateCreateShip, validateUpdateShip };
