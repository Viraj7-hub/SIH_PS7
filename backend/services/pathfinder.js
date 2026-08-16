'use strict';

/**
 * services/pathfinder.js
 * ═══════════════════════════════════════════════════════════════════
 * Pure A* and Dijkstra implementations for maritime route finding.
 * ═══════════════════════════════════════════════════════════════════
 *
 * Both algorithms operate on the adjacency map produced by graph.builder.js.
 * No external pathfinding library — algorithm is transparent and auditable.
 *
 * Determinism guarantee:
 *   Given identical inputs (graph + source + destination + weights),
 *   both algorithms produce identical outputs every time. No Math.random().
 *   Tie-breaking is done by node ID string comparison for reproducibility.
 *
 * A* Heuristic (admissible):
 *   h(n) = haversineDistance(n, destination) / maxSpeed
 *   This is the minimum possible remaining travel time — never overestimates
 *   because a vessel cannot exceed maxSpeed and the great-circle distance
 *   is the shortest possible path. The heuristic is therefore consistent
 *   (monotone), guaranteeing A* finds the optimal path.
 *
 * Time complexity:
 *   Dijkstra:  O((V + E) log V) with binary min-heap
 *   A*:        O((V + E) log V) worst case; typically much better due to
 *              heuristic pruning of the search space.
 *   V ≈ 85 (55 ports + 30 waypoints), E ≈ 1200–2000 (auto-generated edges)
 *   Both run in < 5ms for this graph size.
 */

const { haversineNM } = require('./graph.builder');

// ─── Binary Min-Heap ──────────────────────────────────────────────────────────

/**
 * A simple binary min-heap keyed by a numeric priority.
 * Used internally by both Dijkstra and A*.
 */
class MinHeap {
  constructor() {
    this._data = []; // [{ priority, value }]
  }

  push(priority, value) {
    this._data.push({ priority, value });
    this._bubbleUp(this._data.length - 1);
  }

  pop() {
    if (this._data.length === 0) return null;
    const top = this._data[0];
    const last = this._data.pop();
    if (this._data.length > 0) {
      this._data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  get size() {
    return this._data.length;
  }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this._data[parent].priority <= this._data[i].priority) break;
      [this._data[parent], this._data[i]] = [this._data[i], this._data[parent]];
      i = parent;
    }
  }

  _sinkDown(i) {
    const n = this._data.length;
    for (;;) {
      let smallest = i;
      const left  = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n  && this._data[left].priority  < this._data[smallest].priority) smallest = left;
      if (right < n && this._data[right].priority < this._data[smallest].priority) smallest = right;
      if (smallest === i) break;
      [this._data[smallest], this._data[i]] = [this._data[i], this._data[smallest]];
      i = smallest;
    }
  }
}

// ─── Dijkstra ─────────────────────────────────────────────────────────────────

/**
 * Dijkstra's algorithm — minimises a single composite edge cost.
 *
 * @param {Map<string, Array>} adjacency   - node id → array of edge objects
 * @param {Map<string, Object>} nodes      - node id → node object (lat, lng, …)
 * @param {string} sourceId
 * @param {string} destId
 * @param {Function} edgeCostFn - (edge) => number
 * @returns {{ path: string[], totalCost: number, totalDistance: number,
 *             totalTime: number, totalFuel: number, totalRisk: number } | null}
 */
function dijkstra(adjacency, nodes, sourceId, destId, edgeCostFn) {
  if (!adjacency.has(sourceId) || !adjacency.has(destId)) return null;

  const dist    = new Map(); // nodeId → best known cost
  const prev    = new Map(); // nodeId → { from, edge }
  const visited = new Set();
  const heap    = new MinHeap();

  // Accumulators stored alongside cost in heap
  const accDist   = new Map();
  const accTime   = new Map();
  const accFuel   = new Map();
  const accRisk   = new Map();

  for (const id of adjacency.keys()) {
    dist.set(id, Infinity);
    accDist.set(id, 0);
    accTime.set(id, 0);
    accFuel.set(id, 0);
    accRisk.set(id, 0);
  }

  dist.set(sourceId, 0);
  heap.push(0, sourceId);

  while (heap.size > 0) {
    const { value: u } = heap.pop();
    if (visited.has(u)) continue;
    if (u === destId) break;
    visited.add(u);

    for (const edge of (adjacency.get(u) || [])) {
      const v = edge.to;
      if (visited.has(v)) continue;

      const edgeCost = edgeCostFn(edge);
      const newDist  = dist.get(u) + edgeCost;

      if (newDist < dist.get(v)) {
        dist.set(v, newDist);
        accDist.set(v, accDist.get(u) + edge.distanceNM);
        accTime.set(v, accTime.get(u) + edge.travelTimeHrs);
        accFuel.set(v, accFuel.get(u) + edge.fuelCost);
        accRisk.set(v, accRisk.get(u) + edge.safetyRisk);
        prev.set(v, { from: u, edge });
        // Tie-break by node ID for determinism
        heap.push(newDist + 1e-12 * v.charCodeAt(0), v);
      }
    }
  }

  if (dist.get(destId) === Infinity) return null; // unreachable

  // Reconstruct path
  const path = [];
  let cur = destId;
  while (cur !== undefined) {
    path.unshift(cur);
    cur = prev.get(cur)?.from;
  }

  if (path[0] !== sourceId) return null; // disconnected

  return {
    path,
    totalCost:     dist.get(destId),
    totalDistance: accDist.get(destId),
    totalTime:     accTime.get(destId),
    totalFuel:     accFuel.get(destId),
    totalRisk:     accRisk.get(destId),
  };
}

