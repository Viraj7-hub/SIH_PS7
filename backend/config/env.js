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

// BE3 env vars that are optional — safe defaults are applied below.
// DEMO_MODE: enables deterministic ship position simulation (no live AIS needed).
// WEATHER_TTL_MINUTES: how long a weather observation cache entry stays valid.
// OCEAN_TTL_MINUTES: how long an ocean conditions snapshot stays valid.
// MARINE_WEATHER_TTL_MINUTES: TTL for the full marine-weather grid cache.
// OPEN_METEO_TIMEOUT_MS: per-request timeout when calling Open-Meteo APIs.
// OPEN_METEO_MAX_RETRIES: maximum number of retry attempts on transient failures.

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
    // ── BE3: Marine Intelligence ──────────────────────────────────────────
    // Demo mode: deterministic ship simulation — no live AIS required.
    demoMode: process.env.DEMO_MODE === 'true',
    // Cache TTLs (in minutes). These control how long data from Open-Meteo
    // is considered fresh before a new API call is made.
    weatherTtlMinutes:      parseInt(process.env.WEATHER_TTL_MINUTES,       10) || 30,
    oceanTtlMinutes:        parseInt(process.env.OCEAN_TTL_MINUTES,         10) || 15,
    marineWeatherTtlMinutes:parseInt(process.env.MARINE_WEATHER_TTL_MINUTES,10) || 30,
    // Open-Meteo resilience settings.
    openMeteoTimeoutMs:  parseInt(process.env.OPEN_METEO_TIMEOUT_MS,  10) || 15000,
    openMeteoMaxRetries: parseInt(process.env.OPEN_METEO_MAX_RETRIES, 10) || 3,
  },
};
