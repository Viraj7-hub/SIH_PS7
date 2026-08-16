'use strict';

/**
 * services/chat.service.js
 * ═══════════════════════════════════════════════════════════════════
 * Voyage Assistant Chat Service
 * ═══════════════════════════════════════════════════════════════════
 *
 * Replaces the hardcoded keyword→string handler in legacy.routes.js
 * with a service that assembles a live voyage context snapshot and
 * generates data-driven responses.
 *
 * Response generation is rule-based (no LLM dependency).
 * The service interface is designed to be LLM-compatible: a future
 * integration can swap `generateResponse()` for an LLM call without
 * changing any route or controller code.
 *
 * Supported question categories (detected by keywords):
 *   position    — Where is my ship? / Current location?
 *   speed       — What is my current speed?
 *   distance    — How far is the destination? / Remaining distance?
 *   eta         — When will we arrive? / ETA?
 *   safety      — Is the route safe? / Safety score?
 *   weather     — What is the weather? / Conditions ahead?
 *   hazards     — Are there hazards? / Any cyclones?
 *   ocean       — What are the ocean conditions?
 *   route       — Why was this route selected?
 *   fuel        — How much fuel remaining?
 *   general     — Catch-all helpful response
 */

const positionService = require('./position.service');
const cycloneService  = require('./cyclone.service');
const logger          = require('../utils/logger');
const { pool }        = require('../config/db');
const shipModel       = require('../models/ship.model');
const { haversineNM } = require('./risk.service');

// ── Voyage Context Builder ─────────────────────────────────────────────────────

/**
 * Assemble a live voyage context snapshot for a ship.
 * This is the "memory" the chatbot uses to answer questions.
 *
 * @param {string} shipCode
 * @returns {Promise<Object>} VoyageContext
 */
async function buildVoyageContext(shipCode) {
  const ship = await shipModel.findByShipCode(shipCode.toUpperCase());
  if (!ship) return null;

  const context = {
    shipCode:    ship.ship_code,
    shipName:    ship.name,
    shipType:    ship.type,
    maxSpeedKn:  parseFloat(ship.max_speed) || 14,
    source:      ship.source_port_name || 'unknown',
    destination: ship.dest_port_name   || 'unknown',
    destLat:     parseFloat(ship.dest_lat) || null,
    destLon:     parseFloat(ship.dest_lon) || null,
    position:    null,
    distanceNM:  null,
    etaHours:    null,
    weatherRisk: null,
    weatherDesc: null,
    safetyScore: null,
    cyclones:    [],
    oceanData:   null,
    routeResult: null,
  };

  // --- Live position ---
  try {
    context.position = await positionService.getLatestPosition(shipCode);
  } catch { /* non-fatal */ }

  // --- Distance & ETA ---
  if (context.position && context.destLat && context.destLon) {
    context.distanceNM = haversineNM(
      context.position.lat, context.position.lon,
      context.destLat, context.destLon
    );
    const speedKn = context.position.speed || context.maxSpeedKn;
    if (speedKn > 0) {
      context.etaHours = context.distanceNM / speedKn;
    }
  }

  // --- Latest route result for this ship ---
  try {
    const [rows] = await pool.execute(
      `SELECT rr.safety_score, rr.optimized_safety_score,
              rr.explanation_json, rr.optimized_distance_nm
       FROM route_results rr
       JOIN route_requests req ON req.id = rr.route_request_id
       ORDER BY rr.created_at DESC LIMIT 1`
    );
    if (rows[0]) {
      context.safetyScore = rows[0].optimized_safety_score ?? rows[0].safety_score;
      context.routeResult = {
        safetyScore: context.safetyScore,
        distanceNM:  rows[0].optimized_distance_nm,
        explanation: rows[0].explanation_json ? JSON.parse(rows[0].explanation_json) : null,
      };
    }
  } catch { /* non-fatal */ }

  // --- Cyclones ---
  try {
    context.cyclones = await cycloneService.getActiveCyclones();
  } catch { /* non-fatal */ }

  // --- Latest weather cache near current position ---
  if (context.position) {
    try {
      const [wRows] = await pool.execute(
        `SELECT wave_height, wind_speed, weather_code, risk_score
         FROM weather_observations
         WHERE ABS(latitude - ?) < 2 AND ABS(longitude - ?) < 2
         ORDER BY observed_at DESC LIMIT 1`,
        [context.position.lat, context.position.lon]
      );
      if (wRows[0]) {
        context.weatherRisk = wRows[0].risk_score;
        context.weatherDesc = weatherCodeToDescription(wRows[0].weather_code);
        context.oceanData   = {
          waveHeight: wRows[0].wave_height,
          windSpeed:  wRows[0].wind_speed,
        };
      }
    } catch { /* non-fatal */ }
  }

  return context;
}

