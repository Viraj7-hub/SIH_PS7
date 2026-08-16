'use strict';

/**
 * services/cache.service.js
 * ═══════════════════════════════════════════════════════════════════
 * MySQL-backed cache layer for weather observations and ocean conditions.
 *
 * All cache reads check the `valid_until` column (or `observed_at` + TTL).
 * All cache writes store normalized data in the same tables that serve
 * the rest of the application.
 *
 * Cache keys:
 *   Weather observations  → (lat rounded to 0.5°, lon rounded to 0.5°)
 *   Ocean conditions      → ship_id (latest row within TTL)
 */

const { pool } = require('../config/db');
const { env }  = require('../config/env');
const logger   = require('../utils/logger');

// ── Coordinate rounding ───────────────────────────────────────────────────────

/**
 * Round a coordinate to the nearest 0.5 degree for cache key alignment.
 * This prevents near-identical points from bypassing the cache.
 * @param {number} v
 * @returns {number}
 */
function roundCoord(v) {
  return Math.round(v * 2) / 2;
}

// ── Weather Cache ─────────────────────────────────────────────────────────────

/**
 * Fetch the most recent valid weather observation for a lat/lon.
 * Returns null if no valid (non-stale) row exists.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {number} [ttlMinutes] — override env default
 * @returns {Promise<Object|null>}
 */
async function getWeatherCache(lat, lon, ttlMinutes) {
  const ttl    = ttlMinutes ?? env.weatherTtlMinutes;
  const rLat   = roundCoord(lat);
  const rLon   = roundCoord(lon);

  try {
    const [rows] = await pool.execute(
      `SELECT *
       FROM weather_observations
       WHERE latitude  = ? AND longitude = ?
         AND observed_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
       ORDER BY observed_at DESC
       LIMIT 1`,
      [rLat, rLon, ttl]
    );
    if (rows[0]) {
      logger.info('Weather cache hit', { lat: rLat, lon: rLon });
      return rows[0];
    }
    return null;
  } catch (err) {
    logger.warn('Weather cache read failed', { error: err.message, lat: rLat, lon: rLon });
    return null;
  }
}

/**
 * Store a normalized weather observation in the cache table.
 * Uses INSERT (not upsert) — old rows are retained for historical queries.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {Object} data — normalized weather point from marine.service
 * @returns {Promise<void>}
 */
async function setWeatherCache(lat, lon, data) {
  const rLat = roundCoord(lat);
  const rLon = roundCoord(lon);

  try {
    await pool.execute(
      `INSERT INTO weather_observations
         (latitude, longitude,
          wave_height, wave_direction, wave_period,
          wind_speed, wind_direction, wind_gusts,
          swell_height, swell_direction,
          current_speed, current_dir,
          sea_temp, pressure_msl, cloud_cover,
          precipitation, weather_code, risk_score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rLat, rLon,
        data.waveHeight       ?? null,
        data.waveDirection    ?? null,
        data.wavePeriod       ?? null,
        data.windSpeed        ?? null,
        data.windDirection    ?? null,
        data.windGusts        ?? null,
        data.swellHeight      ?? null,
        data.swellDirection   ?? null,
        data.currentSpeed     ?? null,
        data.currentDirection ?? null,
        data.seaTemperature   ?? null,
        data.pressure         ?? null,
        data.cloudCover       ?? null,
        data.precipitation    ?? null,
        data.weatherCode      ?? null,
        data.riskScore        ?? null,
      ]
    );
    logger.info('Weather cache stored', { lat: rLat, lon: rLon });
  } catch (err) {
    // Cache write failure must never crash the request
    logger.warn('Weather cache write failed', { error: err.message, lat: rLat, lon: rLon });
  }
}

/**
 * Fetch the most recent stale weather observation (used for fallback).
 * No TTL constraint — returns whatever is newest.
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<Object|null>}
 */
async function getStaleWeatherCache(lat, lon) {
  const rLat = roundCoord(lat);
  const rLon = roundCoord(lon);

  try {
    const [rows] = await pool.execute(
      `SELECT * FROM weather_observations
       WHERE latitude = ? AND longitude = ?
       ORDER BY observed_at DESC LIMIT 1`,
      [rLat, rLon]
    );
    return rows[0] || null;
  } catch (err) {
    logger.warn('Stale weather cache read failed', { error: err.message });
    return null;
  }
}

// ── Ocean Cache ───────────────────────────────────────────────────────────────

/**
 * Fetch the most recent valid ocean conditions snapshot for a ship.
 *
 * @param {number} shipId — internal ship.id (not ship_code)
 * @param {number} [ttlMinutes]
 * @returns {Promise<Object|null>}
 */
async function getOceanCache(shipId, ttlMinutes) {
  const ttl = ttlMinutes ?? env.oceanTtlMinutes;

  try {
    const [rows] = await pool.execute(
      `SELECT *
       FROM ocean_conditions
       WHERE ship_id = ?
         AND observed_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
       ORDER BY observed_at DESC
       LIMIT 1`,
      [shipId, ttl]
    );
    if (rows[0]) {
      logger.info('Ocean cache hit', { shipId });
      return rows[0];
    }
    return null;
  } catch (err) {
    logger.warn('Ocean cache read failed', { error: err.message, shipId });
    return null;
  }
}

/**
 * Store an ocean conditions snapshot.
 *
 * @param {number} shipId
 * @param {Object} data
 * @returns {Promise<void>}
 */
async function setOceanCache(shipId, data) {
  try {
    await pool.execute(
      `INSERT INTO ocean_conditions
         (ship_id, wave_height, current_speed, current_direction, sea_temperature, sea_level)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        shipId,
        data.waveHeight       ?? null,
        data.currentSpeed     ?? null,
        data.currentDirection ?? null,
        data.seaTemperature   ?? null,
        data.seaLevel         ?? null,
      ]
    );
    logger.info('Ocean cache stored', { shipId });
  } catch (err) {
    logger.warn('Ocean cache write failed', { error: err.message, shipId });
  }
}

/**
 * Fetch the most recent stale ocean snapshot (fallback, no TTL).
 * @param {number} shipId
 * @returns {Promise<Object|null>}
 */
async function getStaleOceanCache(shipId) {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM ocean_conditions WHERE ship_id = ? ORDER BY observed_at DESC LIMIT 1`,
      [shipId]
    );
    return rows[0] || null;
  } catch (err) {
    logger.warn('Stale ocean cache read failed', { error: err.message, shipId });
    return null;
  }
}

// ── Housekeeping ──────────────────────────────────────────────────────────────

/**
 * Delete weather observations older than `maxAgeDays` days.
 * Call this on startup or via a scheduled job.
 * @param {number} [maxAgeDays=7]
 * @returns {Promise<number>} rows deleted
 */
async function purgeExpiredCache(maxAgeDays = 7) {
  try {
    const [result] = await pool.execute(
      `DELETE FROM weather_observations WHERE observed_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [maxAgeDays]
    );
    if (result.affectedRows > 0) {
      logger.info('Cache purge completed', { rowsDeleted: result.affectedRows, maxAgeDays });
    }
    return result.affectedRows;
  } catch (err) {
    logger.warn('Cache purge failed', { error: err.message });
    return 0;
  }
}

module.exports = {
  getWeatherCache,
  setWeatherCache,
  getStaleWeatherCache,
  getOceanCache,
  setOceanCache,
  getStaleOceanCache,
  purgeExpiredCache,
  roundCoord,
};
