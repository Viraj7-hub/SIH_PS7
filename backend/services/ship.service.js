'use strict';

/**
 * services/ship.service.js
 * Business logic for ship retrieval and management.
 * Shapes database rows into the JSON format the frontend expects.
 */

const shipModel  = require('../models/ship.model');
const portModel  = require('../models/port.model');
const { AppError } = require('../middleware/error.middleware');

/**
 * Map a raw DB ship row to the shape the frontend consumes.
 * Preserves backwards compatibility with the original mock SHIPS object shape.
 *
 * @param {Object} row
 * @returns {Object}
 */
function toFrontendShape(row) {
  return {
    // Original fields consumed by ShipSelect / Dashboard
    shipId:   row.ship_code,
    shipName: row.name,
    source:      row.source_port_name || '',
    destination: row.dest_port_name   || '',
    currentPosition: {
      lat: parseFloat(row.current_lat)  || 0,
      lon: parseFloat(row.current_lon)  || 0,
    },
    destinationPosition: {
      lat: parseFloat(row.dest_lat) || 0,
      lon: parseFloat(row.dest_lon) || 0,
    },
    speed: parseFloat(row.current_speed) || parseFloat(row.max_speed) || 0,
    // Extended fields for voyages / route engine
    type:            row.type,
    maxSpeed:        parseFloat(row.max_speed),
    draft:           parseFloat(row.draft),
    fuelConsumption: parseFloat(row.fuel_consumption),
    status:          row.status,
    sourcePortId:    row.source_port_id,
    destPortId:      row.dest_port_id,
    heading:         parseFloat(row.current_heading) || 0,
    internalId:      row.id,
  };
}

/**
 * Get all ships.
 * @returns {Promise<Array>}
 */
async function getAllShips() {
  const rows = await shipModel.findAll();
  return rows.map(toFrontendShape);
}

/**
 * Get a single ship by its code (e.g. 'SHIP001').
 * Throws NOT_FOUND if the code doesn't exist.
 *
 * @param {string} shipCode
 * @returns {Promise<Object>}
 */
async function getShipByCode(shipCode) {
  const row = await shipModel.findByShipCode(shipCode.toUpperCase());
  if (!row) {
    throw new AppError('Ship ID not found. Please check your Ship ID.', 'NOT_FOUND');
  }
  return toFrontendShape(row);
}

/**
 * Create a new ship (captain only).
 * Validates that port IDs exist before inserting.
 *
 * @param {Object} data
 * @returns {Promise<Object>}
 */
async function createShip(data) {
  const { shipCode, name, type, maxSpeed, draft, fuelConsumption, sourcePortId, destPortId } = data;

  // Verify referenced ports exist
  if (sourcePortId) {
    const srcPort = await portModel.findById(sourcePortId);
    if (!srcPort) throw new AppError(`Source port '${sourcePortId}' not found.`, 'NOT_FOUND');
  }
  if (destPortId) {
    const dstPort = await portModel.findById(destPortId);
    if (!dstPort) throw new AppError(`Destination port '${destPortId}' not found.`, 'NOT_FOUND');
  }

  const { id } = await shipModel.create({
    shipCode: shipCode.toUpperCase(),
    name, type, maxSpeed, draft, fuelConsumption, sourcePortId, destPortId,
  });

  const row = await shipModel.findById(id);
  return toFrontendShape(row);
}

/**
 * Update a ship's fields (captain only).
 * @param {number} shipInternalId
 * @param {Object} data
 * @returns {Promise<Object>}
 */
async function updateShip(shipInternalId, data) {
  const updated = await shipModel.update(shipInternalId, data);
  if (!updated) {
    throw new AppError('Ship not found or no changes made.', 'NOT_FOUND');
  }
  const row = await shipModel.findById(shipInternalId);
  return toFrontendShape(row);
}

module.exports = { getAllShips, getShipByCode, createShip, updateShip, toFrontendShape };
