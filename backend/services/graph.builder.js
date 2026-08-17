'use strict';

/**
 * services/graph.builder.js
 * ═══════════════════════════════════════════════════════════════════
 * Maritime Graph Construction for the Nautilus Route Engine
 * ═══════════════════════════════════════════════════════════════════
 *
 * Builds an adjacency-list graph of maritime nodes (ports + strategic
 * waypoints) and ocean-only edges for route optimization.
 *
 * Ocean-Only Guarantee:
 *   Every edge candidate is sampled at fine 5-NM intervals using `is-sea`.
 *   Any edge that intersects land is strictly rejected.
 */

const portModel = require('../models/port.model');
const isSea     = require('is-sea');
const fs        = require('fs');
const path      = require('path');
const logger    = require('../utils/logger');

const CACHE_FILE_PATH = path.join(__dirname, 'land_edges_cache_v2.json');
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
    // Ignore cache save errors
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum hop distance for auto-connecting nodes (nautical miles). */
const MAX_HOP_NM = 1000;

/** Default fuel consumption rate (metric tons per nautical mile). */
const DEFAULT_FUEL_RATE = 0.035;

/**
 * Strategic maritime waypoints — corridor anchors that guide routing
 * around landmasses (India, Sri Lanka, Horn of Africa, Sumatra) and through
 * navigable ocean channels.
 */
const WAYPOINTS = [
  // ── Gulf of Aden / Red Sea corridor ───────────────────────────────
  { id: 'wp-aden-e',   name: 'Gulf of Aden East',    lat: 11.8,   lng: 50.5,   maxDraft: 25, baseRisk: 35 },
  { id: 'wp-aden-w',   name: 'Gulf of Aden West',    lat: 12.0,   lng: 44.0,   maxDraft: 25, baseRisk: 35 },
  { id: 'wp-bab-el',   name: 'Bab-el-Mandeb Strait', lat: 12.6,   lng: 43.4,   maxDraft: 18, baseRisk: 40 },
  { id: 'wp-red-n',    name: 'Red Sea North',         lat: 20.5,   lng: 38.5,   maxDraft: 20, baseRisk: 25 },
  { id: 'wp-hormuz',   name: 'Strait of Hormuz',     lat: 26.2,   lng: 56.4,   maxDraft: 22, baseRisk: 25 },
  { id: 'wp-oman',     name: 'Gulf of Oman',         lat: 24.5,   lng: 58.5,   maxDraft: 30, baseRisk: 15 },
  // ── Arabian Sea ───────────────────────────────────────────────────
  { id: 'wp-arab-c',   name: 'Arabian Sea Centre',   lat: 14.0,   lng: 66.0,   maxDraft: 30, baseRisk: 10 },
  { id: 'wp-arab-nw',  name: 'Arabian Sea NW',       lat: 18.0,   lng: 62.0,   maxDraft: 30, baseRisk: 12 },
  { id: 'wp-arab-ne',  name: 'Arabian Sea NE',       lat: 20.0,   lng: 68.0,   maxDraft: 30, baseRisk: 10 },
  // ── Laccadive Sea & Sri Lanka Bypass Channel ──────────────────────
  { id: 'wp-lacc-n',    name: 'Laccadive Sea North',   lat: 13.0,   lng: 73.5,   maxDraft: 30, baseRisk: 8  },
  { id: 'wp-lacc-s',    name: 'Laccadive Sea South',   lat: 8.0,    lng: 73.5,   maxDraft: 30, baseRisk: 8  },
  { id: 'wp-comorin',   name: 'Cape Comorin Channel',  lat: 7.5,    lng: 77.2,   maxDraft: 30, baseRisk: 8  },
  { id: 'wp-sri-lanka-s', name: 'South Sri Lanka Off', lat: 5.5,    lng: 80.5,   maxDraft: 30, baseRisk: 8  },
  { id: 'wp-sri-lanka-sw',name: 'SW Sri Lanka Off',    lat: 6.0,    lng: 79.5,   maxDraft: 30, baseRisk: 8  },
  { id: 'wp-sri-lanka-e', name: 'East Sri Lanka Off',  lat: 7.5,    lng: 82.2,   maxDraft: 30, baseRisk: 8  },
  { id: 'wp-9-deg',     name: 'Nine Degree Channel',   lat: 9.0,    lng: 73.0,   maxDraft: 30, baseRisk: 5  },
  { id: 'wp-8-deg',     name: 'Eight Degree Channel',  lat: 7.3,    lng: 73.0,   maxDraft: 30, baseRisk: 5  },
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
  { id: 'wp-10-deg',   name: 'Ten Degree Channel',   lat: 10.0,   lng: 92.5,   maxDraft: 30, baseRisk: 10 },
  // ── Andaman Sea / Malacca approaches ─────────────────────────────
  { id: 'wp-and',      name: 'Andaman Sea',          lat: 11.0,   lng: 97.0,   maxDraft: 25, baseRisk: 15 },
  { id: 'wp-malacca',  name: 'Strait of Malacca',    lat: 3.5,    lng: 100.5,  maxDraft: 23, baseRisk: 20 },
  { id: 'wp-malacca-n','name': 'Malacca North',      lat: 5.5,    lng: 100.0,  maxDraft: 23, baseRisk: 18 },
  // ── South Indian Ocean ────────────────────────────────────────────
  { id: 'wp-sio-w',    name: 'S Indian Ocean West',  lat: -30.0,  lng: 40.0,   maxDraft: 30, baseRisk: 20 },
  { id: 'wp-sio-e',    name: 'S Indian Ocean East',  lat: -30.0,  lng: 80.0,   maxDraft: 30, baseRisk: 18 },
  // ── Cape of Good Hope approaches ─────────────────────────────────
  { id: 'wp-cape-w',   name: 'Cape Approaches West', lat: -34.5,  lng: 20.0,   maxDraft: 30, baseRisk: 22 },
  // ── Coastal Channels ─────────────────────────────────────────────
  { id: 'wp-malab',    name: 'Malabar Coast Off',    lat: 11.0,   lng: 74.5,   maxDraft: 30, baseRisk: 8  },
  { id: 'wp-coro',     name: 'Coromandel Coast Off', lat: 11.5,   lng: 82.0,   maxDraft: 28, baseRisk: 10 },
  { id: 'wp-java',     name: 'Java Sea',             lat: -5.5,   lng: 107.0,  maxDraft: 20, baseRisk: 15 },
];

