'use strict';

/**
 * services/route.service.js
 * ═══════════════════════════════════════════════════════════════════
 * Nautilus Route Intelligence Engine
 * ═══════════════════════════════════════════════════════════════════
 *
 * Replaces the original stub with real multi-objective route optimization.
 *
 * Exports:
 *   optimizeRoute(params)       — legacy API used by Dashboard.jsx
 *   optimizeNautilusRoute(params) — full Nautilus API (POST /api/routes/optimize)
 *   getRouteById(id)            — retrieve persisted result
 *
 * Algorithm:
 *   Standard  → Dijkstra (minimize distance)
 *   Optimized → A* with Haversine heuristic (minimize weighted cost)
 *
 * No Math.random() is used anywhere in this file.
 */

const { pool }    = require('../config/db');
const portModel   = require('../models/port.model');
const shipModel   = require('../models/ship.model');
const { AppError } = require('../middleware/error.middleware');

const { buildGraph, nodeDistance }      = require('./graph.builder');
const { dijkstra, aStar, makeHeuristic } = require('./pathfinder');
const {
  computeWeights,
  computeNormalizationBounds,
  makeDistanceCostFn,
  makeMultiObjectiveCostFn,
  generateExplanation,
} = require('./cost.normalizer');

// ─── Weather Interface ────────────────────────────────────────────────────────

/**
 * Fetch weather conditions along a route from Member 3's service.
 * Fails gracefully — route optimization continues with base risk if unavailable.
 *
 * @param {Array<string>} nodeIds - ordered node IDs along the route
 * @param {Map} nodes             - node map from graph
 * @returns {Promise<Array>}      - weather risk points or []
 */
async function fetchWeatherConditions(nodeIds, nodes) {
  try {
    const weatherService = require('./weather.service');
    if (typeof weatherService.getConditionsAlongRoute !== 'function') {
      // Member 3 hasn't implemented this yet — use existing stub data
      return [];
    }
    const waypoints = nodeIds.map((id) => {
      const n = nodes.get(id);
      return n ? { lat: n.lat, lng: n.lng } : null;
    }).filter(Boolean);

    return await weatherService.getConditionsAlongRoute(waypoints);
  } catch {
    // Weather service unavailable — degrade gracefully
    return [];
  }
}

// ─── Path → Waypoints ────────────────────────────────────────────────────────

/**
 * Convert a node ID path into [lat, lng] coordinate pairs.
 * @param {string[]} path
 * @param {Map} nodes
 * @returns {Array<[number, number]>}
 */
function pathToWaypoints(path, nodes) {
  return path.map((id) => {
    const n = nodes.get(id);
    return n ? [n.lat, n.lng] : null;
  }).filter(Boolean);
}

// ─── Risk Score Normalisation ─────────────────────────────────────────────────

/**
 * Convert a raw accumulated risk into a 0-100 safety score.
 * Higher score = safer. Raw risk is per-edge sum; divide by path length.
 * @param {number} totalRisk
 * @param {number} pathLength  number of edges (nodes - 1)
 * @returns {number} safetyScore 0-100 (100 = safest)
 */
function riskToSafetyScore(totalRisk, pathLength) {
  if (!pathLength || pathLength === 0) return 100;
  const avgRisk = totalRisk / pathLength;
  return Math.round(Math.max(0, Math.min(100, 100 - avgRisk)));
}

/**
 * Categorise a safety score into a risk level label.
 * @param {number} score 0-100
 * @returns {string}
 */
function scoreToRiskLevel(score) {
  if (score >= 80) return 'safe';
  if (score >= 60) return 'moderate';
  if (score >= 40) return 'elevated';
  return 'high';
}

// ─── Persist Route Result ─────────────────────────────────────────────────────

/**
 * Save route request and result to MySQL.
 * Returns the saved route_results.id.
 *
 * @param {Object} req   - request params
 * @param {Object} std   - standard route result
 * @param {Object} opt   - optimized route result
 * @param {Object} weights
 * @param {Object} explanation
 * @returns {Promise<number>} routeResultId
 */
