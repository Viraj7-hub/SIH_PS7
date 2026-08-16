'use strict';

/**
 * config/env.js
 * Validates required environment variables at startup.
 * The process exits immediately with a clear error if any required var is missing.
 */

const REQUIRED = [
  'DB_HOST',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_SECRET',
  'CLIENT_URL',
];

function validateEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(
      `[ENV] Fatal: missing required environment variables:\n  ${missing.join('\n  ')}\n` +
      `Copy backend/.env.example to backend/.env and fill in the values.`
    );
    process.exit(1);
  }
}

module.exports = {
  validateEnv,
  env: {
    port:         parseInt(process.env.PORT, 10) || 5005,
    nodeEnv:      process.env.NODE_ENV || 'development',
    jwtSecret:    process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    clientUrl:    process.env.CLIENT_URL,
    db: {
      host:     process.env.DB_HOST,
      port:     parseInt(process.env.DB_PORT, 10) || 3306,
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    },
  },
};
