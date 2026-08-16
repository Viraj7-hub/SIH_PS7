'use strict';

/**
 * services/cost.normalizer.js
 * ═══════════════════════════════════════════════════════════════════
 * Multi-Objective Cost Normalization and Weight Computation
 * ═══════════════════════════════════════════════════════════════════
 *
 * Problem: fuel cost (tons), travel time (hours), and safety risk (0-100)
 * have completely different numeric scales. Without normalization, whichever
 * dimension has the largest raw values dominates the cost function regardless
 * of user priorities.
 *
 * Solution: min-max normalization per dimension across all edges in the
 * current graph. Each dimension is scaled to [0, 1]. The weighted sum
 * then correctly reflects the user's stated priorities.
 *
 * Cost function:
 *   edgeCost(e) = wFuel   * norm(e.fuelCost)
 *               + wTime   * norm(e.travelTimeHrs)
 *               + wSafety * norm(e.safetyRisk)
 *
 * Weight derivation from boolean priorities:
 *   Each true priority gets a HIGH share; each false priority gets a LOW share.
 *   HIGH = 0.85 / count(true)  distributed equally among true priorities
 *   LOW  = 0.15 / count(false) distributed equally among false priorities
 *   If all are false or all are true, equal weights are used.
 *   Weights always sum to exactly 1.0.
 *
 * Example:
 *   fuel=true,  time=false, safety=true  → wFuel=0.425, wTime=0.15, wSafety=0.425
 *   fuel=true,  time=true,  safety=false → wFuel=0.425, wTime=0.425, wSafety=0.15
 *   fuel=false, time=false, safety=true  → wFuel=0.075, wTime=0.075, wSafety=0.85
 *   all true                              → wFuel=0.333, wTime=0.333, wSafety=0.334
 *   all false                             → wFuel=0.333, wTime=0.333, wSafety=0.334
 */

// ─── Weight Calculation ───────────────────────────────────────────────────────

const HIGH_SHARE = 0.85;
const LOW_SHARE  = 0.15;

/**
 * Convert boolean priority flags into numeric weights that sum to 1.
 *
 * @param {{ fuel: boolean, time: boolean, safety: boolean }} priorities
 * @returns {{ wFuel: number, wTime: number, wSafety: number }}
 */
function computeWeights(priorities = {}) {
  const fuel   = Boolean(priorities.fuel);
  const time   = Boolean(priorities.time);
  const safety = Boolean(priorities.safety);

  const trueCount  = [fuel, time, safety].filter(Boolean).length;
  const falseCount = 3 - trueCount;

  // Equal distribution when all same
  if (trueCount === 0 || trueCount === 3) {
    return { wFuel: 1 / 3, wTime: 1 / 3, wSafety: 1 / 3 };
  }

  const highPer = HIGH_SHARE / trueCount;
  const lowPer  = falseCount > 0 ? LOW_SHARE / falseCount : 0;

  return {
    wFuel:   fuel   ? highPer : lowPer,
    wTime:   time   ? highPer : lowPer,
    wSafety: safety ? highPer : lowPer,
  };
}

// ─── Normalization ────────────────────────────────────────────────────────────

/**
 * Pre-compute min and max for each cost dimension across all graph edges.
 * This allows O(1) normalization per edge during pathfinding.
 *
 * @param {Array} edges  - flat array of all valid edge objects from the graph
 * @returns {{ fuel: {min, max}, time: {min, max}, risk: {min, max} }}
 */
function computeNormalizationBounds(edges) {
  if (!edges || edges.length === 0) {
    return {
      fuel: { min: 0, max: 1 },
      time: { min: 0, max: 1 },
      risk: { min: 0, max: 1 },
    };
  }

  let fuelMin = Infinity, fuelMax = -Infinity;
  let timeMin = Infinity, timeMax = -Infinity;
  let riskMin = Infinity, riskMax = -Infinity;

  for (const e of edges) {
    if (e.fuelCost       < fuelMin) fuelMin = e.fuelCost;
    if (e.fuelCost       > fuelMax) fuelMax = e.fuelCost;
    if (e.travelTimeHrs  < timeMin) timeMin = e.travelTimeHrs;
    if (e.travelTimeHrs  > timeMax) timeMax = e.travelTimeHrs;
    if (e.safetyRisk     < riskMin) riskMin = e.safetyRisk;
    if (e.safetyRisk     > riskMax) riskMax = e.safetyRisk;
  }

  // Prevent division by zero when all values are identical
  return {
    fuel: { min: fuelMin, max: fuelMax === fuelMin ? fuelMin + 1 : fuelMax },
    time: { min: timeMin, max: timeMax === timeMin ? timeMin + 1 : timeMax },
    risk: { min: riskMin, max: riskMax === riskMin ? riskMin + 1 : riskMax },
  };
}

