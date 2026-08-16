'use strict';

/**
 * services/weather.service.js
 * ═══════════════════════════════════════════════════════════════════
 * Marine Weather & Ocean Conditions Service
 * ═══════════════════════════════════════════════════════════════════
 *
 * This is the primary weather service used by:
 *   GET /api/weather/:shipId        — weather risk points along route
 *   GET /api/ocean/:shipId          — ocean conditions at ship position
 *   GET /api/cyclones/:shipId       — active cyclones (legacy route)
 *   GET /api/ships/:shipId/position — live ship position
 *   GET /api/marine-weather         — full marine weather grid
 *   POST /api/routes/optimize       — route engine weather integration
 *
 * Architecture:
 *   1. Check MySQL cache (cache.service)
 *   2. If fresh data exists → return it
 *   3. Otherwise → call Open-Meteo (marine.service)
 *   4. Normalize response into our internal schema
 *   5. Compute risk score (risk.service)
 *   6. Store in cache
 *   7. Return data
 *
 * On external API failure:
 *   - Stale cached data is returned with weatherDataStatus: "stale"
 *   - If no cache at all: weatherDataStatus: "unavailable", empty/null conditions
 *   - Express never crashes due to a weather API failure
 *
 * Function signature contracts are preserved for backwards compatibility
 * with legacy.routes.js and ship.routes.js.
 */

const { env }   = require('../config/env');
const logger    = require('../utils/logger');

const marineAPI      = require('./marine.service');
const cacheService   = require('./cache.service');
const riskService    = require('./risk.service');
const cycloneService = require('./cyclone.service');
const positionService = require('./position.service');
const shipModel      = require('../models/ship.model');

// ── Grid configuration defaults ───────────────────────────────────────────────
const DEFAULT_BBOX = { latMin: -20, latMax: 30, lonMin: 40, lonMax: 110 };
const DEFAULT_STEP = 2.0; // degrees
const MAX_GRID_POINTS = 500; // hard cap — never request more than this at once

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Fetch fresh weather data for a single coordinate, storing it in cache.
 * On API failure, attempts to return stale cached data.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {Array}  [activeCyclones] — for risk score computation
 * @returns {Promise<{ data: Object, status: 'fresh'|'stale'|'unavailable' }>}
 */
async function fetchAndCachePoint(lat, lon, activeCyclones = []) {
  // 1. Check fresh cache
  const cached = await cacheService.getWeatherCache(lat, lon, env.weatherTtlMinutes);
  if (cached) {
    return { data: dbRowToPoint(cached), status: 'fresh' };
  }

  // 2. Call external API
  try {
    const raw = await marineAPI.fetchMarinePoint(lat, lon);

    // 3. Compute risk score
    const { riskScore } = riskService.computeRiskScore({
      waveHeight:   raw.waveHeight,
      windSpeed:    raw.windSpeed,
      currentSpeed: raw.currentSpeed,
      weatherCode:  raw.weatherCode,
      cyclones:     activeCyclones,
      lat, lon,
    });
    raw.riskScore = riskScore;

    // 4. Store in cache
    await cacheService.setWeatherCache(lat, lon, raw);

    return { data: raw, status: 'fresh' };

  } catch (err) {
    logger.warn('External weather fetch failed, trying stale cache', {
      lat, lon, error: err.message,
    });

    // 5. Fall back to stale cache
    const stale = await cacheService.getStaleWeatherCache(lat, lon);
    if (stale) {
      return { data: dbRowToPoint(stale), status: 'stale' };
    }

    return { data: null, status: 'unavailable' };
  }
}

/**
 * Convert a DB weather_observations row into a normalized point object.
 * @param {Object} row
 * @returns {Object}
 */
function dbRowToPoint(row) {
  return {
    latitude:         parseFloat(row.latitude),
    longitude:        parseFloat(row.longitude),
    waveHeight:       row.wave_height    != null ? parseFloat(row.wave_height)    : null,
    waveDirection:    row.wave_direction != null ? parseFloat(row.wave_direction) : null,
    wavePeriod:       row.wave_period    != null ? parseFloat(row.wave_period)    : null,
    windWaveHeight:   null,
    windWaveDirection:null,
    swellHeight:      row.swell_height   != null ? parseFloat(row.swell_height)   : null,
    swellDirection:   row.swell_direction!= null ? parseFloat(row.swell_direction): null,
    currentSpeed:     row.current_speed  != null ? parseFloat(row.current_speed)  : null,
    currentDirection: row.current_dir    != null ? parseFloat(row.current_dir)    : null,
    seaTemperature:   row.sea_temp       != null ? parseFloat(row.sea_temp)       : null,
    seaLevel:         null,
    temperature:      null,
    windSpeed:        row.wind_speed     != null ? parseFloat(row.wind_speed)     : null,
    windDirection:    row.wind_direction != null ? parseFloat(row.wind_direction) : null,
    windGusts:        row.wind_gusts     != null ? parseFloat(row.wind_gusts)     : null,
    humidity:         null,
    pressure:         row.pressure_msl   != null ? parseFloat(row.pressure_msl)  : null,
    cloudCover:       row.cloud_cover    != null ? parseFloat(row.cloud_cover)    : null,
    precipitation:    row.precipitation  != null ? parseFloat(row.precipitation)  : null,
    weatherCode:      row.weather_code   != null ? parseInt(row.weather_code)     : null,
    riskScore:        row.risk_score     != null ? parseInt(row.risk_score)       : null,
    source:           'cache',
  };
}

