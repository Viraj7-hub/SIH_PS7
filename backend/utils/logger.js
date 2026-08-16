'use strict';

/**
 * utils/logger.js
 * ───────────────────────────────────────────────────────────────────
 * Structured JSON logger for the OceanRoute backend.
 *
 * Usage:
 *   const logger = require('./utils/logger');
 *   logger.info('Request received', { method: 'GET', endpoint: '/api/weather/SHIP001' });
 *   logger.warn('Cache miss', { lat: 18.9, lon: 72.8 });
 *   logger.error('External API failed', { provider: 'open-meteo', error: 'timeout' });
 *
 * Security: All log entries are scrubbed of sensitive fields before output.
 * NEVER log: passwords, password_hash, jwt_secret, api_key, authorization.
 */

// Fields that must never appear in log output.
const SCRUB_KEYS = new Set([
  'password', 'password_hash', 'passwordHash',
  'jwt_secret', 'jwtSecret', 'JWT_SECRET',
  'api_key', 'apiKey', 'API_KEY',
  'authorization', 'Authorization',
  'token', 'accessToken', 'refreshToken',
  'secret', 'privateKey',
]);

/**
 * Recursively scrub sensitive keys from an object before logging.
 * @param {*} obj
 * @param {number} depth — prevents infinite recursion on circular refs
 * @returns {*}
 */
function scrub(obj, depth = 0) {
  if (depth > 5 || obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((v) => scrub(v, depth + 1));

  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SCRUB_KEYS.has(k)) {
      result[k] = '[REDACTED]';
    } else {
      result[k] = scrub(v, depth + 1);
    }
  }
  return result;
}

/**
 * Emit a structured log line.
 * @param {'info'|'warn'|'error'} level
 * @param {string} msg
 * @param {Object} [meta]
 */
function log(level, msg, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    msg,
    ...scrub(meta),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

const logger = {
  info:  (msg, meta) => log('info',  msg, meta),
  warn:  (msg, meta) => log('warn',  msg, meta),
  error: (msg, meta) => log('error', msg, meta),
};

module.exports = logger;
