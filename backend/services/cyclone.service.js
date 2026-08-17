'use strict';

/**
 * services/cyclone.service.js
 * ═══════════════════════════════════════════════════════════════════
 * Cyclone / Storm Hazard Service
 * ═══════════════════════════════════════════════════════════════════
 *
 * Data source: MySQL `cyclones` table (is_active = 1).
 *
 * Future live-data integration point:
 *   If a real-time cyclone API becomes available, replace the
 *   `syncFromLiveSource()` stub below with a real HTTP call and
 *   call it from a scheduled job (e.g. every 15 minutes).
 *   The rest of the service (queries, routing) needs no changes.
 *
 * Public API:
 *   getActiveCyclones()            → Array<CycloneRecord>
 *   getCycloneById(id)             → CycloneRecord | null
 *   getCyclonesNearRoute(waypoints) → Array<{ cyclone, distanceNM }>
 *   upsertCyclone(data)            → CycloneRecord
 *
 * CycloneRecord shape:
 * {
 *   id, name, latitude, longitude, radiusKm, windSpeed,
 *   pressureHpa, category, riskScore, isActive,
 *   detectedAt, updatedAt
 * }
 */

const { pool }  = require('../config/db');
const { AppError } = require('../middleware/error.middleware');
const { haversineNM } = require('./risk.service');
const logger    = require('../utils/logger');

// How close a cyclone must be to a route point to be "near" it (NM).
const NEAR_ROUTE_THRESHOLD_NM = 300;

// ── Row normalizer ─────────────────────────────────────────────────────────────

/**
 * Map a raw DB row into the frontend-facing CycloneRecord shape.
 * @param {Object} row
 * @returns {Object}
 */
function toRecord(row) {
  return {
    id:          row.id,
    name:        row.name,
    latitude:    parseFloat(row.latitude),
    longitude:   parseFloat(row.longitude),
    radiusKm:    parseFloat(row.radius_km),
    windSpeed:   row.wind_speed  != null ? parseFloat(row.wind_speed)  : null,
    pressureHpa: row.pressure_hpa != null ? parseFloat(row.pressure_hpa) : null,
    category:    row.category   ?? null,
    riskScore:   row.risk_score,
    isActive:    Boolean(row.is_active),
    detectedAt:  row.detected_at,
    updatedAt:   row.updated_at,
    // Legacy fields expected by Dashboard.jsx
    lat:         parseFloat(row.latitude),
    lon:         parseFloat(row.longitude),
    risk:        row.risk_score,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Get all currently active cyclones from the database.
 * @returns {Promise<Array<Object>>}
 */
async function getActiveCyclones() {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM cyclones WHERE is_active = 1 ORDER BY risk_score DESC`
    );
    logger.info('Cyclone query completed', { count: rows.length });
    return rows.map(toRecord);
  } catch (err) {
    logger.error('Failed to fetch active cyclones', { error: err.message });
    throw new AppError('Cyclone data temporarily unavailable.', 'INTERNAL_ERROR');
  }
}

/**
 * Get a single cyclone by its internal ID.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function getCycloneById(id) {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM cyclones WHERE id = ? LIMIT 1`,
      [id]
    );
    return rows[0] ? toRecord(rows[0]) : null;
  } catch (err) {
    logger.error('Failed to fetch cyclone by id', { error: err.message, id });
    throw new AppError('Cyclone data temporarily unavailable.', 'INTERNAL_ERROR');
  }
}

/**
 * Find active cyclones that are within NEAR_ROUTE_THRESHOLD_NM of any
 * point along the provided route.
 *
 * @param {Array<{lat:number, lon:number}|[number,number]>} waypoints
 * @returns {Promise<Array<{ cyclone: Object, distanceNM: number, nearestWaypointIndex: number }>>}
 */
async function getCyclonesNearRoute(waypoints) {
  if (!waypoints || waypoints.length === 0) return [];

  // Normalize waypoint shapes: accept both { lat, lon } and [lat, lon]
  const pts = waypoints.map((wp) =>
    Array.isArray(wp) ? { lat: wp[0], lon: wp[1] } : wp
  );

  const cyclones = await getActiveCyclones();
  if (cyclones.length === 0) return [];

  const threats = [];

  for (const cyclone of cyclones) {
    let minDist = Infinity;
    let minIdx  = 0;

    for (let i = 0; i < pts.length; i++) {
      const dist = haversineNM(pts[i].lat, pts[i].lon, cyclone.latitude, cyclone.longitude);
      if (dist < minDist) {
        minDist = dist;
        minIdx  = i;
      }
    }

    if (minDist <= NEAR_ROUTE_THRESHOLD_NM) {
      threats.push({
        cyclone,
        distanceNM:            Math.round(minDist),
        nearestWaypointIndex:  minIdx,
      });
    }
  }

  threats.sort((a, b) => a.distanceNM - b.distanceNM);
  logger.info('Cyclone near-route check', {
    waypointCount: pts.length,
    threatsFound:  threats.length,
  });
  return threats;
}

