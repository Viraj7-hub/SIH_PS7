'use strict';

/**
 * services/risk.service.js
 * ═══════════════════════════════════════════════════════════════════
 * Deterministic Marine Risk Scoring Engine
 * ═══════════════════════════════════════════════════════════════════
 *
 * Produces a 0–100 composite risk score from real environmental conditions.
 * No Math.random() is used anywhere in this file.
 *
 * ──────────────────────────────────────────────────────────────────
 * FORMULA
 * ──────────────────────────────────────────────────────────────────
 *
 *   waveRisk    = clamp(waveHeight_m  / WAVE_MAX  * 100, 0, 100)   w=0.30
 *   windRisk    = clamp(windSpeed_kn  / WIND_MAX  * 100, 0, 100)   w=0.25
 *   currentRisk = clamp(currentMs    / CURR_MAX  * 100, 0, 100)   w=0.20
 *   weatherRisk = weatherCodeToRisk(weatherCode)                   w=0.15
 *   cycloneRisk = hasCycloneNearby(lat, lon, cyclones) ? 80 : 0   w=0.10
 *
 *   riskScore = round(0.30*wR + 0.25*wiR + 0.20*cR + 0.15*wtR + 0.10*cyR)
 *
 * THRESHOLDS (absolute physical maxima that map to 100% risk):
 *   WAVE_MAX = 8  m     (significant wave height; 8 m = Beaufort 12 level)
 *   WIND_MAX = 64 kn    (Beaufort 12: hurricane-force wind)
 *   CURR_MAX = 5  m/s   (extreme ocean current; Gulf Stream peak ~2 m/s)
 *
 * RISK BANDS:
 *   0–30   → low
 *   31–60  → moderate
 *   61–80  → high
 *   81–100 → severe
 *
 * CYCLONE PROXIMITY:
 *   Any active cyclone whose centre is within CYCLONE_INFLUENCE_NM nautical
 *   miles of the point contributes 80 points to the cyclone risk component.
 *
 * ──────────────────────────────────────────────────────────────────
 * WMO WEATHER CODE RISK TABLE
 * ──────────────────────────────────────────────────────────────────
 * 0        Clear sky            → 0
 * 1–3      Mainly clear         → 5
 * 45–48    Fog                  → 30
 * 51–55    Drizzle              → 15
 * 61–65    Rain                 → 25
 * 71–75    Snow                 → 35
 * 77       Snow grains          → 20
 * 80–82    Rain showers         → 30
 * 85–86    Snow showers         → 40
 * 95       Thunderstorm         → 60
 * 96–99    Thunderstorm w/hail  → 75
 * (all others)                 → 10
 */

// ── Configurable thresholds ───────────────────────────────────────────────────
const WAVE_MAX             = 8;   // metres
const WIND_MAX             = 64;  // knots
const CURR_MAX             = 5;   // m/s
const CYCLONE_INFLUENCE_NM = 300; // nautical miles

// Component weights (must sum to 1.0)
const W_WAVE    = 0.30;
const W_WIND    = 0.25;
const W_CURRENT = 0.20;
const W_WEATHER = 0.15;
const W_CYCLONE = 0.10;