/**
 * Normalize a single value using pre-computed bounds.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number} value in [0, 1]
 */
function normalize(value, min, max) {
  if (max === min) return 0;
  return (value - min) / (max - min);
}

// ─── Edge Cost Functions ──────────────────────────────────────────────────────

/**
 * Build an edge-cost function for STANDARD routing (minimize distance only).
 * Used by Dijkstra for the baseline route.
 *
 * @returns {Function} (edge) => number
 */
function makeDistanceCostFn() {
  return (edge) => edge.distanceNM;
}

/**
 * Build a multi-objective edge-cost function for OPTIMIZED routing.
 * Used by A* for the priority-weighted route.
 *
 * @param {{ wFuel, wTime, wSafety }} weights
 * @param {{ fuel, time, risk }} bounds  - normalization bounds
 * @param {Array} [weatherConditions]    - optional weather data to inject into risk
 * @returns {Function} (edge) => number
 */
function makeMultiObjectiveCostFn(weights, bounds, weatherConditions = []) {
  const { wFuel, wTime, wSafety } = weights;
  const { fuel, time, risk } = bounds;

  // Build a quick lookup: for each edge, can we apply weather risk?
  // Weather conditions are lat/lng points with a risk score.
  // We use a simple proximity check: if a weather point is within 200 NM
  // of either endpoint, its risk contributes to the edge risk.
  // This is a lightweight approximation — Member 3 can refine.
  const weatherLookup = Array.isArray(weatherConditions) ? weatherConditions : [];

  return (edge, fromNode, toNode) => {
    // Inject weather risk if nodes are provided
    let effectiveRisk = edge.safetyRisk;
    if (fromNode && toNode && weatherLookup.length > 0) {
      const weatherBoost = getWeatherRiskForEdge(fromNode, toNode, weatherLookup);
      effectiveRisk = Math.min(100, effectiveRisk + weatherBoost);
    }

    const nFuel = normalize(edge.fuelCost, fuel.min, fuel.max);
    const nTime = normalize(edge.travelTimeHrs, time.min, time.max);
    const nRisk = normalize(effectiveRisk, risk.min, risk.max);

    return wFuel * nFuel + wTime * nTime + wSafety * nRisk;
  };
}

/**
 * Estimate weather risk contribution for an edge between two nodes.
 * Finds weather observations within 200 NM of the edge midpoint.
 *
 * @param {{ lat, lng }} fromNode
 * @param {{ lat, lng }} toNode
 * @param {Array<{lat, lng, riskScore}>} weatherConditions
 * @returns {number} additional risk [0, 50]
 */
function getWeatherRiskForEdge(fromNode, toNode, weatherConditions) {
  const { haversineNM } = require('./graph.builder');
  const PROXIMITY_NM = 200;

  // Use midpoint of edge
  const midLat = (fromNode.lat + toNode.lat) / 2;
  const midLng = (fromNode.lng + toNode.lng) / 2;

  let maxWeatherRisk = 0;
  for (const obs of weatherConditions) {
    if (!obs || obs.riskScore == null) continue;
    const d = haversineNM(midLat, midLng, obs.lat, obs.lng);
    if (d <= PROXIMITY_NM) {
      const contribution = obs.riskScore * (1 - d / PROXIMITY_NM); // linear decay
      if (contribution > maxWeatherRisk) maxWeatherRisk = contribution;
    }
  }

  // Scale to a max additional risk of 50 points
  return (maxWeatherRisk / 100) * 50;
}

// ─── Explanation Generator ────────────────────────────────────────────────────

/**
 * Generate a human-readable explanation derived from actual optimization results.
 * NOT random — derived from the real numeric differences between routes.
 *
 * @param {Object} standard  - { distanceNM, totalTime, totalFuel, totalRisk }
 * @param {Object} optimized - { distanceNM, totalTime, totalFuel, totalRisk }
 * @param {{ wFuel, wTime, wSafety }} weights
 * @param {{ fuel, time, safety }} priorities
 * @returns {{ summary: string, factors: Array }}
 */