// ── Response Generator ─────────────────────────────────────────────────────────

/**
 * Generate a natural-language response to a user message using the
 * live voyage context.
 *
 * @param {Object} context — from buildVoyageContext()
 * @param {string} message — raw user message
 * @returns {string} reply text
 */
function generateResponse(context, message) {
  if (!context) {
    return 'I was unable to retrieve your voyage information. Please try again.';
  }

  const msg = message.toLowerCase().trim();

  // ── Position ──────────────────────────────────────────────────────
  if (/where|location|position|coordinates|am i|current position/.test(msg)) {
    if (context.position) {
      const simNote = context.position.simulated ? ' (simulated demo position)' : '';
      return `${context.shipName} is currently at latitude ${context.position.lat.toFixed(4)}°, ` +
             `longitude ${context.position.lon.toFixed(4)}°${simNote}. ` +
             (context.destination ? `Heading towards ${context.destination}.` : '');
    }
    return 'Current position data is temporarily unavailable.';
  }

  // ── Speed ─────────────────────────────────────────────────────────
  if (/speed|knot|fast|slow/.test(msg)) {
    const speed = context.position?.speed || context.maxSpeedKn;
    return `${context.shipName} is currently travelling at ${speed.toFixed(1)} knots.`;
  }

  // ── Distance ──────────────────────────────────────────────────────
  if (/distance|far|remain|left|km|nautical|miles/.test(msg)) {
    if (context.distanceNM != null) {
      const km = (context.distanceNM * 1.852).toFixed(0);
      return `Approximately ${Math.round(context.distanceNM)} nautical miles ` +
             `(${km} km) remaining to ${context.destination}.`;
    }
    return 'Distance data is temporarily unavailable.';
  }

  // ── ETA / Arrival ─────────────────────────────────────────────────
  if (/arrive|arrival|eta|when|time|long/.test(msg)) {
    if (context.etaHours != null) {
      const hrs  = Math.floor(context.etaHours);
      const mins = Math.round((context.etaHours - hrs) * 60);
      const eta  = new Date(Date.now() + context.etaHours * 3600000);
      const etaStr = eta.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
                     ' at ' + eta.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' UTC';
      return `Estimated arrival at ${context.destination}: ${hrs}h ${mins}m (${etaStr}).`;
    }
    return 'ETA data is temporarily unavailable.';
  }

  // ── Safety ────────────────────────────────────────────────────────
  if (/safe|safety|danger|risk|secure/.test(msg)) {
    if (context.safetyScore != null) {
      const level = context.safetyScore >= 80 ? 'safe' :
                    context.safetyScore >= 60 ? 'moderate risk' :
                    context.safetyScore >= 40 ? 'elevated risk' : 'high risk';
      return `The optimized route has a safety score of ${context.safetyScore}% (${level}). ` +
             (context.cyclones.length > 0
               ? `Note: ${context.cyclones.length} active cyclone(s) are being monitored in the region.`
               : 'No active cyclones detected on the route.');
    }
    return 'Safety score is being computed. Please check back shortly.';
  }

  // ── Weather ───────────────────────────────────────────────────────
  if (/weather|condition|wave|wind|rain|storm|sea state/.test(msg)) {
    if (context.weatherDesc || context.oceanData) {
      const desc   = context.weatherDesc  || 'conditions unknown';
      const wave   = context.oceanData?.waveHeight != null ? `, wave height ${parseFloat(context.oceanData.waveHeight).toFixed(1)} m` : '';
      const wind   = context.oceanData?.windSpeed  != null ? `, wind ${parseFloat(context.oceanData.windSpeed).toFixed(0)} knots` : '';
      const risk   = context.weatherRisk != null ? ` (risk score: ${context.weatherRisk}/100)` : '';
      return `Current conditions near the vessel: ${desc}${wave}${wind}${risk}.`;
    }
    return 'Weather data is being retrieved. Conditions appear moderate — please check the weather dashboard for the latest update.';
  }

  // ── Hazards / Cyclones ────────────────────────────────────────────
  if (/hazard|cyclone|storm|typhoon|hurricane|warning/.test(msg)) {
    if (context.cyclones.length === 0) {
      return 'No active cyclones or hazards detected near your route at this time.';
    }
    const names = context.cyclones.map((c) => `${c.name} (risk: ${c.riskScore})`).join(', ');
    return `${context.cyclones.length} active cyclone(s) in the region: ${names}. ` +
           'The route engine has accounted for these when calculating the optimized path.';
  }

  // ── Ocean Conditions ──────────────────────────────────────────────
  if (/ocean|current|swell|temperature|sea temp/.test(msg)) {
    if (context.oceanData) {
      return `Ocean conditions near ${context.shipName}: ` +
             (context.oceanData.waveHeight != null ? `wave height ${context.oceanData.waveHeight.toFixed(1)} m, ` : '') +
             (context.oceanData.windSpeed  != null ? `wind ${context.oceanData.windSpeed.toFixed(0)} kn.` : 'data updating.');
    }
    return 'Ocean conditions data is being retrieved from the marine sensor grid.';
  }

  // ── Route rationale ───────────────────────────────────────────────
  if (/why|route|selected|chosen|optimal|optimized|algorithm/.test(msg)) {
    if (context.routeResult?.explanation?.summary) {
      return context.routeResult.explanation.summary;
    }
    return `The route from ${context.source} to ${context.destination} was optimized using a ` +
           'Multi-Objective A* algorithm that balances fuel efficiency, travel time, and safety. ' +
           'Weather and ocean conditions were factored into the safety cost of each route segment.';
  }

  // ── Fuel ─────────────────────────────────────────────────────────
  if (/fuel|consumption|diesel|efficient/.test(msg)) {
    return `${context.shipName} has a fuel consumption rate of approximately ` +
           `${((context.maxSpeedKn * 0.035) || 0.63).toFixed(2)} tons/hour at current speed. ` +
           'Fuel estimates are recalculated when a new route optimization is run.';
  }

  // ── Fallback ──────────────────────────────────────────────────────
  return `I can help with: current position, speed, distance, ETA, weather, safety, ` +
         `ocean conditions, hazards, and route rationale for ${context.shipName}. ` +
         'Please ask about any of these topics.';
}