// ─── Haversine Distance ───────────────────────────────────────────────────────

/**
 * Great-circle distance between two lat/lng points in nautical miles.
 */
function haversineNM(lat1, lng1, lat2, lng2) {
  const R = 3440.065; // Earth radius in NM
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const { isSegmentOnLand } = require('./land.validator');

/**
 * Check if a straight-line segment between node A and node B intersects land.
 */
function checkSegmentCrossesLand(a, b, dist) {
  return isSegmentOnLand(a, b, dist, 25.0);
}

// ─── Graph Cache ──────────────────────────────────────────────────────────────

let _graphCache = null;

function invalidateGraphCache() {
  _graphCache = null;
}

/**
 * Load all ports from MySQL and combine with static waypoints.
 */
async function loadNodes() {
  const ports = await portModel.findAll();
  const portNodes = ports.map((p) => ({
    id:        p.id,
    name:      p.name,
    lat:       parseFloat(p.latitude),
    lng:       parseFloat(p.longitude),
    maxDraft:  30,
    baseRisk:  5,
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
 */
async function buildGraph(vessel = {}) {
  if (_graphCache) {
    return applyVesselWeights(_graphCache, vessel);
  }

  const allNodes = await loadNodes();

  const nodes = new Map();
  for (const node of allNodes) {
    nodes.set(node.id, node);
  }

  const adjacency = new Map();
  for (const node of allNodes) {
    adjacency.set(node.id, []);
  }

  const allEdges = [];
  const cache = loadLandCache();
  let cacheDirty = false;

  for (let i = 0; i < allNodes.length; i++) {
    for (let j = i + 1; j < allNodes.length; j++) {
      const a = allNodes[i];
      const b = allNodes[j];
      const dist = haversineNM(a.lat, a.lng, b.lat, b.lng);

      if (dist > MAX_HOP_NM) continue;

      const cacheKey = `${a.id}_${b.id}`;
      const revCacheKey = `${b.id}_${a.id}`;

      let crossesLand = false;
      if (cache[cacheKey] !== undefined) {
        crossesLand = cache[cacheKey];
      } else if (cache[revCacheKey] !== undefined) {
        crossesLand = cache[revCacheKey];
      } else {
        crossesLand = checkSegmentCrossesLand(a, b, dist);
        cache[cacheKey] = crossesLand;
        cacheDirty = true;
      }

      if (crossesLand) continue; // Reject land-crossing edges!

      const edgeMaxDraft = Math.min(a.maxDraft, b.maxDraft);
      const edgeBaseRisk = (a.baseRisk + b.baseRisk) / 2;

      allEdges.push({ from: a.id, to: b.id, distanceNM: dist, maxDraft: edgeMaxDraft, baseRisk: edgeBaseRisk });
    }
    if (cacheDirty) {
      saveLandCache();
      cacheDirty = false;
    }
  }

  saveLandCache();

  _graphCache = { nodes, adjacency, allEdges };
  logger.info('Ocean-only maritime graph built', { nodes: nodes.size, validEdges: allEdges.length });

  return applyVesselWeights(_graphCache, vessel);
}

function applyVesselWeights(graphData, vessel) {
  const { nodes, allEdges } = graphData;

  const maxSpeed   = vessel.maxSpeed        || 14;
  const draft      = vessel.draft           || 12;
  const fuelRate   = vessel.fuelConsumption || DEFAULT_FUEL_RATE;

  const adjacency = new Map();
  for (const [id] of nodes) {
    adjacency.set(id, []);
  }

  const validEdges = [];

  for (const e of allEdges) {
    if (draft > e.maxDraft) continue;

    const travelTimeHrs = e.distanceNM / maxSpeed;
    const fuelCost      = e.distanceNM * fuelRate;
    const safetyRisk    = e.baseRisk;

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
