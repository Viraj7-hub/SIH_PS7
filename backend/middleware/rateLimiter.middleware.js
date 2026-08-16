'use strict';

/**
 * middleware/rateLimiter.middleware.js
 * Rate limiting to prevent brute-force attacks and API abuse.
 */

const rateLimit = require('express-rate-limit');

/**
 * Strict limiter for authentication endpoints.
 * 10 requests per 15 minutes per IP.
 */
const authLimiter = rateLimit({
  windowMs:         15 * 60 * 1000, // 15 minutes
  max:              10,
  standardHeaders:  true,
  legacyHeaders:    false,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again in 15 minutes.',
    code:    'RATE_LIMITED',
  },
  skipSuccessfulRequests: true, // Only count failed/non-2xx responses
});

/**
 * General API limiter.
 * 120 requests per minute per IP.
 */
const apiLimiter = rateLimit({
  windowMs:        60 * 1000, // 1 minute
  max:             120,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    message: 'Too many requests. Please slow down.',
    code:    'RATE_LIMITED',
  },
});

module.exports = { authLimiter, apiLimiter };