async function persistResult(req, std, opt, weights, explanation) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // We don't require a voyage_id for standalone Nautilus requests.
    // Insert a route_request row with voyage_id = NULL (requires schema to allow NULL).
    // If voyage_id has NOT NULL constraint, skip persistence and return -1.
    let requestId = null;
    try {
      const [rr] = await conn.execute(
        `INSERT INTO route_requests
           (voyage_id, priority_fuel, priority_time, priority_safety,
            vessel_type, max_speed, draft, status,
            weight_fuel, weight_time, weight_safety)
         VALUES (NULL, ?, ?, ?, ?, ?, ?, 'COMPLETE', ?, ?, ?)`,
        [
          req.priorities.fuel   ? 1 : 0,
          req.priorities.time   ? 1 : 0,
          req.priorities.safety ? 1 : 0,
          req.vessel.type       || 'Container Ship',
          req.vessel.maxSpeed   || 14,
          req.vessel.draft      || 12,
          parseFloat(weights.wFuel.toFixed(4)),
          parseFloat(weights.wTime.toFixed(4)),
          parseFloat(weights.wSafety.toFixed(4)),
        ]
      );
      requestId = rr.insertId;
    } catch {
      // If voyage_id NOT NULL, skip persistence
      await conn.rollback();
      conn.release();
      return -1;
    }

    const [rs] = await conn.execute(
      `INSERT INTO route_results
         (route_request_id, algorithm,
          waypoints_json, distance_km, estimated_time_hrs, fuel_estimate_tons, safety_score,
          distance_nm,
          optimized_waypoints_json, optimized_distance_nm,
          optimized_time_hrs, optimized_fuel_tons, explanation_json)
       VALUES (?, 'Multi-Objective A*',
               ?, ?, ?, ?, ?,
               ?,
               ?, ?,
               ?, ?, ?)`,
      [
        requestId,
        JSON.stringify(std.waypoints),
        parseFloat((std.totalDistance * 1.852).toFixed(3)),  // NM → km
        parseFloat(std.totalTime.toFixed(2)),
        parseFloat(std.totalFuel.toFixed(4)),
        riskToSafetyScore(std.totalRisk, std.path.length - 1),
        parseFloat(std.totalDistance.toFixed(3)),
        JSON.stringify(opt.waypoints),
        parseFloat(opt.totalDistance.toFixed(3)),
        parseFloat(opt.totalTime.toFixed(2)),
        parseFloat(opt.totalFuel.toFixed(4)),
        JSON.stringify(explanation),
      ]
    );

    await conn.commit();
    return rs.insertId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ─── Core Optimization Logic ──────────────────────────────────────────────────

/**
 * Run both standard and optimized route algorithms.
 *
 * @param {Object} params
 * @param {string}  params.sourcePortId
 * @param {string}  params.destinationPortId
 * @param {Object}  params.vessel       - { type, maxSpeed, draft, fuelConsumption }
 * @param {Object}  params.priorities   - { fuel, time, safety }
 * @returns {Promise<Object>}  Full Nautilus response data
 */