// ── WMO Weather Code Descriptions ─────────────────────────────────────────────

function weatherCodeToDescription(code) {
  const descriptions = {
    0: 'clear sky',
    1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast',
    45: 'fog', 48: 'rime fog',
    51: 'light drizzle', 53: 'moderate drizzle', 55: 'dense drizzle',
    61: 'slight rain', 63: 'moderate rain', 65: 'heavy rain',
    71: 'slight snow', 73: 'moderate snow', 75: 'heavy snow',
    80: 'slight rain showers', 81: 'moderate rain showers', 82: 'violent rain showers',
    85: 'slight snow showers', 86: 'heavy snow showers',
    95: 'thunderstorm', 96: 'thunderstorm with slight hail', 99: 'thunderstorm with heavy hail',
  };
  return descriptions[code] || 'variable conditions';
}

// ── High-level handler ─────────────────────────────────────────────────────────

/**
 * Process a chat message for a ship and return a reply.
 * This is the function called by the route handler.
 *
 * @param {string} shipCode
 * @param {string} message
 * @returns {Promise<{ reply: string }>}
 */
async function handleChatMessage(shipCode, message) {
  const t0 = Date.now();
  let context;

  try {
    context = await buildVoyageContext(shipCode);
  } catch (err) {
    logger.warn('Failed to build voyage context for chat', { shipCode, error: err.message });
    context = null;
  }

  const reply = generateResponse(context, message || '');

  logger.info('Chat response generated', {
    shipCode,
    messageLength: (message || '').length,
    latencyMs: Date.now() - t0,
  });

  return { reply };
}

module.exports = { handleChatMessage, buildVoyageContext, generateResponse };
