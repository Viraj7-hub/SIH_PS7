'use strict';

/**
 * middleware/requestLogger.middleware.js
 * ─────────────────────────────────────────────────────────────────────
 * Express middleware that emits one structured log line per request.
 *
 * Logged fields:
 *   method       — HTTP verb
 *   endpoint     — request path (without query string for brevity)
 *   statusCode   — response status
 *   responseTime — milliseconds from request start to response finish
 *   ip           — client IP (sanitized)
 *
 * Mount this BEFORE route modules in server.js.
 */

const logger = require('../utils/logger');

/**
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {Function} next
 */
function requestLogger(req, res, next) {
  const startMs = Date.now();

  res.on('finish', () => {
    const responseTime = Date.now() - startMs;
    const meta = {
      method:       req.method,
      endpoint:     req.path,
      statusCode:   res.statusCode,
      responseTime: `${responseTime}ms`,
    };

    if (res.statusCode >= 500) {
      logger.error('Request completed with server error', meta);
    } else if (res.statusCode >= 400) {
      logger.warn('Request completed with client error', meta);
    } else {
      logger.info('Request completed', meta);
    }
  });

  next();
}

module.exports = requestLogger;