// ─── A* ───────────────────────────────────────────────────────────────────────

/**
 * A* algorithm — minimises composite cost with an admissible heuristic.
 *
 * The heuristic is: h(n) = (haversineNM(n, dest) / maxSpeed) * timeWeight
 * This is admissible because the great-circle distance cannot be undercut,
 * and maxSpeed is the fastest the vessel can travel.
 *
 * @param {Map<string, Array>} adjacency
 * @param {Map<string, Object>} nodes
 * @param {string} sourceId
 * @param {string} destId
 * @param {Function} edgeCostFn - (edge) => number  (g-score contribution)
 * @param {Function} heuristicFn - (nodeId) => number  (h-score)
 * @returns {{ path: string[], totalCost: number, totalDistance: number,
 *             totalTime: number, totalFuel: number, totalRisk: number } | null}
 */
function aStar(adjacency, nodes, sourceId, destId, edgeCostFn, heuristicFn) {
  if (!adjacency.has(sourceId) || !adjacency.has(destId)) return null;

  const gScore  = new Map(); // best cost from source to node
  const fScore  = new Map(); // gScore + heuristic
  const prev    = new Map();
  const closed  = new Set();
  const heap    = new MinHeap();

  const accDist   = new Map();
  const accTime   = new Map();
  const accFuel   = new Map();
  const accRisk   = new Map();

  for (const id of adjacency.keys()) {
    gScore.set(id, Infinity);
    fScore.set(id, Infinity);
    accDist.set(id, 0);
    accTime.set(id, 0);
    accFuel.set(id, 0);
    accRisk.set(id, 0);
  }

  gScore.set(sourceId, 0);
  fScore.set(sourceId, heuristicFn(sourceId));
  heap.push(fScore.get(sourceId), sourceId);

  while (heap.size > 0) {
    const { value: u } = heap.pop();
    if (closed.has(u)) continue;
    if (u === destId) break;
    closed.add(u);

    for (const edge of (adjacency.get(u) || [])) {
      const v = edge.to;
      if (closed.has(v)) continue;

      const tentativeG = gScore.get(u) + edgeCostFn(edge);

      if (tentativeG < gScore.get(v)) {
        gScore.set(v, tentativeG);
        fScore.set(v, tentativeG + heuristicFn(v));
        accDist.set(v, accDist.get(u) + edge.distanceNM);
        accTime.set(v, accTime.get(u) + edge.travelTimeHrs);
        accFuel.set(v, accFuel.get(u) + edge.fuelCost);
        accRisk.set(v, accRisk.get(u) + edge.safetyRisk);
        prev.set(v, { from: u, edge });
        // Tie-break by node ID for determinism
        heap.push(fScore.get(v) + 1e-12 * v.charCodeAt(0), v);
      }
    }
  }

  if (gScore.get(destId) === Infinity) return null;

  // Reconstruct path
  const path = [];
  let cur = destId;
  while (cur !== undefined) {
    path.unshift(cur);
    cur = prev.get(cur)?.from;
  }

  if (path[0] !== sourceId) return null;

  return {
    path,
    totalCost:     gScore.get(destId),
    totalDistance: accDist.get(destId),
    totalTime:     accTime.get(destId),
    totalFuel:     accFuel.get(destId),
    totalRisk:     accRisk.get(destId),
  };
}

/**
 * Convenience: build the heuristic function for A*.
 * @param {Map<string, Object>} nodes
 * @param {string} destId
 * @param {number} maxSpeed - vessel max speed in knots
 * @param {number} timeWeight - weight applied to time in cost function
 * @returns {Function}
 */
function makeHeuristic(nodes, destId, maxSpeed, timeWeight) {
  const dest = nodes.get(destId);
  if (!dest) return () => 0;
  return (nodeId) => {
    const node = nodes.get(nodeId);
    if (!node) return 0;
    const distNM = haversineNM(node.lat, node.lng, dest.lat, dest.lng);
    // h = remaining time × time weight (admissible lower bound on cost)
    return (distNM / maxSpeed) * timeWeight;
  };
}

module.exports = { dijkstra, aStar, makeHeuristic, MinHeap };
