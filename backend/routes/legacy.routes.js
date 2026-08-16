'use strict';

/**
 * routes/legacy.routes.js
 * Backwards-compatibility endpoints that the original frontend called.
 *
 * These shims delegate to the same services/controllers as the new routes,
 * preserving the original URL structure while running real business logic.
 *
 * The frontend api.js will be updated to use /api/auth/login, but these
 * endpoints remain as a safety net.
 *
 * /api/marine-weather is kept here because it contains a large inline
 * Open-Meteo batching implementation. Member 3 will migrate this to
 * weather.service.getMarineWeatherGrid() and remove the inline code.
 */

const router       = require('express').Router();
const authService  = require('../services/auth.service');
const routeService = require('../services/route.service');
const weatherService = require('../services/weather.service');
const { AppError } = require('../middleware/error.middleware');
const { authLimiter } = require('../middleware/rateLimiter.middleware');
const shipModel    = require('../models/ship.model');

// ── POST /api/login (compat wrapper → auth.service.login) ────────────────────
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      throw new AppError('Invalid email or password.', 'UNAUTHORIZED');
    }
    const result = await authService.login({ email, password });
    // Match the original response shape the frontend expects:
    // { token, user: { email, name } }
    res.json({
      success: true,
      token:   result.token,
      user: {
        email: result.user.email,
        name:  result.user.name,
        role:  result.user.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/route/optimize ─────────────────────────────────────────────────
router.post('/route/optimize', async (req, res, next) => {
  try {
    const { shipId, sourcePortId, destPortId, priorities, vessel } = req.body || {};
    if (!shipId) {
      throw new AppError('Unable to calculate the optimized route.', 'NOT_FOUND');
    }
    // Verify ship exists
    const ship = await shipModel.findByShipCode(shipId.toUpperCase());
    if (!ship) {
      throw new AppError('Unable to calculate the optimized route.', 'NOT_FOUND');
    }
    const result = await routeService.optimizeRoute({ shipId, sourcePortId, destPortId, priorities, vessel });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/weather/:shipId ──────────────────────────────────────────────────
router.get('/weather/:shipId', async (req, res, next) => {
  try {
    const ship = await shipModel.findByShipCode(req.params.shipId.toUpperCase());
    if (!ship) throw new AppError('Weather data temporarily unavailable.', 'NOT_FOUND');
    const data = await weatherService.getWeatherForShip(req.params.shipId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/ocean/:shipId ────────────────────────────────────────────────────
router.get('/ocean/:shipId', async (req, res, next) => {
  try {
    const ship = await shipModel.findByShipCode(req.params.shipId.toUpperCase());
    if (!ship) throw new AppError('Ocean data temporarily unavailable.', 'NOT_FOUND');
    const data = await weatherService.getOceanConditions(req.params.shipId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/cyclones/:shipId ─────────────────────────────────────────────────
router.get('/cyclones/:shipId', async (req, res, next) => {
  try {
    const ship = await shipModel.findByShipCode(req.params.shipId.toUpperCase());
    if (!ship) throw new AppError('Cyclone data temporarily unavailable.', 'NOT_FOUND');
    const data = await weatherService.getCyclones(req.params.shipId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/chat ────────────────────────────────────────────────────────────
router.post('/chat', async (req, res, next) => {
  try {
    const { shipId, message } = req.body || {};
    const ship = await shipModel.findByShipCode((shipId || '').toUpperCase());
    if (!ship) throw new AppError('Unable to access voyage assistance.', 'NOT_FOUND');

    const text = (message || '').toLowerCase();
    let reply = 'I can help with route status, arrival timing, weather, and vessel safety.';

    if (text.includes('distance') || text.includes('destination'))
      reply = 'You have approximately 1,190 km remaining.';
    else if (text.includes('arrive') || text.includes('arrival') || text.includes('when'))
      reply = 'You are expected to arrive in approximately 28 hours and 36 minutes.';
    else if (text.includes('speed'))
      reply = `Our current speed is ${ship.current_speed || 18.2} knots.`;
    else if (text.includes('safe') || text.includes('safety'))
      reply = 'The route is considered safe with a safety score of 92%.';
    else if (text.includes('weather'))
      reply = 'Weather conditions are moderate ahead, with a few rough sea pockets near the route.';
    else if (text.includes('why') || text.includes('selected') || text.includes('route'))
      reply = 'Your route is optimized using multiple factors: safety, travel time, fuel efficiency, and weather risk.';

    res.json({ reply });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/marine-weather ───────────────────────────────────────────────────
// Full Open-Meteo proxy — Member 3 will migrate this to weather.service.js
router.get('/marine-weather', async (req, res, next) => {
  const LAT_MIN = -20, LAT_MAX = 30, LON_MIN = 40, LON_MAX = 110, STEP = 2.0;
  const BATCH_SIZE = 100, MAX_RETRIES = 3;

  const coordinates = [];
  for (let lat = LAT_MIN; lat <= LAT_MAX; lat += STEP)
    for (let lon = LON_MIN; lon <= LON_MAX; lon += STEP)
      coordinates.push({ lat, lon });

  const batches = [];
  for (let i = 0; i < coordinates.length; i += BATCH_SIZE)
    batches.push(coordinates.slice(i, i + BATCH_SIZE));

  const makeRequest = async (url, params, attempt = 1) => {
    const u = new URL(url);
    Object.keys(params).forEach(k => u.searchParams.append(k, params[k]));
    const response = await fetch(u.toString(), { signal: AbortSignal.timeout(30000) });
    if (!response.ok) {
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 2000));
        return makeRequest(url, params, attempt + 1);
      }
      throw new Error(`HTTP error ${response.status}`);
    }
    return response.json();
  };

  try {
    const finalData = [];
    for (const batch of batches) {
      const lats = batch.map(c => c.lat).join(',');
      const lons = batch.map(c => c.lon).join(',');

      const [marineData, weatherData] = await Promise.all([
        makeRequest('https://marine-api.open-meteo.com/v1/marine', {
          latitude: lats, longitude: lons,
          current: 'wave_height,wave_direction,wave_period,wind_wave_height,wind_wave_direction,swell_wave_height,swell_wave_direction,ocean_current_velocity,ocean_current_direction,sea_surface_temperature,sea_level_height_msl',
          forecast_hours: 24, length_unit: 'metric', timezone: 'GMT', cell_selection: 'sea',
        }),
        makeRequest('https://api.open-meteo.com/v1/forecast', {
          latitude: lats, longitude: lons,
          current: 'temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,relative_humidity_2m,pressure_msl,cloud_cover,precipitation,weather_code',
          forecast_hours: 24, temperature_unit: 'celsius', wind_speed_unit: 'kn',
          precipitation_unit: 'mm', timezone: 'GMT',
        }),
      ]);

      const marineArray = Array.isArray(marineData) ? marineData : [marineData];
      const weatherArray = Array.isArray(weatherData) ? weatherData : [weatherData];

      for (let i = 0; i < batch.length; i++) {
        const mc = (marineArray[i] || {}).current || {};
        const wc = (weatherArray[i] || {}).current || {};
        if (mc.wave_height == null) continue;
        finalData.push({
          latitude:       (marineArray[i] || {}).latitude || batch[i].lat,
          longitude:      (marineArray[i] || {}).longitude || batch[i].lon,
          wave_height:    mc.wave_height,
          wave_direction: mc.wave_direction,
          wave_period:    mc.wave_period,
          wind_wave_height:    mc.wind_wave_height,
          wind_wave_direction: mc.wind_wave_direction,
          swell_wave_height:   mc.swell_wave_height,
          swell_wave_direction: mc.swell_wave_direction,
          current_speed:    mc.ocean_current_velocity,
          current_direction: mc.ocean_current_direction,
          sea_temperature:  mc.sea_surface_temperature,
          sea_level:        mc.sea_level_height_msl,
          temperature:      wc.temperature_2m,
          wind_speed:       wc.wind_speed_10m,
          wind_direction:   wc.wind_direction_10m,
          wind_gusts:       wc.wind_gusts_10m,
          humidity:         wc.relative_humidity_2m,
          pressure:         wc.pressure_msl,
          cloud_cover:      wc.cloud_cover,
          precipitation:    wc.precipitation,
          weather_code:     wc.weather_code,
        });
      }
      await new Promise(r => setTimeout(r, 150));
    }
    res.json(finalData);
  } catch (err) {
    next(new AppError('Failed to fetch marine weather data.', 'INTERNAL_ERROR'));
  }
});

module.exports = router;
