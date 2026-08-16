'use strict';

/**
 * services/position.service.js
 * ═══════════════════════════════════════════════════════════════════
 * Live Ship Position Service
 * ═══════════════════════════════════════════════════════════════════
 *
 * Responsibilities:
 *   - Read the latest ship position from ship_positions table
 *   - Record a new position (with full input validation)
 *   - Provide a deterministic demo simulation when DEMO_MODE=true
 *
 * Demo Simulation:
 *   When env.demoMode is true, ship positions are computed
 *   deterministically from:
 *     - The ship's source and destination port coordinates
 *     - A fixed set of intermediate waypoints (per route)
 *     - The ship's speed (max_speed from ships table)
 *     - The server startup time (used as voyage start time)
 *
 *   The simulation advances linearly along the waypoint list.
 *   Speed and heading are interpolated between waypoints.
 *   NO Math.random() is used anywhere.
 *
 * Coordinate Validation:
 *   lat  ∈ [-90, 90]
 *   lon  ∈ [-180, 180]
 *   speed >= 0
 *   heading ∈ [0, 360]
 */

const { pool }     = require('../config/db');
const { env }      = require('../config/env');
const { AppError } = require('../middleware/error.middleware');
const shipModel    = require('../models/ship.model');
const { haversineNM } = require('./risk.service');
const logger       = require('../utils/logger');

// ── Server start time — used as the voyage simulation anchor ──────────────────
const SERVER_START = Date.now();

// ── Demo route waypoints ───────────────────────────────────────────────────────
// Pre-computed waypoints for known ship routes.
// These match the Mumbai → Colombo optimized route from the route engine.
// Key: `${sourcePortId}→${destPortId}`
const DEMO_WAYPOINTS = {
  'in-mum→lk-col': [
    { lat: 18.9388, lon: 72.8354 },   // Mumbai Port (departure)
    { lat: 17.50,   lon: 73.50 },
    { lat: 16.00,   lon: 74.20 },
    { lat: 14.00,   lon: 74.80 },
    { lat: 12.00,   lon: 75.50 },
    { lat: 10.00,   lon: 76.50 },
    { lat:  8.50,   lon: 77.80 },
    { lat:  7.50,   lon: 78.80 },
    { lat:  6.94,   lon: 79.84 },     // Colombo Port (arrival)
  ],
  'in-mum→lk-ham': [
    { lat: 18.9388, lon: 72.8354 },
    { lat: 16.00,   lon: 73.50 },
    { lat: 13.00,   lon: 75.50 },
    { lat: 10.00,   lon: 77.00 },
    { lat:  7.50,   lon: 79.00 },
    { lat:  6.12,   lon: 81.10 },     // Hambantota
  ],
};

// Default waypoints if ship's port pair is not in the lookup
const DEFAULT_DEMO_WAYPOINTS = [
  { lat: 18.9388, lon: 72.8354 },
  { lat: 15.00,   lon: 74.50 },
  { lat: 10.00,   lon: 77.00 },
  { lat:  6.94,   lon: 79.84 },
];

// ── Validation ─────────────────────────────────────────────────────────────────

/**
 * Validate ship position fields.
 * Throws AppError (VALIDATION_ERROR) on invalid input.
 *
 * @param {{ lat, lon, speed, heading }} coords
 */
function validateCoordinates({ lat, lon, speed, heading }) {
  const errors = [];

  if (lat == null || typeof lat !== 'number' || isNaN(lat) || lat < -90  || lat > 90) {
    errors.push('latitude must be a number between -90 and 90');
  }
  if (lon == null || typeof lon !== 'number' || isNaN(lon) || lon < -180 || lon > 180) {
    errors.push('longitude must be a number between -180 and 180');
  }
  if (speed != null && (typeof speed !== 'number' || isNaN(speed) || speed < 0)) {
    errors.push('speed must be a non-negative number');
  }
  if (heading != null && (typeof heading !== 'number' || isNaN(heading) || heading < 0 || heading > 360)) {
    errors.push('heading must be a number between 0 and 360');
  }

  if (errors.length > 0) {
    throw new AppError(`Invalid position data: ${errors.join('; ')}`, 'VALIDATION_ERROR');
  }
}

// ── Demo simulation ────────────────────────────────────────────────────────────

/**
 * Compute the current simulated position for a ship using a linear
 * interpolation along its pre-defined route waypoints.
 *
 * Position is fully deterministic: given the same server start time,
 * it will produce the same result. No random numbers are used.
 *
 * @param {Object} ship — DB ship row (from shipModel.findByShipCode)
 * @returns {{ lat, lon, speed, heading, simulated: true }}
 */