/**
 * Insert or update a cyclone record (for admin/testing use).
 * If `id` is provided, updates the existing row; otherwise inserts.
 *
 * @param {Object} data
 * @returns {Promise<Object>} the saved CycloneRecord
 */
async function upsertCyclone(data) {
  const {
    id = null,
    name, latitude, longitude,
    radiusKm = 150,
    windSpeed = null, pressureHpa = null,
    category = null,
    riskScore = 0,
    isActive = true,
  } = data;

  if (!name || latitude == null || longitude == null) {
    throw new AppError('Cyclone name, latitude, and longitude are required.', 'VALIDATION_ERROR');
  }

  if (id) {
    await pool.execute(
      `UPDATE cyclones
       SET name=?, latitude=?, longitude=?, radius_km=?,
           wind_speed=?, pressure_hpa=?, category=?,
           risk_score=?, is_active=?
       WHERE id=?`,
      [name, latitude, longitude, radiusKm, windSpeed, pressureHpa, category, riskScore, isActive ? 1 : 0, id]
    );
    return getCycloneById(id);
  }

  const [result] = await pool.execute(
    `INSERT INTO cyclones
       (name, latitude, longitude, radius_km, wind_speed, pressure_hpa, category, risk_score, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, latitude, longitude, radiusKm, windSpeed, pressureHpa, category, riskScore, isActive ? 1 : 0]
  );
  return getCycloneById(result.insertId);
}

/**
 * Deactivate all cyclones older than `maxAgeDays` days.
 * Call from a maintenance job to keep the table clean.
 * @param {number} [maxAgeDays=3]
 */
async function deactivateExpiredCyclones(maxAgeDays = 3) {
  try {
    const [result] = await pool.execute(
      `UPDATE cyclones SET is_active = 0
       WHERE is_active = 1 AND detected_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [maxAgeDays]
    );
    if (result.affectedRows > 0) {
      logger.info('Expired cyclones deactivated', { count: result.affectedRows });
    }
  } catch (err) {
    logger.warn('Cyclone expiry job failed', { error: err.message });
  }
}

/**
 * Synchronize real-time tropical cyclones from GDACS (Global Disaster Alert & Coordination System).
 * Automatically updates active cyclone records in MySQL.
 *
 * @returns {Promise<void>}
 */
async function syncFromLiveSource() {
  try {
    const signal = AbortSignal.timeout(10000);
    const res = await fetch('https://www.gdacs.org/gdacsapi/api/events/geteventlist/GDACS?eventtypes=TC', { signal });
    if (!res.ok) {
      logger.warn('GDACS cyclone API returned non-OK status', { status: res.status });
      return;
    }
    const data = await res.json();
    const features = data?.features || [];

    for (const feat of features) {
      const props = feat.properties || {};
      const coords = feat.geometry?.coordinates;
      if (!coords || coords.length < 2) continue;

      const lon = parseFloat(coords[0]);
      const lat = parseFloat(coords[1]);
      const name = props.eventname || props.name || 'Tropical Cyclone';
      const windSpeed = props.windspeed ? parseFloat(props.windspeed) : null;
      const pressureHpa = props.severitydata?.severity ? parseFloat(props.severitydata.severity) : null;
      const alertLevel = props.alertlevel || 'Green';
      const riskScore = alertLevel === 'Red' ? 85 : alertLevel === 'Orange' ? 65 : 45;

      await upsertCyclone({
        name,
        latitude: lat,
        longitude: lon,
        radiusKm: 180,
        windSpeed,
        pressureHpa,
        category: props.eventlevel || 1,
        riskScore,
        isActive: true,
      });
    }

    await deactivateExpiredCyclones(3);
    logger.info('Live GDACS cyclone sync completed', { count: features.length });
  } catch (err) {
    logger.warn('Live cyclone API sync unavailable, using database records', { error: err.message });
  }
}

module.exports = {
  getActiveCyclones,
  getCycloneById,
  getCyclonesNearRoute,
  upsertCyclone,
  deactivateExpiredCyclones,
  syncFromLiveSource,
  NEAR_ROUTE_THRESHOLD_NM,
};
