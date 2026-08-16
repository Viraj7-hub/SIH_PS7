'use strict';

/**
 * services/weather.service.js
 * ═══════════════════════════════════════════════════════════════════
 * STUB — Interface for Backend Member 3 (Weather / Ocean / Live Data)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Member 3: implement the functions in this file.
 * Do NOT change the function signatures or return shapes.
 * The existing Express routes and controllers will call these without modification.
 *
 * The /api/marine-weather route is a real Open-Meteo proxy in legacy.routes.js.
 * Member 3 can replace that implementation here and wire it through the controller.
 *
 * Dependencies available:
 *   - require('../config/db')     — MySQL pool
 *   - Any HTTP client (built-in fetch, node-fetch, axios)
 *   - require('../middleware/error.middleware').AppError
 *
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * Get weather risk points along the route for a given ship.
 * Called by GET /api/weather/:shipId (Dashboard.jsx)
 *
 * @param {string} shipId
 * @returns {Promise<Array<WeatherPoint>>}
 *
 * WeatherPoint shape (must match Dashboard.jsx):
 * { lat: number, lon: number, risk: number, condition: string }
 */
async function getWeatherForShip(shipId) {
  // STUB — Member 3 replaces with real implementation
  return [
    { lat: 17.5, lon: 74.5, risk: 20, condition: 'Clear' },
    { lat: 14.5, lon: 76.5, risk: 50, condition: 'Moderate' },
    { lat: 10.5, lon: 78.5, risk: 80, condition: 'Rough Sea' },
    { lat:  9.2, lon: 79.1, risk: 65, condition: 'Changing Winds' },
  ];
}

/**
 * Get current ocean conditions at the ship's position.
 * Called by GET /api/ocean/:shipId (Dashboard.jsx)
 *
 * @param {string} shipId
 * @returns {Promise<OceanConditions>}
 *
 * OceanConditions shape (must match Dashboard.jsx):
 * { waveHeight: number, currentSpeed: number, currentDirection: number }
 */
async function getOceanConditions(shipId) {
  // STUB — Member 3 replaces with real implementation
  return {
    waveHeight:       2.8,
    currentSpeed:     1.4,
    currentDirection: 120,
  };
}

/**
 * Get active cyclones near the ship's route.
 * Called by GET /api/cyclones/:shipId (Dashboard.jsx)
 *
 * @param {string} shipId
 * @returns {Promise<CycloneData>}
 *
 * CycloneData shape (must match Dashboard.jsx):
 * { cyclones: Array<{ name, lat, lon, radiusKm, risk }> }
 */
async function getCyclones(shipId) {
  // STUB — Member 3 replaces with real implementation (query cyclones table)
  return {
    cyclones: [
      { name: 'Demo Cyclone', lat: 14.5, lon: 75.5, radiusKm: 150, risk: 75 },
    ],
  };
}

/**
 * Get the full Indian Ocean marine weather grid.
 * Called by GET /api/marine-weather (WeatherDashboard.jsx)
 *
 * Member 3 should implement this by fetching from Open-Meteo (currently done
 * inline in legacy.routes.js) and optionally caching results in the DB.
 *
 * @returns {Promise<Array<MarineDataPoint>>}
 */
async function getMarineWeatherGrid() {
  // STUB — Member 3 migrates the Open-Meteo batching logic here
  // For now, the legacy route in legacy.routes.js handles the real call.
  throw new Error('getMarineWeatherGrid: not yet implemented in weather.service.js — legacy route still active.');
}

/**
 * Get the most recent live position for a ship.
 * Called by GET /api/ships/:shipId/position (Dashboard.jsx poll)
 *
 * @param {string} shipId
 * @returns {Promise<ShipPosition>}
 *
 * ShipPosition shape:
 * { shipId: string, lat: number, lon: number, speed: number, heading: number }
 */
async function getLivePosition(shipId) {
  // STUB — Member 3 replaces with AIS/DB query
  const { pool } = require('../config/db');
  const shipModel = require('../models/ship.model');

  const ship = await shipModel.findByShipCode(shipId);
  if (!ship) return null;

  // Try latest ship_positions entry first
  const [rows] = await pool.execute(
    `SELECT latitude, longitude, speed, heading
     FROM ship_positions
     WHERE ship_id = ?
     ORDER BY recorded_at DESC
     LIMIT 1`,
    [ship.id]
  );

  if (rows[0]) {
    return {
      shipId,
      lat:     parseFloat(rows[0].latitude),
      lon:     parseFloat(rows[0].longitude),
      speed:   parseFloat(rows[0].speed)   || ship.current_speed,
      heading: parseFloat(rows[0].heading) || ship.current_heading,
    };
  }

  // Fall back to ships table
  return {
    shipId,
    lat:     parseFloat(ship.current_lat),
    lon:     parseFloat(ship.current_lon),
    speed:   parseFloat(ship.current_speed),
    heading: parseFloat(ship.current_heading),
  };
}

module.exports = { getWeatherForShip, getOceanConditions, getCyclones, getMarineWeatherGrid, getLivePosition };
