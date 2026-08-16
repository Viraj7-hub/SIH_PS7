'use strict';

/**
 * middleware/error.middleware.js
 * Centralised error handling. All errors must follow the shape:
 *   { success: false, message: string, code: string }
 *
 * NEVER expose stack traces, SQL errors, password hashes, or secrets in
 * production responses.
 */

const { env } = require('../config/env');

/**
 * Maps an error code string to an HTTP status code.
 */
const HTTP_STATUS = {
  VALIDATION_ERROR: 422,
  UNAUTHORIZED:     401,
  FORBIDDEN:        403,
  NOT_FOUND:        404,
  CONFLICT:         409,
  RATE_LIMITED:     429,
  INTERNAL_ERROR:   500,
  DB_ERROR:         500,
};

/**
 * Creates a standardised AppError that controllers/services can throw.
 */
class AppError extends Error {
  constructor(message, code = 'INTERNAL_ERROR', statusCode = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode || HTTP_STATUS[code] || 500;
  }
}

/**
 * 404 handler — mount AFTER all routes.
 */
function notFoundHandler(req, res, _next) {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found.`,
    code:    'NOT_FOUND',
  });
}

/**
 * Global error handler — mount LAST, after notFoundHandler.
 * express-validator ValidationError arrays are flattened into one message.
 */
function globalErrorHandler(err, req, res, _next) {
  // express-validator errors arrive as plain objects with .array()
  if (Array.isArray(err?.errors)) {
    return res.status(422).json({
      success: false,
      message: err.errors.map((e) => e.msg).join('; '),
      code:    'VALIDATION_ERROR',
    });
  }

  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const code       = isAppError ? err.code : 'INTERNAL_ERROR';
  const message    = isAppError ? err.message : 'An unexpected error occurred.';

  // Log full error in development only
  if (env.nodeEnv !== 'production') {
    console.error('[ERROR]', err);
  } else {
    console.error(`[ERROR] ${code}: ${message}`);
  }

  res.status(statusCode).json({ success: false, message, code });
}

module.exports = { AppError, notFoundHandler, globalErrorHandler, HTTP_STATUS };