async function runOptimization({ sourcePortId, destinationPortId, vessel, priorities }) {
  // 1. Validate ports exist
  const [srcPort, dstPort] = await Promise.all([
    portModel.findById(sourcePortId),
    portModel.findById(destinationPortId),
  ]);

  if (!srcPort) throw new AppError(`Port '${sourcePortId}' not found.`, 'NOT_FOUND');
  if (!dstPort) throw new AppError(`Port '${destinationPortId}' not found.`, 'NOT_FOUND');

  // 2. Build graph with vessel constraints
  const vesselSpec = {
    maxSpeed:        parseFloat(vessel.maxSpeed)        || 14,
    draft:           parseFloat(vessel.draft)           || 12,
    fuelConsumption: parseFloat(vessel.fuelConsumption) || 0.035,
    type:            vessel.type                        || 'Container Ship',
  };

  const { nodes, adjacency, allEdges } = await buildGraph(vesselSpec);

  // Verify source and destination are in graph
  if (!nodes.has(sourcePortId)) {
    throw new AppError(`Port '${sourcePortId}' is not reachable in the current graph.`, 'NOT_FOUND');
  }
  if (!nodes.has(destinationPortId)) {
    throw new AppError(`Port '${destinationPortId}' is not reachable in the current graph.`, 'NOT_FOUND');
  }

  // 3. Compute weights and normalisation bounds
  const weights = computeWeights(priorities);
  const bounds  = computeNormalizationBounds(allEdges);

  // 4. Standard route — minimize distance (Dijkstra)
  const distanceCostFn = makeDistanceCostFn();
  const standardResult = dijkstra(adjacency, nodes, sourcePortId, destinationPortId, distanceCostFn);

  if (!standardResult) {
    throw new AppError(
      `No navigable route found from ${srcPort.name} to ${dstPort.name}. ` +
      `Check vessel draft constraints or try a different port pair.`,
      'NOT_FOUND'
    );
  }

  // 5. Fetch weather (graceful — won't crash if unavailable)
  const weatherConditions = await fetchWeatherConditions(standardResult.path, nodes);

  // 6. Optimized route — A* with multi-objective cost
  const multiCostFn = makeMultiObjectiveCostFn(weights, bounds, weatherConditions);

  // Wrap cost function to pass node objects for weather proximity
  const multiCostWithNodes = (edge) => {
    const fromNode = nodes.get(edge.from);
    const toNode   = nodes.get(edge.to);
    return multiCostFn(edge, fromNode, toNode);
  };

  const heuristic = makeHeuristic(nodes, destinationPortId, vesselSpec.maxSpeed, weights.wTime);
  const optimizedResult = aStar(
    adjacency, nodes, sourcePortId, destinationPortId,
    multiCostWithNodes, heuristic
  );

  // Fall back to Dijkstra result if A* fails (should not happen with connected graph)
  const finalOptimized = optimizedResult || standardResult;

  // 7. Build waypoint arrays
  const stdWaypoints = pathToWaypoints(standardResult.path, nodes);
  const optWaypoints = pathToWaypoints(finalOptimized.path, nodes);

  // 8. Compute metrics
  const stdEdges  = standardResult.path.length - 1  || 1;
  const optEdges  = finalOptimized.path.length - 1  || 1;
  const stdSafety = riskToSafetyScore(standardResult.totalRisk, stdEdges);
  const optSafety = riskToSafetyScore(finalOptimized.totalRisk, optEdges);

  const fuelSavedPct = standardResult.totalFuel > 0
    ? ((standardResult.totalFuel - finalOptimized.totalFuel) / standardResult.totalFuel) * 100
    : 0;

  const etaHrs  = parseFloat(finalOptimized.totalTime.toFixed(2));
  const etaDays = parseFloat((etaHrs / 24).toFixed(2));

  // 9. Weather summary
  const weatherSummary = weatherConditions.length > 0
    ? buildWeatherSummary(weatherConditions)
    : 'Weather data not available; base risk estimates used.';

  // 10. Explanation
  const explanation = generateExplanation(
    { distanceNM: standardResult.totalDistance, totalTime: standardResult.totalTime, totalFuel: standardResult.totalFuel, totalRisk: standardResult.totalRisk },
    { distanceNM: finalOptimized.totalDistance, totalTime: finalOptimized.totalTime, totalFuel: finalOptimized.totalFuel, totalRisk: finalOptimized.totalRisk },
    weights, priorities
  );

  // 11. Persist (non-blocking — don't fail optimization if DB write fails)
  let routeId = -1;
  try {
    routeId = await persistResult(
      { priorities, vessel: vesselSpec },
      { ...standardResult, waypoints: stdWaypoints },
      { ...finalOptimized, waypoints: optWaypoints },
      weights,
      explanation
    );
  } catch {
    // Persistence failure — log but don't crash
    console.warn('[route.service] Failed to persist route result');
  }

  return {
    routeId,
    source: {
      id:   srcPort.id,
      name: srcPort.name,
      lat:  parseFloat(srcPort.latitude),
      lng:  parseFloat(srcPort.longitude),
    },
    destination: {
      id:   dstPort.id,
      name: dstPort.name,
      lat:  parseFloat(dstPort.latitude),
      lng:  parseFloat(dstPort.longitude),
    },
    standardRoute: {
      waypoints:   stdWaypoints,
      distanceNM:  parseFloat(standardResult.totalDistance.toFixed(2)),
      durationHrs: parseFloat(standardResult.totalTime.toFixed(2)),
      fuelTons:    parseFloat(standardResult.totalFuel.toFixed(3)),
      avgSpeed:    vesselSpec.maxSpeed,
      safetyScore: stdSafety,
      nodeCount:   standardResult.path.length,
    },
    optimizedRoute: {
      waypoints:   optWaypoints,
      distanceNM:  parseFloat(finalOptimized.totalDistance.toFixed(2)),
      durationHrs: parseFloat(finalOptimized.totalTime.toFixed(2)),
      fuelTons:    parseFloat(finalOptimized.totalFuel.toFixed(3)),
      avgSpeed:    vesselSpec.maxSpeed,
      safetyScore: optSafety,
      nodeCount:   finalOptimized.path.length,
    },
    metrics: {
      fuelSavedPercent: parseFloat(fuelSavedPct.toFixed(2)),
      riskScore:        100 - optSafety,
      riskLevel:        scoreToRiskLevel(optSafety),
      weatherSummary,
      etaDays,
      etaHours:         etaHrs,
    },
    algorithm: {
      name:       'Multi-Objective A*',
      objectives: Object.entries(priorities).filter(([, v]) => v).map(([k]) => k),
      weights: {
        fuel:   parseFloat(weights.wFuel.toFixed(4)),
        time:   parseFloat(weights.wTime.toFixed(4)),
        safety: parseFloat(weights.wSafety.toFixed(4)),
      },
    },
    explanation,
  };
}

