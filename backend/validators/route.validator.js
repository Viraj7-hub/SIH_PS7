'use strict';

/**
 * validators/route.validator.js
 * Input validation for POST /api/routes/optimize
 * Uses express-validator (already in package.json).
 */

const { body, param } = require('express-validator');

const VALID_VESSEL_TYPES = [
  'Container Ship',
  'Bulk Carrier',
  'Tanker',
  'General Cargo',
  'Ro-Ro',
  'Passenger',
  'LNG Carrier',
  'Chemical Tanker',
  'Offshore Vessel',
];

const validateOptimizeRoute = [
  body('sourcePortId')
    .trim()
    .notEmpty()
    .withMessage('sourcePortId is required.')
    .isString()
    .withMessage('sourcePortId must be a string.'),

  body('destinationPortId')
    .trim()
    .notEmpty()
    .withMessage('destinationPortId is required.')
    .isString()
    .withMessage('destinationPortId must be a string.')
    .custom((value, { req }) => {
      if (value === req.body.sourcePortId) {
        throw new Error('sourcePortId and destinationPortId must be different.');
      }
      return true;
    }),

  // vessel block
  body('vessel')
    .optional()
    .isObject()
    .withMessage('vessel must be an object.'),

  body('vessel.maxSpeed')
    .optional()
    .isFloat({ min: 1, max: 40 })
    .withMessage('vessel.maxSpeed must be a number between 1 and 40 knots.'),

  body('vessel.draft')
    .optional()
    .isFloat({ min: 1, max: 30 })
    .withMessage('vessel.draft must be a number between 1 and 30 metres.'),

  body('vessel.type')
    .optional()
    .isIn(VALID_VESSEL_TYPES)
    .withMessage(`vessel.type must be one of: ${VALID_VESSEL_TYPES.join(', ')}.`),

  body('vessel.fuelConsumption')
    .optional()
    .isFloat({ min: 0.001, max: 1.0 })
    .withMessage('vessel.fuelConsumption must be a number between 0.001 and 1.0 tons/NM.'),

  // priorities block
  body('priorities')
    .optional()
    .isObject()
    .withMessage('priorities must be an object.'),

  body('priorities.fuel')
    .optional()
    .isBoolean()
    .withMessage('priorities.fuel must be a boolean.'),

  body('priorities.time')
    .optional()
    .isBoolean()
    .withMessage('priorities.time must be a boolean.'),

  body('priorities.safety')
    .optional()
    .isBoolean()
    .withMessage('priorities.safety must be a boolean.'),
];

const validateRouteId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Route ID must be a positive integer.'),
];

module.exports = { validateOptimizeRoute, validateRouteId };
