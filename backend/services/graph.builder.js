'use strict';

/**
 * services/graph.builder.js
 * ═══════════════════════════════════════════════════════════════════
 * Maritime Graph Construction for the Nautilus Route Engine
 * ═══════════════════════════════════════════════════════════════════
 *
 * Builds an adjacency-list graph of maritime nodes (ports + strategic
 * waypoints) and weighted edges for route optimization.
 *
 * Design decisions:
 *  - Ports are loaded from MySQL (single source of truth)
 *  - Waypoints are static JS constants (not a DB table — they are
 *    navigational corridor anchors, not real ports)
 *  - Edges are auto-generated: two nodes are connected if they are
 *    within MAX_HOP_NM nautical miles of each other AND share a
 *    plausible maritime corridor (no crossing major landmasses via a
 *    simple bearing check is out of scope for SIH — we rely on corridor
 *    anchors to guide the graph topology)
 *  - Graph is cached in-memory after first build; refreshed if ports
 *    are updated (call invalidateGraphCache())
 *  - No external graph library — pure JS adjacency map
 *
 * Edge shape:
 *   {
 *     from:          string,   // node id
 *     to:            string,   // node id
 *     distanceNM:    number,   // great-circle distance in nautical miles
 *     travelTimeHrs: number,   // distanceNM / vessel.maxSpeed
 *     fuelCost:      number,   // distanceNM * fuelConsumptionRate (tons/NM)
 *     safetyRisk:    number,   // base risk [0..100]; weather injection adds more
 *     maxDraft:      number,   // max vessel draft allowed (metres)
 *   }
 */

const portModel = require('../models/port.model');
const isSea = require('is-sea');
const fs = require('fs');
const path = require('path');

const CACHE_FILE_PATH = path.join(__dirname, 'land_edges_cache.json');
let _landCache = null;

function loadLandCache() {
  if (_landCache) return _landCache;
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      _landCache = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf8'));
    } else {
      _landCache = {};
    }
  } catch {
    _landCache = {};
  }
  return _landCache;
}