/**
 * Build a brief weather summary from condition observations.
 */
function buildWeatherSummary(conditions) {
  if (!conditions || conditions.length === 0) return 'Conditions unknown.';
  const avgRisk = conditions.reduce((s, c) => s + (c.riskScore || 0), 0) / conditions.length;
  if (avgRisk < 20) return 'Mostly clear with calm sea state along the route.';
  if (avgRisk < 40) return 'Generally moderate conditions with some wave activity.';
  if (avgRisk < 60) return 'Mixed conditions — elevated sea state in portions of the route.';
  return 'Challenging conditions — high-risk weather zones present along route.';
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Full Nautilus route optimization.
 * Called by POST /api/routes/optimize
 *
 * @param {Object} params
 * @param {string}  params.sourcePortId
 * @param {string}  params.destinationPortId
 * @param {Object}  params.vessel
 * @param {Object}  params.priorities
 * @returns {Promise<Object>}
 */
async function optimizeNautilusRoute({ sourcePortId, destinationPortId, vessel = {}, priorities = {} }) {
  if (sourcePortId === destinationPortId) {
    throw new AppError('Source and destination ports must be different.', 'VALIDATION_ERROR');
  }
  return runOptimization({ sourcePortId, destinationPortId, vessel, priorities });
}

/**
 * Legacy API — used by Dashboard.jsx via POST /api/route/optimize
 * Accepts a shipId and looks up ports from the ships table.
 * Returns shape compatible with the existing Dashboard.jsx.
 *
 * @param {Object} params
 * @param {string}  params.shipId
 * @param {string}  [params.sourcePortId]
 * @param {string}  [params.destPortId]
 * @param {Object}  [params.priorities]
 * @param {Object}  [params.vessel]
 * @returns {Promise<Object>}
 */
async function optimizeRoute({ shipId, sourcePortId, destPortId, priorities = {}, vessel = {} }) {
  let srcId  = sourcePortId;
  let dstId  = destPortId;
  let vesselSpec = vessel;

  // Look up ship if port IDs not explicitly provided
  if ((!srcId || !dstId) && shipId) {
    const ship = await shipModel.findByShipCode(shipId.toUpperCase());
    if (!ship) throw new AppError(`Ship '${shipId}' not found.`, 'NOT_FOUND');
    srcId     = srcId  || ship.source_port_id;
    dstId     = dstId  || ship.dest_port_id;
    vesselSpec = {
      type:            ship.type            || 'Container Ship',
      maxSpeed:        parseFloat(ship.max_speed)         || 14,
      draft:           parseFloat(ship.draft)             || 12,
      fuelConsumption: parseFloat(ship.fuel_consumption)  || 0.035,
    };
  }

  if (!srcId || !dstId) {
    throw new AppError('Cannot determine route: source or destination port not set.', 'NOT_FOUND');
  }
  if (srcId === dstId) {
    throw new AppError('Source and destination ports must be different.', 'VALIDATION_ERROR');
  }

  const result = await runOptimization({
    sourcePortId: srcId,
    destinationPortId: dstId,
    vessel: { ...vesselSpec, ...vessel },
    priorities,
  });

  // Return legacy shape for Dashboard.jsx
  return {
    algorithm:          result.algorithm.name,
    route:              result.optimizedRoute.waypoints.map(([lat, lon]) => ({ lat, lon })),
    distanceKm:         parseFloat((result.optimizedRoute.distanceNM * 1.852).toFixed(2)),
    estimatedTimeHours: result.optimizedRoute.durationHrs,
    fuelEstimate:       result.optimizedRoute.fuelTons,
    safetyScore:        result.optimizedRoute.safetyScore,
    shipId,
  };
}

/**
 * Retrieve a previously saved route result by route_results.id
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function getRouteById(id) {
  const [rows] = await pool.execute(
    `SELECT rr.id, rr.algorithm,
            rr.waypoints_json, rr.distance_km, rr.estimated_time_hrs,
            rr.fuel_estimate_tons, rr.safety_score, rr.distance_nm,
            rr.optimized_waypoints_json, rr.optimized_distance_nm,
            rr.optimized_time_hrs, rr.optimized_fuel_tons,
            rr.explanation_json, rr.created_at,
            req.priority_fuel, req.priority_time, req.priority_safety,
            req.weight_fuel, req.weight_time, req.weight_safety,
            req.vessel_type, req.max_speed, req.draft
     FROM route_results rr
     JOIN route_requests req ON req.id = rr.route_request_id
     WHERE rr.id = ?
     LIMIT 1`,
    [id]
  );

  if (!rows[0]) return null;

  const row = rows[0];
  return {
    id:                row.id,
    algorithm:         row.algorithm,
    createdAt:         row.created_at,
    vessel: {
      type:      row.vessel_type,
      maxSpeed:  row.max_speed,
      draft:     row.draft,
    },
    priorities: {
      fuel:   Boolean(row.priority_fuel),
      time:   Boolean(row.priority_time),
      safety: Boolean(row.priority_safety),
    },
    weights: {
      fuel:   row.weight_fuel,
      time:   row.weight_time,
      safety: row.weight_safety,
    },
    standardRoute: {
      waypoints:   JSON.parse(row.waypoints_json || '[]'),
      distanceNM:  row.distance_nm,
      distanceKm:  row.distance_km,
      durationHrs: row.estimated_time_hrs,
      fuelTons:    row.fuel_estimate_tons,
      safetyScore: row.safety_score,
    },
    optimizedRoute: {
      waypoints:   JSON.parse(row.optimized_waypoints_json || '[]'),
      distanceNM:  row.optimized_distance_nm,
      durationHrs: row.optimized_time_hrs,
      fuelTons:    row.optimized_fuel_tons,
    },
    explanation: row.explanation_json ? JSON.parse(row.explanation_json) : null,
  };
}

module.exports = { optimizeRoute, optimizeNautilusRoute, getRouteById };
