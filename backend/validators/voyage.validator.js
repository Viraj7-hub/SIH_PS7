'use strict';

/**
 * validators/voyage.validator.js
 * express-validator rules for voyage endpoints.
 */

const { body, validationResult } = require('express-validator');
const { AppError } = require('../middleware/error.middleware');
const { VALID_STATUSES } = require('../models/voyage.model');

function handleValidation(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return next(new AppError(result.array().map((e) => e.msg).join('; '), 'VALIDATION_ERROR'));
  }
  next();
}

const validateCreateVoyage = [
  body('shipCode')
    .trim()
    .notEmpty().withMessage('shipCode is required.'),
  body('sourcePortId')
    .trim()
    .notEmpty().withMessage('sourcePortId is required.'),
  body('destPortId')
    .trim()
    .notEmpty().withMessage('destPortId is required.'),
  body('plannedEta')
    .optional({ nullable: true })
    .isISO8601().withMessage('plannedEta must be a valid ISO 8601 datetime.'),
  body('notes')
    .optional({ nullable: true })
    .isLength({ max: 1000 }).withMessage('Notes must be ≤1000 characters.'),
  handleValidation,
];

const validateUpdateVoyageStatus = [
  body('status')
    .notEmpty().withMessage('status is required.')
    .isIn(VALID_STATUSES).withMessage(`status must be one of: ${VALID_STATUSES.join(', ')}`),
  handleValidation,
];

module.exports = { validateCreateVoyage, validateUpdateVoyageStatus };