// WMO weather code → risk score (0–100)
const WEATHER_CODE_RISK = {
  0:  0,   // Clear sky
  1:  5,   // Mainly clear
  2:  5,   // Partly cloudy
  3:  5,   // Overcast
  45: 30,  // Fog
  48: 30,  // Rime fog
  51: 15,  // Light drizzle
  53: 20,  // Moderate drizzle
  55: 25,  // Dense drizzle
  56: 35,  // Light freezing drizzle
  57: 40,  // Dense freezing drizzle
  61: 20,  // Slight rain
  63: 30,  // Moderate rain
  65: 40,  // Heavy rain
  66: 45,  // Light freezing rain
  67: 55,  // Heavy freezing rain
  71: 30,  // Slight snow
  73: 40,  // Moderate snow
  75: 50,  // Heavy snow
  77: 20,  // Snow grains
  80: 25,  // Slight rain showers
  81: 35,  // Moderate rain showers
  82: 50,  // Violent rain showers
  85: 35,  // Slight snow showers
  86: 50,  // Heavy snow showers
  95: 60,  // Thunderstorm
  96: 70,  // Thunderstorm w/ slight hail
  99: 80,  // Thunderstorm w/ heavy hail
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Clamp a value to [min, max].
 * @param {number} v
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(v, min, max) {
  if (isNaN(v) || v === null || v === undefined) return 0;
  return Math.min(max, Math.max(min, v));
}

/**
 * Map a WMO weather code to a 0–100 risk score.
 * @param {number|null} code
 * @returns {number}
 */
function weatherCodeToRisk(code) {
  if (code == null) return 0;
  if (Object.prototype.hasOwnProperty.call(WEATHER_CODE_RISK, code)) {
    return WEATHER_CODE_RISK[code];
  }
  return 10; // default for codes not in the table
}

/**
 * Haversine distance in nautical miles between two lat/lon points.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} distance in NM
 */
function haversineNM(lat1, lon1, lat2, lon2) {
  const R = 3440.065; // Earth radius in nautical miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Determine whether any active cyclone is within CYCLONE_INFLUENCE_NM of a point.
 * @param {number} lat
 * @param {number} lon
 * @param {Array<{latitude:number, longitude:number, is_active:boolean}>} cyclones
 * @returns {boolean}
 */
function hasCycloneNearby(lat, lon, cyclones = []) {
  return cyclones.some((c) => {
    if (!c.is_active && c.is_active !== undefined) return false;
    const dist = haversineNM(lat, lon, parseFloat(c.latitude), parseFloat(c.longitude));
    return dist <= CYCLONE_INFLUENCE_NM;
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute a 0–100 composite marine risk score from environmental conditions.
 *
 * @param {Object}  conditions
 * @param {number}  [conditions.waveHeight]    — significant wave height, metres
 * @param {number}  [conditions.windSpeed]     — wind speed, knots
 * @param {number}  [conditions.currentSpeed]  — ocean current speed, m/s
 * @param {number}  [conditions.weatherCode]   — WMO weather code
 * @param {Array}   [conditions.cyclones]      — array of active cyclone objects
 * @param {number}  [conditions.lat]           — latitude of point (for cyclone check)
 * @param {number}  [conditions.lon]           — longitude of point (for cyclone check)
 * @returns {{ riskScore: number, riskLevel: string, components: Object }}
 */
function computeRiskScore(conditions = {}) {
  const {
    waveHeight   = 0,
    windSpeed    = 0,
    currentSpeed = 0,
    weatherCode  = null,
    cyclones     = [],
    lat          = 0,
    lon          = 0,
  } = conditions;

  const waveRisk    = clamp((waveHeight    / WAVE_MAX) * 100, 0, 100);
  const windRisk    = clamp((windSpeed     / WIND_MAX) * 100, 0, 100);
  const currentRisk = clamp((currentSpeed  / CURR_MAX) * 100, 0, 100);
  const weatherRisk = weatherCodeToRisk(weatherCode);
  const cycloneRisk = hasCycloneNearby(lat, lon, cyclones) ? 80 : 0;

  const riskScore = Math.round(
    W_WAVE    * waveRisk    +
    W_WIND    * windRisk    +
    W_CURRENT * currentRisk +
    W_WEATHER * weatherRisk +
    W_CYCLONE * cycloneRisk
  );

  return {
    riskScore: clamp(riskScore, 0, 100),
    riskLevel: riskScoreToLevel(riskScore),
    components: {
      waveRisk:    Math.round(waveRisk),
      windRisk:    Math.round(windRisk),
      currentRisk: Math.round(currentRisk),
      weatherRisk: Math.round(weatherRisk),
      cycloneRisk: Math.round(cycloneRisk),
    },
  };
}

/**
 * Convert a numeric risk score to a human-readable band label.
 * @param {number} score 0–100
 * @returns {'low'|'moderate'|'high'|'severe'}
 */
function riskScoreToLevel(score) {
  if (score <= 30) return 'low';
  if (score <= 60) return 'moderate';
  if (score <= 80) return 'high';
  return 'severe';
}

/**
 * Convert a risk score to a safety score (inverse, 0–100).
 * safetyScore = 100 − riskScore
 * @param {number} riskScore
 * @returns {number}
 */
function riskToSafetyScore(riskScore) {
  return clamp(100 - riskScore, 0, 100);
}

module.exports = {
  computeRiskScore,
  riskScoreToLevel,
  riskToSafetyScore,
  weatherCodeToRisk,
  hasCycloneNearby,
  haversineNM,
  // Expose thresholds so tests can verify they're reasonable
  WAVE_MAX,
  WIND_MAX,
  CURR_MAX,
  CYCLONE_INFLUENCE_NM,
};
