/**
 * coordinateUtils.js
 * ─────────────────────────────────────────────────────────────────────
 * Centralized coordinate normalization and route validation for Leaflet.
 * Prevents Leaflet _projectLatlngs undefined crash by ensuring all positions
 * passed to Leaflet components are strictly valid [lat, lng] numeric tuples.
 */

/**
 * Normalizes any coordinate input into a valid numeric [lat, lng] tuple.
 * Rejects null, undefined, NaN, and out-of-bounds coordinates.
 *
 * Supported formats:
 *   - [lat, lng] or [lat, lon]
 *   - { lat, lng } or { lat, lon }
 *   - { latitude, longitude }
 *
 * @param {*} pt
 * @returns {[number, number] | null}
 */
export function normalizeCoordinate(pt) {
  if (pt == null || pt === undefined) return null;

  let lat = null;
  let lon = null;

  if (Array.isArray(pt)) {
    if (pt.length >= 2) {
      lat = Number(pt[0]);
      lon = Number(pt[1]);
    }
  } else if (typeof pt === 'object') {
    lat = Number(pt.lat ?? pt.latitude);
    lon = Number(pt.lon ?? pt.lng ?? pt.longitude);
  }

  if (
    lat != null &&
    lon != null &&
    !isNaN(lat) &&
    !isNaN(lon) &&
    isFinite(lat) &&
    isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  ) {
    return [parseFloat(lat.toFixed(6)), parseFloat(lon.toFixed(6))];
  }

  return null;
}

/**
 * Normalizes an array of waypoints into valid [lat, lng] tuples for Leaflet.
 * Filters out invalid/malformed coordinates.
 * Returns empty array if fewer than 2 valid waypoints exist.
 *
 * @param {Array} waypoints
 * @returns {Array<[number, number]>}
 */
export function normalizeRouteWaypoints(waypoints) {
  if (!Array.isArray(waypoints)) return [];
  const valid = waypoints.map(normalizeCoordinate).filter(Boolean);
  return valid.length >= 2 ? valid : [];
}

/**
 * Validates and cleans stored route data (e.g. from localStorage).
 * Returns sanitized route object or null if data is corrupt.
 *
 * @param {Object} data
 * @returns {Object|null}
 */
export function sanitizeStoredRoute(data) {
  if (!data || typeof data !== 'object') return null;

  try {
    const stdWps = normalizeRouteWaypoints(data.standardRoute?.waypoints || data.standardRoute);
    const optWps = normalizeRouteWaypoints(data.optimizedRoute?.waypoints || data.route || data.waypoints);

    if (optWps.length < 2 && stdWps.length < 2) {
      return null;
    }

    return {
      ...data,
      standardRoute: {
        ...data.standardRoute,
        waypoints: stdWps,
      },
      optimizedRoute: {
        ...data.optimizedRoute,
        waypoints: optWps,
      },
      route: optWps.length ? optWps : stdWps,
    };
  } catch {
    return null;
  }
}
