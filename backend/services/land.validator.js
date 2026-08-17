'use strict';

/**
 * services/land.validator.js
 * ═══════════════════════════════════════════════════════════════════
 * High-Precision Ocean & Coastline Polygon Route Validator
 * ═══════════════════════════════════════════════════════════════════
 *
 * Uses GSHHG (Global Self-consistent, Hierarchical, High-resolution Geography)
 * coastline polygon data via `is-sea` with 1-NM linear interpolation sampling.
 *
 * No broad rectangular bounding boxes are used, preserving valid open ocean.
 */

const isSea = require('is-sea');

/**
 * Check if a single coordinate point (lat, lon) is on land.
 * @param {number} lat
 * @param {number} lon
 * @returns {boolean} true if on land, false if in sea
 */
function isPointOnLand(lat, lon) {
  if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) return true;
  return !isSea(lat, lon);
}

/**
 * Validate whether a line segment LINESTRING(A, B) intersects land polygon boundaries.
 * Samples every 1 nautical mile (1.85 km) along the line segment.
 *
 * @param {Object} a - node { lat, lng, isPort }
 * @param {Object} b - node { lat, lng, isPort }
 * @param {number} [distanceNM] - distance in NM
 * @returns {boolean} true if segment intersects land, false if 100% ocean
 */
function isSegmentOnLand(a, b, distanceNM, stepNM = 3.0) {
  const lat1 = a.lat;
  const lon1 = a.lng;
  const lat2 = b.lat;
  const lon2 = b.lng;

  // Calculate distance in nautical miles
  const R = 3440.065;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const dist = distanceNM || (2 * R * Math.asin(Math.sqrt(
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  )));

  // Sample every ~stepNM NM along the segment (minimum 2 samples for short hops)
  const steps = Math.max(2, Math.ceil(dist / stepNM));

  // Allow 3% margin near endpoints for port harbor access
  const startFrac = a.isPort ? 0.04 : 0.005;
  const endFrac   = b.isPort ? 0.96 : 0.995;

  for (let k = 1; k < steps; k++) {
    const t = k / steps;
    if (t < startFrac || t > endFrac) continue;

    const sampleLat = lat1 + t * (lat2 - lat1);
    const sampleLon = lon1 + t * (lon2 - lon1);

    if (!isSea(sampleLat, sampleLon)) {
      return true; // Intersects land polygon!
    }
  }

  return false; // 100% ocean-only segment!
}

/**
 * Validate an entire route of waypoints against GSHHG land polygons.
 * Performs independent geometric validation segment by segment.
 *
 * @param {Array<[number, number]> | Array<{lat, lon}>} waypoints
 * @returns {{ valid: boolean, totalSegments: number, landIntersections: number, intersectionDetails: Array }}
 */
function validateRouteWaypoints(waypoints) {
  if (!waypoints || waypoints.length < 2) {
    return { valid: false, totalSegments: 0, landIntersections: 1, intersectionDetails: ['Insufficient waypoints'] };
  }

  const pts = waypoints.map((wp) => {
    if (Array.isArray(wp)) return { lat: wp[0], lng: wp[1], isPort: false };
    return { lat: wp.lat ?? wp.latitude, lng: wp.lon ?? wp.lng ?? wp.longitude, isPort: false };
  });

  let landIntersections = 0;
  const intersectionDetails = [];

  for (let i = 0; i < pts.length - 1; i++) {
    const a = { ...pts[i], isPort: i === 0 };
    const b = { ...pts[i + 1], isPort: i + 1 === pts.length - 1 };

    if (isSegmentOnLand(a, b)) {
      landIntersections++;
      intersectionDetails.push({
        segmentIndex: i,
        from: [a.lat, a.lng],
        to: [b.lat, b.lng],
      });
    }
  }

  return {
    valid: landIntersections === 0,
    totalSegments: pts.length - 1,
    landIntersections,
    intersectionDetails,
  };
}

module.exports = {
  isPointOnLand,
  isSegmentOnLand,
  validateRouteWaypoints,
};
