'use strict';

/**
 * services/marine.service.js
 * ═══════════════════════════════════════════════════════════════════
 * External API client for Open-Meteo Marine and Forecast APIs.
 *
 * Responsibilities:
 *   - All HTTP communication with Open-Meteo (no other module calls
 *     Open-Meteo directly)
 *   - Request timeout via AbortSignal.timeout()
 *   - Exponential backoff retry on transient failures (5xx, network)
 *   - Normalize raw API responses into our internal schema
 *   - Structured logging of every external call (provider, latency,
 *     retry count, success/failure)
 *
 * Internal schema (MarinePoint):
 * {
 *   latitude, longitude,
 *   waveHeight, waveDirection, wavePeriod,
 *   windWaveHeight, windWaveDirection,
 *   swellHeight, swellDirection,
 *   currentSpeed, currentDirection,
 *   seaTemperature, seaLevel,
 *   temperature, windSpeed, windDirection, windGusts,
 *   humidity, pressure, cloudCover, precipitation,
 *   weatherCode,
 *   fetchedAt,                  // ISO timestamp
 *   source: 'open-meteo'
 * }
 */

const { env } = require('../config/env');
const logger  = require('../utils/logger');

// ── Open-Meteo endpoints ──────────────────────────────────────────────────────
const MARINE_URL  = 'https://marine-api.open-meteo.com/v1/marine';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';

const MARINE_PARAMS  = 'wave_height,wave_direction,wave_period,wind_wave_height,wind_wave_direction,swell_wave_height,swell_wave_direction,ocean_current_velocity,ocean_current_direction,sea_surface_temperature,sea_level_height_msl';
const WEATHER_PARAMS = 'temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,relative_humidity_2m,pressure_msl,cloud_cover,precipitation,weather_code';

// ── HTTP helper with retry ─────────────────────────────────────────────────────

/**
 * Fetch a URL with timeout and exponential backoff retry.
 *
 * @param {string}  url
 * @param {URLSearchParams|Record<string,string>} params
 * @param {Object}  [opts]
 * @param {number}  [opts.timeoutMs]
 * @param {number}  [opts.maxRetries]
 * @param {string}  [opts.label]   — human-readable label for log
 * @param {number}  [attempt]
 * @returns {Promise<Object>}
 */