// ── Public Functions ──────────────────────────────────────────────────────────

/**
 * Get marine conditions for a single lat/lon.
 * Cache-first; falls back to stale or returns unavailable status.
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<{ data: Object|null, status: string }>}
 */
async function getMarineConditions(lat, lon) {
  const cyclones = await safeGetCyclones();
  return fetchAndCachePoint(lat, lon, cyclones);
}

/**
 * Get atmosphere (weather) conditions for a lat/lon.
 * Returns weather-specific fields from the same Open-Meteo call.
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<{ data: Object|null, status: string }>}
 */
async function getWeatherConditions(lat, lon) {
  return getMarineConditions(lat, lon); // same API call, different consumer
}

/**
 * Get an hourly forecast for a lat/lon.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {number} [hours=24]
 * @returns {Promise<Object>}
 */
async function getForecast(lat, lon, hours = 24) {
  try {
    return await marineAPI.fetchForecast(lat, lon, hours);
  } catch (err) {
    logger.warn('Forecast fetch failed', { lat, lon, error: err.message });
    return { latitude: lat, longitude: lon, times: [], source: 'unavailable' };
  }
}

/**
 * Get conditions along a route for the route optimization engine.
 * Called by route.service.js → fetchWeatherConditions().
 *
 * Returns one risk point per waypoint with all fields the cost function needs.
 * If weather is unavailable, returns an empty array (route engine degrades gracefully).
 *
 * @param {Array<{lat:number, lon:number}|{lat:number, lng:number}>} waypoints
 * @returns {Promise<Array<Object>>}
 */
async function getConditionsAlongRoute(waypoints) {
  if (!waypoints || waypoints.length === 0) return [];

  const cyclones = await safeGetCyclones();
  const results  = [];

  // Process waypoints concurrently (bounded by batch size)
  const CONCURRENT = 5;
  for (let i = 0; i < waypoints.length; i += CONCURRENT) {
    const chunk = waypoints.slice(i, i + CONCURRENT);
    const chunkResults = await Promise.all(
      chunk.map(async (wp) => {
        const lat = wp.lat;
        const lon = wp.lon ?? wp.lng;

        const { data, status } = await fetchAndCachePoint(lat, lon, cyclones);

        if (!data || status === 'unavailable') {
          // Return minimal safe point — route engine handles zero-risk gracefully
          return { lat, lon: lon, waveHeight: 0, windSpeed: 0, currentSpeed: 0, riskScore: 0 };
        }

        return {
          lat,
          lon:           lon,
          waveHeight:    data.waveHeight    ?? 0,
          waveDirection: data.waveDirection ?? null,
          wavePeriod:    data.wavePeriod    ?? null,
          swellHeight:   data.swellHeight   ?? 0,
          windSpeed:     data.windSpeed     ?? 0,
          windDirection: data.windDirection ?? null,
          windGusts:     data.windGusts     ?? 0,
          currentSpeed:  data.currentSpeed  ?? 0,
          currentDirection: data.currentDirection ?? null,
          seaTemperature:   data.seaTemperature   ?? null,
          weatherCode:   data.weatherCode   ?? null,
          riskScore:     data.riskScore     ?? 0,
          weatherDataStatus: status,
        };
      })
    );
    results.push(...chunkResults);
  }

  logger.info('Route weather conditions fetched', { waypointCount: waypoints.length });
  return results;
}

/**
 * Get weather risk points along the ship's current route.
 * Called by GET /api/weather/:shipId (Dashboard.jsx)
 *
 * Returns an array of WeatherPoint objects:
 * { lat, lon, risk, condition }
 *
 * @param {string} shipCode
 * @returns {Promise<Array<{lat, lon, risk, condition}>>}
 */
