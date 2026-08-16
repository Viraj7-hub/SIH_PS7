'use strict';

/**
 * middleware/auth.middleware.js
 * JWT authentication and role-based access control.
 *
 * The backend NEVER trusts the client's claimed role.
 * Role is read exclusively from the verified JWT payload.
 */

const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { AppError } = require('./error.middleware');

/**
 * Verifies the JWT from the Authorization: Bearer header.
 * On success, attaches { userId, role } to req.user.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return next(new AppError('Authentication token required.', 'UNAUTHORIZED'));
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = {
      userId: payload.userId,
      role:   payload.role,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Authentication token has expired.', 'UNAUTHORIZED'));
    }
    return next(new AppError('Invalid authentication token.', 'UNAUTHORIZED'));
  }
}

/**
 * Factory middleware — restricts a route to specific roles.
 * Must be used AFTER authenticateToken.
 *
 * @param {...string} roles - Allowed roles, e.g. 'captain'
 *
 * @example
 *   router.post('/ships', authenticateToken, requireRole('captain'), createShip);
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 'UNAUTHORIZED'));
    }
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(
          `Access denied. Required role: ${roles.join(' or ')}.`,
          'FORBIDDEN'
        )
      );
    }
    next();
  };
}

module.exports = { authenticateToken, requireRole };
