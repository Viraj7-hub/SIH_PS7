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

/**
 * Marine weather limiter — applied to GET /api/marine-weather.
 * 6 requests per minute per IP.
 *
 * Rationale: Each request may trigger 500+ Open-Meteo API calls if the
 * cache is cold. A bug in the frontend (e.g. missing cache) could hammer
 * Open-Meteo without this limit. 6 req/min = 1 every 10 seconds, which is
 * far more than a real user needs.
 */
const marineWeatherLimiter = rateLimit({
  windowMs:        60 * 1000, // 1 minute
  max:             6,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    message: 'Marine weather data is rate limited. Please wait before refreshing.',
    code:    'RATE_LIMITED',
  },
});

/**
 * Chat limiter — applied to POST /api/chat.
 * 30 requests per minute per IP.
 *
 * Rationale: Each chat request triggers multiple DB queries (voyage context).
 * A chatbot integration test or frontend bug should not be able to saturate
 * the database with context-building queries.
 */
const chatLimiter = rateLimit({
  windowMs:        60 * 1000, // 1 minute
  max:             30,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    message: 'Too many chat requests. Please wait a moment.',
    code:    'RATE_LIMITED',
  },
});

module.exports = { authLimiter, apiLimiter, marineWeatherLimiter, chatLimiter };