async function getWeatherForShip(shipCode) {
  const ship = await shipModel.findByShipCode(shipCode.toUpperCase());
  if (!ship) return [];

  // Sample weather along a simplified route from ship's current position to dest
  const shipLat = parseFloat(ship.current_lat) || 18.9;
  const shipLon = parseFloat(ship.current_lon) || 72.8;
  const destLat = parseFloat(ship.dest_lat)    || 6.94;
  const destLon = parseFloat(ship.dest_lon)    || 79.84;

  // Generate 5 intermediate sample points along the great circle
  const SAMPLE_POINTS = 5;
  const waypoints = [];
  for (let i = 0; i < SAMPLE_POINTS; i++) {
    const t = i / (SAMPLE_POINTS - 1);
    waypoints.push({
      lat: shipLat + t * (destLat - shipLat),
      lon: shipLon + t * (destLon - shipLon),
    });
  }

  const conditions = await getConditionsAlongRoute(waypoints);

  return conditions.map((c) => ({
    lat:       c.lat,
    lon:       c.lon,
    risk:      c.riskScore,
    condition: riskToConditionLabel(c.riskScore),
  }));
}

/**
 * Get ocean conditions at the ship's current position.
 * Called by GET /api/ocean/:shipId (Dashboard.jsx)
 *
 * @param {string} shipCode
 * @returns {Promise<Object>}
 */
async function getOceanConditions(shipCode) {
  const ship = await shipModel.findByShipCode(shipCode.toUpperCase());
  if (!ship) return buildUnavailableOcean();

  // 1. Check ocean cache
  const oceanCached = await cacheService.getOceanCache(ship.id, env.oceanTtlMinutes);
  if (oceanCached) {
    const cyclones = await safeGetCyclones();
    const { riskScore } = riskService.computeRiskScore({
      waveHeight:   parseFloat(oceanCached.wave_height)   || 0,
      currentSpeed: parseFloat(oceanCached.current_speed) || 0,
      cyclones,
      lat: parseFloat(ship.current_lat) || 0,
      lon: parseFloat(ship.current_lon) || 0,
    });
    return {
      waveHeight:       parseFloat(oceanCached.wave_height)       ?? null,
      currentSpeed:     parseFloat(oceanCached.current_speed)     ?? null,
      currentDirection: parseFloat(oceanCached.current_direction) ?? null,
      seaTemperature:   parseFloat(oceanCached.sea_temperature)   ?? null,
      seaLevel:         parseFloat(oceanCached.sea_level)         ?? null,
      riskScore,
      weatherDataStatus: 'fresh',
    };
  }

  // 2. Fetch from API
  const lat = parseFloat(ship.current_lat) || 18.9;
  const lon = parseFloat(ship.current_lon) || 72.8;

  try {
    const raw      = await marineAPI.fetchMarinePoint(lat, lon);
    const cyclones = await safeGetCyclones();
    const { riskScore } = riskService.computeRiskScore({
      waveHeight:   raw.waveHeight,
      windSpeed:    raw.windSpeed,
      currentSpeed: raw.currentSpeed,
      weatherCode:  raw.weatherCode,
      cyclones,
      lat, lon,
    });

    // Cache it
    await cacheService.setOceanCache(ship.id, {
      waveHeight:       raw.waveHeight,
      currentSpeed:     raw.currentSpeed,
      currentDirection: raw.currentDirection,
      seaTemperature:   raw.seaTemperature,
      seaLevel:         raw.seaLevel,
    });

    // Also cache in weather_observations for route engine
    raw.riskScore = riskScore;
    await cacheService.setWeatherCache(lat, lon, raw);

    return {
      waveHeight:        raw.waveHeight       ?? null,
      currentSpeed:      raw.currentSpeed     ?? null,
      currentDirection:  raw.currentDirection ?? null,
      seaTemperature:    raw.seaTemperature   ?? null,
      seaLevel:          raw.seaLevel         ?? null,
      riskScore,
      weatherDataStatus: 'fresh',
    };

  } catch (err) {
    logger.warn('Ocean conditions fetch failed, trying stale cache', { error: err.message });
    const stale = await cacheService.getStaleOceanCache(ship.id);
    if (stale) {
      return {
        waveHeight:        parseFloat(stale.wave_height)       ?? null,
        currentSpeed:      parseFloat(stale.current_speed)     ?? null,
        currentDirection:  parseFloat(stale.current_direction) ?? null,
        seaTemperature:    parseFloat(stale.sea_temperature)   ?? null,
        seaLevel:          parseFloat(stale.sea_level)         ?? null,
        riskScore:         null,
        weatherDataStatus: 'stale',
      };
    }
    return buildUnavailableOcean();
  }
}

/**
 * Get active cyclones near a ship.
 * Called by GET /api/cyclones/:shipId (legacy route)
 *
 * @param {string} shipCode
 * @returns {Promise<{ cyclones: Array }>}
 */
async function getCyclones(shipCode) {
  const cyclones = await safeGetCyclones();
  return { cyclones };
}