function computeDemoPosition(ship) {
  const routeKey  = `${ship.source_port_id}→${ship.dest_port_id}`;
  const waypoints = DEMO_WAYPOINTS[routeKey] || DEFAULT_DEMO_WAYPOINTS;

  const speedKn    = parseFloat(ship.current_speed || ship.max_speed) || 14;
  const speedNmMin = speedKn / 60; // knots → NM per minute

  // Total route distance
  let totalDistNM = 0;
  const segmentDistances = [];
  for (let i = 1; i < waypoints.length; i++) {
    const d = haversineNM(
      waypoints[i - 1].lat, waypoints[i - 1].lon,
      waypoints[i].lat,     waypoints[i].lon
    );
    segmentDistances.push(d);
    totalDistNM += d;
  }

  // How far has the ship travelled since server start?
  const elapsedMin = (Date.now() - SERVER_START) / 60000;
  let travelledNM  = (elapsedMin * speedNmMin) % totalDistNM; // loop for demo

  // Walk along segments to find current position
  let segIdx = 0;
  for (let i = 0; i < segmentDistances.length; i++) {
    if (travelledNM <= segmentDistances[i]) {
      segIdx = i;
      break;
    }
    travelledNM -= segmentDistances[i];
    segIdx = Math.min(i + 1, segmentDistances.length - 1);
  }

  const from   = waypoints[segIdx];
  const to     = waypoints[Math.min(segIdx + 1, waypoints.length - 1)];
  const segLen = segmentDistances[segIdx] || 1;
  const frac   = Math.min(1, travelledNM / segLen);

  const lat = from.lat + frac * (to.lat - from.lat);
  const lon = from.lon + frac * (to.lon - from.lon);

  // Bearing from current segment
  const dLat = (to.lat - from.lat) * (Math.PI / 180);
  const dLon = (to.lon - from.lon) * (Math.PI / 180);
  const y    = Math.sin(dLon) * Math.cos(to.lat * (Math.PI / 180));
  const x    = Math.cos(from.lat * (Math.PI / 180)) * Math.sin(to.lat * (Math.PI / 180)) -
               Math.sin(from.lat * (Math.PI / 180)) * Math.cos(to.lat * (Math.PI / 180)) * Math.cos(dLon);
  let heading = (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;

  return {
    lat:       parseFloat(lat.toFixed(6)),
    lon:       parseFloat(lon.toFixed(6)),
    speed:     speedKn,
    heading:   parseFloat(heading.toFixed(1)),
    simulated: true,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Get the latest known position for a ship.
 * Returns demo simulation position when DEMO_MODE is enabled.
 *
 * @param {string} shipCode — e.g. 'SHIP001'
 * @returns {Promise<{ shipId, lat, lon, speed, heading, simulated? }>}
 */
async function getLatestPosition(shipCode) {
  const ship = await shipModel.findByShipCode(shipCode.toUpperCase());
  if (!ship) return null;

  // Demo mode: compute deterministic position
  if (env.demoMode) {
    const pos = computeDemoPosition(ship);
    logger.info('Demo position computed', { shipCode, lat: pos.lat, lon: pos.lon });
    return { shipId: shipCode, ...pos };
  }

  // Real mode: query ship_positions table
  try {
    const [rows] = await pool.execute(
      `SELECT latitude, longitude, speed, heading, recorded_at
       FROM ship_positions
       WHERE ship_id = ?
       ORDER BY recorded_at DESC
       LIMIT 1`,
      [ship.id]
    );

    if (rows[0]) {
      return {
        shipId:  shipCode,
        lat:     parseFloat(rows[0].latitude),
        lon:     parseFloat(rows[0].longitude),
        speed:   parseFloat(rows[0].speed)   || parseFloat(ship.current_speed)  || 0,
        heading: parseFloat(rows[0].heading) || parseFloat(ship.current_heading) || 0,
        recordedAt: rows[0].recorded_at,
      };
    }
  } catch (err) {
    logger.warn('ship_positions query failed, falling back to ships table', { error: err.message, shipCode });
  }

  // Fallback to ships table current_lat/lon
  if (ship.current_lat != null) {
    return {
      shipId:  shipCode,
      lat:     parseFloat(ship.current_lat),
      lon:     parseFloat(ship.current_lon),
      speed:   parseFloat(ship.current_speed)   || 0,
      heading: parseFloat(ship.current_heading) || 0,
    };
  }

  return null;
}

/**
 * Record a new ship position.
 * Validates all inputs before writing to DB.
 * In DEMO_MODE, this is a no-op that returns the current simulated position.
 *
 * @param {string} shipCode
 * @param {{ lat, lon, speed, heading }} posData
 * @returns {Promise<Object>} the recorded or simulated position
 */
async function recordPosition(shipCode, posData) {
  const ship = await shipModel.findByShipCode(shipCode.toUpperCase());
  if (!ship) throw new AppError(`Ship '${shipCode}' not found.`, 'NOT_FOUND');

  const lat     = typeof posData.lat === 'string' ? parseFloat(posData.lat) : posData.lat;
  const lon     = typeof posData.lon === 'string' ? parseFloat(posData.lon) : posData.lon;
  const speed   = posData.speed   != null ? parseFloat(posData.speed)   : null;
  const heading = posData.heading != null ? parseFloat(posData.heading) : null;

  // Always validate, even in demo mode (rejects impossible coordinates)
  validateCoordinates({ lat, lon, speed, heading });

  // In demo mode, don't persist; return the simulated position
  if (env.demoMode) {
    logger.info('DEMO_MODE: position write ignored, returning simulated position', { shipCode });
    return getLatestPosition(shipCode);
  }

  await pool.execute(
    `INSERT INTO ship_positions (ship_id, latitude, longitude, speed, heading)
     VALUES (?, ?, ?, ?, ?)`,
    [ship.id, lat, lon, speed, heading]
  );

  // Also update ships table current position
  await pool.execute(
    `UPDATE ships SET current_lat=?, current_lon=?, current_speed=?, current_heading=?
     WHERE id=?`,
    [lat, lon, speed, heading, ship.id]
  );

  logger.info('Position recorded', { shipCode, lat, lon, speed, heading });
  return { shipId: shipCode, lat, lon, speed, heading, recordedAt: new Date().toISOString() };
}

module.exports = {
  getLatestPosition,
  recordPosition,
  validateCoordinates,
  computeDemoPosition,
};