function saveLandCache() {
  try {
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(_landCache, null, 2), 'utf8');
  } catch {
    // Ignore cache save errors gracefully
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum hop distance for auto-connecting nodes (nautical miles). */
const MAX_HOP_NM = 1800;

/**
 * Default fuel consumption rate (metric tons per nautical mile).
 * Real value comes from the vessel object at query time.
 */
const DEFAULT_FUEL_RATE = 0.035; // tons/NM

/**
 * Strategic maritime waypoints — corridor anchors that guide routing
 * around landmasses and through known shipping lanes.
 *
 * Each has a base safety risk (0 = perfectly safe, 100 = extremely risky).
 * These are based on IMO-recognised traffic separation schemes and known
 * piracy/weather risk zones.
 */
const WAYPOINTS = [
  // ── Gulf of Aden / Red Sea corridor ───────────────────────────────
  { id: 'wp-aden-e',   name: 'Gulf of Aden East',    lat: 11.8,   lng: 50.5,   maxDraft: 25, baseRisk: 35 },
  { id: 'wp-aden-w',   name: 'Gulf of Aden West',    lat: 12.0,   lng: 44.0,   maxDraft: 25, baseRisk: 35 },
  { id: 'wp-bab-el',   name: 'Bab-el-Mandeb Strait', lat: 12.6,   lng: 43.4,   maxDraft: 18, baseRisk: 40 },
  { id: 'wp-red-n',    name: 'Red Sea North',         lat: 20.5,   lng: 38.5,   maxDraft: 20, baseRisk: 25 },
  // ── Arabian Sea ───────────────────────────────────────────────────
  { id: 'wp-arab-c',   name: 'Arabian Sea Centre',   lat: 14.0,   lng: 66.0,   maxDraft: 30, baseRisk: 10 },
  { id: 'wp-arab-nw',  name: 'Arabian Sea NW',       lat: 18.0,   lng: 62.0,   maxDraft: 30, baseRisk: 12 },
  { id: 'wp-arab-ne',  name: 'Arabian Sea NE',       lat: 22.0,   lng: 67.0,   maxDraft: 30, baseRisk: 10 },
  // ── Laccadive Sea ────────────────────────────────────────────────
  { id: 'wp-lacc-n',   name: 'Laccadive Sea North',  lat: 13.0,   lng: 74.0,   maxDraft: 30, baseRisk: 8  },
  { id: 'wp-lacc-s',   name: 'Laccadive Sea South',  lat: 8.0,    lng: 74.5,   maxDraft: 30, baseRisk: 8  },
  // ── Indian Ocean (Central) ────────────────────────────────────────
  { id: 'wp-io-c',     name: 'Indian Ocean Centre',  lat: -5.0,   lng: 72.0,   maxDraft: 30, baseRisk: 8  },
  { id: 'wp-io-sw',    name: 'Indian Ocean SW',      lat: -12.0,  lng: 60.0,   maxDraft: 30, baseRisk: 10 },
  { id: 'wp-io-se',    name: 'Indian Ocean SE',      lat: -10.0,  lng: 80.0,   maxDraft: 30, baseRisk: 8  },
  // ── Mozambique Channel ────────────────────────────────────────────
  { id: 'wp-moz-n',    name: 'Mozambique Channel N', lat: -15.0,  lng: 41.5,   maxDraft: 28, baseRisk: 12 },
  { id: 'wp-moz-c',    name: 'Mozambique Channel C', lat: -20.0,  lng: 39.5,   maxDraft: 28, baseRisk: 12 },
  { id: 'wp-moz-s',    name: 'Mozambique Channel S', lat: -26.0,  lng: 37.0,   maxDraft: 25, baseRisk: 15 },
  // ── East African Coast ────────────────────────────────────────────
  { id: 'wp-ea-n',     name: 'East Africa North',    lat: 2.0,    lng: 42.0,   maxDraft: 25, baseRisk: 30 },
  { id: 'wp-ea-c',     name: 'East Africa Centre',   lat: -8.0,   lng: 42.5,   maxDraft: 28, baseRisk: 15 },
  // ── Bay of Bengal ────────────────────────────────────────────────
  { id: 'wp-bob-w',    name: 'Bay of Bengal West',   lat: 12.0,   lng: 84.0,   maxDraft: 30, baseRisk: 22 },
  { id: 'wp-bob-c',    name: 'Bay of Bengal Centre', lat: 10.0,   lng: 88.0,   maxDraft: 30, baseRisk: 20 },
  { id: 'wp-bob-e',    name: 'Bay of Bengal East',   lat: 8.0,    lng: 92.0,   maxDraft: 30, baseRisk: 18 },
  // ── Andaman Sea / Malacca approaches ─────────────────────────────
  { id: 'wp-and',      name: 'Andaman Sea',          lat: 11.0,   lng: 97.0,   maxDraft: 25, baseRisk: 15 },
  { id: 'wp-malacca',  name: 'Strait of Malacca',    lat: 3.5,    lng: 100.5,  maxDraft: 23, baseRisk: 20 },
  { id: 'wp-malacca-n','name': 'Malacca North',      lat: 5.5,    lng: 100.0,  maxDraft: 23, baseRisk: 18 },
  // ── South Indian Ocean ────────────────────────────────────────────
  { id: 'wp-sio-w',    name: 'S Indian Ocean West',  lat: -30.0,  lng: 40.0,   maxDraft: 30, baseRisk: 20 },
  { id: 'wp-sio-e',    name: 'S Indian Ocean East',  lat: -30.0,  lng: 80.0,   maxDraft: 30, baseRisk: 18 },
  // ── Cape of Good Hope approaches ─────────────────────────────────
  { id: 'wp-cape-w',   name: 'Cape Approaches West', lat: -34.5,  lng: 20.0,   maxDraft: 30, baseRisk: 22 },
  // ── Malabar Coast ────────────────────────────────────────────────
  { id: 'wp-malab',    name: 'Malabar Coast Off',    lat: 11.0,   lng: 75.5,   maxDraft: 30, baseRisk: 8  },
  // ── Coromandel Coast ─────────────────────────────────────────────
  { id: 'wp-coro',     name: 'Coromandel Coast Off', lat: 11.5,   lng: 82.0,   maxDraft: 28, baseRisk: 10 },
  // ── Indonesia / Java Sea ──────────────────────────────────────────
  { id: 'wp-java',     name: 'Java Sea',             lat: -5.5,   lng: 107.0,  maxDraft: 20, baseRisk: 15 },
];

// ─── Haversine Distance ───────────────────────────────────────────────────────

/**
 * Great-circle distance between two lat/lng points in nautical miles.
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} distance in nautical miles
 */
function haversineNM(lat1, lng1, lat2, lng2) {
  const R = 3440.065; // Earth radius in nautical miles
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ─── Graph Cache ──────────────────────────────────────────────────────────────

let _graphCache = null; // { nodes, adjacency, normalisation }
let _cacheBuildTime = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Invalidate the in-memory graph cache (call after port updates).
 */
function invalidateGraphCache() {
  _graphCache = null;
  _cacheBuildTime = null;
}

// ─── Graph Builder ────────────────────────────────────────────────────────────

/**
 * Load all ports from MySQL and combine with static waypoints.
 * Returns a flat array of node objects.
 * @returns {Promise<Array<{id, name, lat, lng, maxDraft, baseRisk, isPort}>>}
 */
async function loadNodes() {
  const ports = await portModel.findAll();
  const portNodes = ports.map((p) => ({
    id:        p.id,
    name:      p.name,
    lat:       parseFloat(p.latitude),
    lng:       parseFloat(p.longitude),
    maxDraft:  30,   // ports assumed deep enough; real limit per port out of scope
    baseRisk:  5,    // ports are generally low-risk
    isPort:    true,
  }));

  const waypointNodes = WAYPOINTS.map((w) => ({
    id:        w.id,
    name:      w.name,
    lat:       w.lat,
    lng:       w.lng,
    maxDraft:  w.maxDraft,
    baseRisk:  w.baseRisk,
    isPort:    false,
  }));

  return [...portNodes, ...waypointNodes];
}

/**
 * Build a weighted maritime graph from all nodes.
 *
 * @param {Object} vessel - { maxSpeed: number, draft: number, fuelConsumption: number }
 * @returns {Promise<{nodes: Map, adjacency: Map, allEdges: Array}>}
 *
 * adjacency: Map<nodeId, Array<EdgeObject>>
 * nodes:     Map<nodeId, NodeObject>
 */
async function buildGraph(vessel = {}) {
  // Use cache if available (topology is static; we only recompute weights for this vessel)
  if (_graphCache) {
    return applyVesselWeights(_graphCache, vessel);
  }

  const allNodes = await loadNodes();

  // Build node map for O(1) lookup
  const nodes = new Map();
  for (const node of allNodes) {
    nodes.set(node.id, node);
  }

  // Build adjacency list
  const adjacency = new Map();
  for (const node of allNodes) {
    adjacency.set(node.id, []);
  }

  const allEdges = [];

  // Connect nodes within MAX_HOP_NM of each other
  for (let i = 0; i < allNodes.length; i++) {
    for (let j = i + 1; j < allNodes.length; j++) {
      const a = allNodes[i];
      const b = allNodes[j];
      const dist = haversineNM(a.lat, a.lng, b.lat, b.lng);

      if (dist > MAX_HOP_NM) continue;

      // Check land-crossing using persistent cache + is-sea fallback
      const cacheKey = `${a.id}_${b.id}`;
      const revCacheKey = `${b.id}_${a.id}`;
      const cache = loadLandCache();
      
      let crossesLand = false;
      if (cache[cacheKey] !== undefined) {
        crossesLand = cache[cacheKey];
      } else if (cache[revCacheKey] !== undefined) {
        crossesLand = cache[revCacheKey];
      } else {
        // Calculate on-the-fly and save to cache
        let steps = 10;
        if (dist < 100) steps = 2;
        else if (dist < 500) steps = 5;
        else if (dist < 1000) steps = 8;

        for (let k = 1; k < steps; k++) {
          const t = k / steps;
          const lat = a.lat + t * (b.lat - a.lat);
          const lng = a.lng + t * (b.lng - a.lng);
          if (!isSea(lat, lng)) {
            crossesLand = true;
            break;
          }
        }
        cache[cacheKey] = crossesLand;
        saveLandCache();
      }

      if (crossesLand) continue;

      // Average the two nodes' risk and draft limits for the edge
      const edgeMaxDraft = Math.min(a.maxDraft, b.maxDraft);
      const edgeBaseRisk = (a.baseRisk + b.baseRisk) / 2;

      allEdges.push({ from: a.id, to: b.id, distanceNM: dist, maxDraft: edgeMaxDraft, baseRisk: edgeBaseRisk });
    }
  }

  _graphCache = { nodes, adjacency, allEdges };
  _cacheBuildTime = Date.now();

  return applyVesselWeights(_graphCache, vessel);
}

/**
 * Apply vessel-specific weights to each edge and populate adjacency list.
 * Returns a fresh adjacency map each time (cheap — just recomputes numbers).
 *
 * @param {{nodes, adjacency, allEdges}} graphData
 * @param {Object} vessel
 * @returns {{nodes: Map, adjacency: Map, allEdges: Array}}
 */
function applyVesselWeights(graphData, vessel) {
  const { nodes, allEdges } = graphData;

  const maxSpeed   = vessel.maxSpeed        || 14;
  const draft      = vessel.draft           || 12;
  const fuelRate   = vessel.fuelConsumption || DEFAULT_FUEL_RATE;

  // Rebuild adjacency with fresh edges (filter by draft, recompute weights)
  const adjacency = new Map();
  for (const [id] of nodes) {
    adjacency.set(id, []);
  }

  const validEdges = [];

  for (const e of allEdges) {
    // Draft constraint: skip edge if vessel is too deep
    if (draft > e.maxDraft) continue;

    const travelTimeHrs = e.distanceNM / maxSpeed;
    const fuelCost      = e.distanceNM * fuelRate;
    const safetyRisk    = e.baseRisk; // weather injection adds more later

    const edge = {
      from:          e.from,
      to:            e.to,
      distanceNM:    e.distanceNM,
      travelTimeHrs,
      fuelCost,
      safetyRisk,
      maxDraft:      e.maxDraft,
    };

    adjacency.get(e.from).push({ ...edge, to: e.to });
    adjacency.get(e.to).push({ ...edge, to: e.from, from: e.to });
    validEdges.push(edge);
  }

  return { nodes, adjacency, allEdges: validEdges };
}

/**
 * Exported helper: get haversine distance in NM between two nodes.
 */
function nodeDistance(nodeA, nodeB) {
  return haversineNM(nodeA.lat, nodeA.lng, nodeB.lat, nodeB.lng);
}

module.exports = {
  buildGraph,
  haversineNM,
  nodeDistance,
  invalidateGraphCache,
  WAYPOINTS,
};