/**
 * Get the full marine weather grid.
 * Called by GET /api/marine-weather (WeatherDashboard.jsx)
 *
 * Supports optional bounding box and step size to prevent
 * unnecessarily huge grid requests.
 *
 * @param {Object} [bbox] — { latMin, latMax, lonMin, lonMax }
 * @param {number} [step] — grid step in degrees
 * @returns {Promise<{ data: Array, weatherDataStatus: string }>}
 */
async function getMarineWeatherGrid(bbox, step) {
  const b    = { ...DEFAULT_BBOX, ...bbox };
  const s    = step || DEFAULT_STEP;
  const ttl  = env.marineWeatherTtlMinutes;

  // Generate grid coordinates
  const coordinates = [];
  for (let lat = b.latMin; lat <= b.latMax; lat += s) {
    for (let lon = b.lonMin; lon <= b.lonMax; lon += s) {
      coordinates.push({ lat: parseFloat(lat.toFixed(2)), lon: parseFloat(lon.toFixed(2)) });
    }
  }

  // Hard cap — prevent accidentally huge requests
  if (coordinates.length > MAX_GRID_POINTS) {
    logger.warn('Grid request exceeds MAX_GRID_POINTS, truncating', {
      requested: coordinates.length, cap: MAX_GRID_POINTS,
    });
    coordinates.length = MAX_GRID_POINTS;
  }

  logger.info('Marine weather grid request', { points: coordinates.length, bbox: b, step: s });

  // 1. Check which points are cached
  const results      = [];
  const uncachedCoords = [];
  let anyStale       = false;

  for (const coord of coordinates) {
    const cached = await cacheService.getWeatherCache(coord.lat, coord.lon, ttl);
    if (cached) {
      results.push({ ...dbRowToPoint(cached), _cached: true });
    } else {
      uncachedCoords.push(coord);
    }
  }

  logger.info('Marine weather grid cache check', {
    cached: results.length, uncached: uncachedCoords.length,
  });

  // 2. Batch-fetch uncached points
  if (uncachedCoords.length > 0) {
    try {
      const cyclones  = await safeGetCyclones();
      const fetched   = await marineAPI.fetchMarineBatch(uncachedCoords);

      for (const point of fetched) {
        const { riskScore } = riskService.computeRiskScore({
          waveHeight:   point.waveHeight,
          windSpeed:    point.windSpeed,
          currentSpeed: point.currentSpeed,
          weatherCode:  point.weatherCode,
          cyclones,
          lat: point.latitude,
          lon: point.longitude,
        });
        point.riskScore = riskScore;
        await cacheService.setWeatherCache(point.latitude, point.longitude, point);
        results.push(point);
      }
    } catch (err) {
      logger.error('Marine weather grid batch fetch failed, using stale data', {
        error: err.message, uncachedCount: uncachedCoords.length,
      });
      anyStale = true;

      // Attempt stale fallback for uncached points
      for (const coord of uncachedCoords) {
        const stale = await cacheService.getStaleWeatherCache(coord.lat, coord.lon);
        if (stale) {
          results.push({ ...dbRowToPoint(stale), _stale: true });
          anyStale = true;
        }
      }
    }
  }

  const weatherDataStatus = results.length === 0
    ? 'unavailable'
    : anyStale
    ? 'stale'
    : 'fresh';

  return { data: results, weatherDataStatus };
}

/**
 * Get the live position for a ship.
 * Delegates to position.service (DB + demo simulation).
 *
 * @param {string} shipCode
 * @returns {Promise<Object|null>}
 */
async function getLivePosition(shipCode) {
  return positionService.getLatestPosition(shipCode);
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Safe cyclone fetch — never throws.
 * @returns {Promise<Array>}
 */
async function safeGetCyclones() {
  try {
    return await cycloneService.getActiveCyclones();
  } catch {
    return [];
  }
}

/**
 * Convert a risk score to a human-readable condition label.
 * @param {number} score
 * @returns {string}
 */
function riskToConditionLabel(score) {
  if (score == null) return 'Unknown';
  if (score <= 10)  return 'Clear';
  if (score <= 30)  return 'Calm';
  if (score <= 50)  return 'Moderate';
  if (score <= 70)  return 'Rough Sea';
  if (score <= 85)  return 'Stormy';
  return 'Severe Storm';
}

/**
 * Build an "unavailable" ocean conditions object.
 * @returns {Object}
 */
function buildUnavailableOcean() {
  return {
    waveHeight:       null,
    currentSpeed:     null,
    currentDirection: null,
    seaTemperature:   null,
    seaLevel:         null,
    riskScore:        null,
    weatherDataStatus: 'unavailable',
  };
}

module.exports = {
  getMarineConditions,
  getWeatherConditions,
  getForecast,
  getConditionsAlongRoute,
  getWeatherForShip,
  getOceanConditions,
  getCyclones,
  getMarineWeatherGrid,
  getLivePosition,
};
