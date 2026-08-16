'use strict';

/**
 * services/route.service.js
 * ═══════════════════════════════════════════════════════════════════
 * STUB — Interface for Backend Member 2 (Route Optimization Engine)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Member 2: implement the functions in this file.
 * Do NOT change the function signatures or return shapes.
 * The existing Express routes and controllers will call these without modification.
 *
 * Dependencies available:
 *   - require('../config/db')     — MySQL pool for storing/retrieving results
 *   - require('../models/ship.model')
 *   - require('../models/port.model')
 *   - require('../middleware/error.middleware').AppError — for throwing errors
 *
 * Required npm packages you may add:
 *   - Any graph/pathfinding library (e.g. 'ngraph.graph', 'dijkstrajs')
 *   - Any geospatial library (e.g. '@turf/turf')
 *
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * Optimize a maritime route between two ports for a given ship.
 *
 * @param {Object} params
 * @param {string}  params.shipId       - Ship code, e.g. "SHIP001"
 * @param {string}  [params.sourcePortId] - Port id, e.g. "in-mum"
 * @param {string}  [params.destPortId]   - Port id, e.g. "lk-col"
 * @param {Object}  [params.priorities]   - { fuel: bool, time: bool, safety: bool }
 * @param {Object}  [params.vessel]       - { type: string, maxSpeed: number, draft: number }
 *
 * @returns {Promise<RouteResult>}
 *
 * RouteResult shape (must match Dashboard.jsx consumption):
 * {
 *   algorithm:          string,          // e.g. "Multi-Objective Dijkstra"
 *   route:              Array<{lat, lon}>,
 *   distanceKm:         number,
 *   estimatedTimeHours: number,
 *   fuelEstimate:       number,          // tons
 *   safetyScore:        number,          // 0-100
 *   shipId:             string,
 * }
 */
async function optimizeRoute({ shipId, sourcePortId, destPortId, priorities = {}, vessel = {} }) {
  // ── MOCK STUB — returns hardcoded data to preserve Dashboard.jsx ──
  // Member 2 replaces this implementation.
  return {
    algorithm:          'Multi-Objective Dijkstra',
    route: [
      { lat: 18.9388, lon: 72.8354 },
      { lat: 18.2,    lon: 74.0    },
      { lat: 15.5,    lon: 76.5    },
      { lat: 12.5,    lon: 78.5    },
      { lat: 9.5,     lon: 79.5    },
      { lat: 6.9271,  lon: 79.8612 },
    ],
    distanceKm:         1190,
    estimatedTimeHours: 28.6,
    fuelEstimate:       38.2,
    safetyScore:        92,
    shipId,
  };
}

module.exports = { optimizeRoute };