function generateExplanation(standard, optimized, weights, priorities) {
  const factors = [];
  const improvements = [];
  const tradeoffs    = [];

  // Fuel comparison
  const fuelDiff   = standard.totalFuel - optimized.totalFuel;
  const fuelPct    = standard.totalFuel > 0 ? (fuelDiff / standard.totalFuel) * 100 : 0;

  if (fuelPct > 0.5) {
    factors.push({
      factor: 'Fuel',
      impact: 'positive',
      reason: `Fuel consumption reduced by ${fuelPct.toFixed(1)}% through more efficient routing`,
    });
    improvements.push(`${fuelPct.toFixed(1)}% less fuel`);
  } else if (fuelPct < -0.5) {
    factors.push({
      factor: 'Fuel',
      impact: 'negative',
      reason: `Fuel consumption increased by ${Math.abs(fuelPct).toFixed(1)}% due to longer detour`,
    });
    tradeoffs.push(`${Math.abs(fuelPct).toFixed(1)}% more fuel`);
  } else {
    factors.push({ factor: 'Fuel', impact: 'neutral', reason: 'Fuel consumption similar to standard route' });
  }

  // Time comparison
  const timeDiff = standard.totalTime - optimized.totalTime;
  const timePct  = standard.totalTime > 0 ? (timeDiff / standard.totalTime) * 100 : 0;

  if (timePct > 0.5) {
    factors.push({
      factor: 'Time',
      impact: 'positive',
      reason: `Travel time reduced by ${timePct.toFixed(1)}% on this route`,
    });
    improvements.push(`${timePct.toFixed(1)}% faster`);
  } else if (timePct < -0.5) {
    factors.push({
      factor: 'Time',
      impact: 'negative',
      reason: `Route is ${Math.abs(timePct).toFixed(1)}% longer in time due to detour for other objectives`,
    });
    tradeoffs.push(`${Math.abs(timePct).toFixed(1)}% more time`);
  } else {
    factors.push({ factor: 'Time', impact: 'neutral', reason: 'Travel time similar to standard route' });
  }

  // Safety comparison
  const riskDiff = standard.totalRisk - optimized.totalRisk;
  const riskPct  = standard.totalRisk > 0 ? (riskDiff / standard.totalRisk) * 100 : 0;

  if (riskPct > 2) {
    factors.push({
      factor: 'Safety',
      impact: 'positive',
      reason: `Route risk reduced by ${riskPct.toFixed(1)}% by avoiding high-risk corridors`,
    });
    improvements.push(`${riskPct.toFixed(1)}% safer`);
  } else if (riskPct < -2) {
    factors.push({
      factor: 'Safety',
      impact: 'negative',
      reason: `Route passes through slightly higher-risk zones (${Math.abs(riskPct).toFixed(1)}% more risk)`,
    });
    tradeoffs.push(`${Math.abs(riskPct).toFixed(1)}% higher risk`);
  } else {
    factors.push({ factor: 'Safety', impact: 'neutral', reason: 'Route safety similar to standard route' });
  }

  // Priority context
  const priorityNames = [];
  if (priorities.fuel)   priorityNames.push('fuel efficiency');
  if (priorities.time)   priorityNames.push('travel time');
  if (priorities.safety) priorityNames.push('safety');
  const priorityStr = priorityNames.length > 0
    ? `optimised for ${priorityNames.join(' and ')}`
    : 'balanced across all objectives';

  // Summary
  let summary;
  if (improvements.length > 0 && tradeoffs.length > 0) {
    summary = `The optimized route (${priorityStr}) achieves ${improvements.join(', ')} at the cost of ${tradeoffs.join(', ')}.`;
  } else if (improvements.length > 0) {
    summary = `The optimized route (${priorityStr}) improves across all measured dimensions: ${improvements.join(', ')}.`;
  } else if (tradeoffs.length > 0) {
    summary = `The optimized route (${priorityStr}) differs from the standard but within acceptable tradeoffs.`;
  } else {
    summary = `The optimized route (${priorityStr}) is similar to the standard route for this pair of ports.`;
  }

  return { summary, factors };
}

module.exports = {
  computeWeights,
  computeNormalizationBounds,
  normalize,
  makeDistanceCostFn,
  makeMultiObjectiveCostFn,
  generateExplanation,
};