async function fetchWithRetry(url, params, opts = {}, attempt = 1) {
  const timeoutMs  = opts.timeoutMs  ?? env.openMeteoTimeoutMs;
  const maxRetries = opts.maxRetries ?? env.openMeteoMaxRetries;
  const label      = opts.label      ?? url;

  const u = new URL(url);
  if (params instanceof URLSearchParams) {
    params.forEach((v, k) => u.searchParams.set(k, v));
  } else {
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, String(v)));
  }

  const t0 = Date.now();
  let lastError;

  try {
    const signal   = AbortSignal.timeout(timeoutMs);
    const response = await fetch(u.toString(), { signal });
    const latencyMs = Date.now() - t0;

    if (!response.ok) {
      const errMsg = `HTTP ${response.status}`;
      // 5xx = transient, retry. 4xx = client error, don't retry.
      if (response.status >= 500 && attempt < maxRetries) {
        const delay = 1000 * 2 ** (attempt - 1); // 1s, 2s, 4s …
        logger.warn('Open-Meteo transient error, retrying', {
          provider: 'open-meteo', label, status: response.status, attempt, delay,
        });
        await sleep(delay);
        return fetchWithRetry(url, params, opts, attempt + 1);
      }
      logger.error('Open-Meteo request failed', {
        provider: 'open-meteo', label, status: response.status,
        latencyMs, attempt,
      });
      throw new Error(`Open-Meteo error: ${errMsg}`);
    }

    logger.info('Open-Meteo request succeeded', {
      provider: 'open-meteo', label, latencyMs, attempt,
    });
    return await response.json();

  } catch (err) {
    lastError = err;
    const latencyMs = Date.now() - t0;

    // Timeout / network error: retry with backoff
    if (attempt < maxRetries && (err.name === 'TimeoutError' || err.name === 'AbortError' || err.name === 'TypeError')) {
      const delay = 1000 * 2 ** (attempt - 1);
      logger.warn('Open-Meteo network error, retrying', {
        provider: 'open-meteo', label, error: err.name, attempt, delay,
      });
      await sleep(delay);
      return fetchWithRetry(url, params, opts, attempt + 1);
    }

    logger.error('Open-Meteo request failed permanently', {
      provider: 'open-meteo', label, error: err.message,
      latencyMs, attempt, maxRetries,
    });
    throw lastError;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Response normalizers ───────────────────────────────────────────────────────

/**
 * Normalize a single Open-Meteo response object (marine + weather combined)
 * into our internal MarinePoint schema.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {Object} mc — marine current values
 * @param {Object} wc — weather current values
 * @returns {Object} MarinePoint
 */
function normalizePoint(lat, lon, mc = {}, wc = {}) {
  return {
    latitude:         lat,
    longitude:        lon,
    // Wave data
    waveHeight:       mc.wave_height          ?? null,
    waveDirection:    mc.wave_direction        ?? null,
    wavePeriod:       mc.wave_period           ?? null,
    windWaveHeight:   mc.wind_wave_height      ?? null,
    windWaveDirection:mc.wind_wave_direction   ?? null,
    // Swell
    swellHeight:      mc.swell_wave_height     ?? null,
    swellDirection:   mc.swell_wave_direction  ?? null,
    // Ocean current
    currentSpeed:     mc.ocean_current_velocity  ?? null,   // m/s
    currentDirection: mc.ocean_current_direction ?? null,
    // Sea state
    seaTemperature:   mc.sea_surface_temperature ?? null,
    seaLevel:         mc.sea_level_height_msl    ?? null,
    // Atmosphere
    temperature:      wc.temperature_2m        ?? null,
    windSpeed:        wc.wind_speed_10m         ?? null,   // knots (API returns kn)
    windDirection:    wc.wind_direction_10m     ?? null,
    windGusts:        wc.wind_gusts_10m         ?? null,
    humidity:         wc.relative_humidity_2m   ?? null,
    pressure:         wc.pressure_msl           ?? null,
    cloudCover:       wc.cloud_cover            ?? null,
    precipitation:    wc.precipitation          ?? null,
    weatherCode:      wc.weather_code           ?? null,
    // Metadata
    fetchedAt: new Date().toISOString(),
    source:    'open-meteo',
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Fetch marine + atmosphere conditions for a single point.
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<Object>} MarinePoint
 * @throws if both APIs fail after max retries
 */
async function fetchMarinePoint(lat, lon) {
  const commonParams = {
    latitude:       lat,
    longitude:      lon,
    forecast_hours: 24,
    timezone:       'GMT',
  };

  const [marineRaw, weatherRaw] = await Promise.all([
    fetchWithRetry(MARINE_URL, {
      ...commonParams,
      current:        MARINE_PARAMS,
      length_unit:    'metric',
      cell_selection: 'sea',
    }, { label: `marine-point(${lat},${lon})` }),
    fetchWithRetry(WEATHER_URL, {
      ...commonParams,
      current:              WEATHER_PARAMS,
      wind_speed_unit:      'kn',
      temperature_unit:     'celsius',
      precipitation_unit:   'mm',
    }, { label: `weather-point(${lat},${lon})` }),
  ]);

  const mc = marineRaw.current  || {};
  const wc = weatherRaw.current || {};
  return normalizePoint(
    marineRaw.latitude  ?? lat,
    marineRaw.longitude ?? lon,
    mc, wc
  );
}

/**
 * Fetch marine + atmosphere conditions for a batch of coordinates.
 * Open-Meteo accepts comma-separated latitude/longitude arrays.
 * Max batch size: 100 points.
 *
 * @param {Array<{lat:number, lon:number}>} coords
 * @returns {Promise<Array<Object>>} array of MarinePoint (only sea-valid points)
 */
async function fetchMarineBatch(coords) {
  if (!coords || coords.length === 0) return [];

  const MAX_BATCH = 100;
  if (coords.length > MAX_BATCH) {
    // Split and recurse
    const results = [];
    for (let i = 0; i < coords.length; i += MAX_BATCH) {
      const chunk = coords.slice(i, i + MAX_BATCH);
      const chunkResults = await fetchMarineBatch(chunk);
      results.push(...chunkResults);
      if (i + MAX_BATCH < coords.length) {
        await sleep(150); // polite pacing between batches
      }
    }
    return results;
  }

  const lats = coords.map((c) => c.lat).join(',');
  const lons = coords.map((c) => c.lon).join(',');

  const commonParams = {
    latitude:       lats,
    longitude:      lons,
    forecast_hours: 24,
    timezone:       'GMT',
  };

  const [marineRaw, weatherRaw] = await Promise.all([
    fetchWithRetry(MARINE_URL, {
      ...commonParams,
      current:        MARINE_PARAMS,
      length_unit:    'metric',
      cell_selection: 'sea',
    }, { label: `marine-batch(${coords.length})` }),
    fetchWithRetry(WEATHER_URL, {
      ...commonParams,
      current:            WEATHER_PARAMS,
      wind_speed_unit:    'kn',
      temperature_unit:   'celsius',
      precipitation_unit: 'mm',
    }, { label: `weather-batch(${coords.length})` }),
  ]);

  const marineArr  = Array.isArray(marineRaw)  ? marineRaw  : [marineRaw];
  const weatherArr = Array.isArray(weatherRaw) ? weatherRaw : [weatherRaw];

  const results = [];
  for (let i = 0; i < coords.length; i++) {
    const mc = (marineArr[i]  || {}).current || {};
    const wc = (weatherArr[i] || {}).current || {};

    // Skip land points (Open-Meteo returns null wave_height for land)
    if (mc.wave_height == null) continue;

    results.push(normalizePoint(
      (marineArr[i]  || {}).latitude  ?? coords[i].lat,
      (marineArr[i]  || {}).longitude ?? coords[i].lon,
      mc, wc
    ));
  }

  return results;
}

/**
 * Fetch an hourly marine forecast for a single point.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {number} [forecastHours=24]
 * @returns {Promise<Object>} raw normalized hourly data
 */
async function fetchForecast(lat, lon, forecastHours = 24) {
  const marineRaw = await fetchWithRetry(MARINE_URL, {
    latitude:       lat,
    longitude:      lon,
    hourly:         'wave_height,wave_direction,wave_period,swell_wave_height',
    forecast_hours: forecastHours,
    timezone:       'GMT',
    length_unit:    'metric',
    cell_selection: 'sea',
  }, { label: `forecast(${lat},${lon})` });

  return {
    latitude:     marineRaw.latitude,
    longitude:    marineRaw.longitude,
    times:        marineRaw.hourly?.time          || [],
    waveHeight:   marineRaw.hourly?.wave_height   || [],
    waveDir:      marineRaw.hourly?.wave_direction || [],
    wavePeriod:   marineRaw.hourly?.wave_period    || [],
    swellHeight:  marineRaw.hourly?.swell_wave_height || [],
    source:       'open-meteo',
    fetchedAt:    new Date().toISOString(),
  };
}

module.exports = { fetchMarinePoint, fetchMarineBatch, fetchForecast, normalizePoint };
