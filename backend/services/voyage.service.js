'use strict';

/**
 * services/voyage.service.js
 * Voyage lifecycle management.
 */

const voyageModel = require('../models/voyage.model');
const shipModel   = require('../models/ship.model');
const portModel   = require('../models/port.model');
const { AppError } = require('../middleware/error.middleware');

/**
 * Create a new voyage.
 * Validates ship + port references before inserting.
 */
async function createVoyage({ userId, shipCode, sourcePortId, destPortId, plannedEta, notes }) {
  // Resolve ship code → internal id
  const ship = await shipModel.findByShipCode(shipCode.toUpperCase());
  if (!ship) throw new AppError(`Ship '${shipCode}' not found.`, 'NOT_FOUND');

  // Validate ports
  const [src, dst] = await Promise.all([
    portModel.findById(sourcePortId),
    portModel.findById(destPortId),
  ]);
  if (!src) throw new AppError(`Source port '${sourcePortId}' not found.`, 'NOT_FOUND');
  if (!dst) throw new AppError(`Destination port '${destPortId}' not found.`, 'NOT_FOUND');
  if (sourcePortId === destPortId) {
    throw new AppError('Source and destination ports cannot be the same.', 'VALIDATION_ERROR');
  }

  const { id } = await voyageModel.create({
    userId,
    shipId: ship.id,
    sourcePortId,
    destPortId,
    plannedEta: plannedEta || null,
    notes: notes || null,
  });

  return voyageModel.findById(id);
}

/**
 * Get all voyages for a user.
 */
async function getUserVoyages(userId) {
  return voyageModel.findAll({ userId });
}

/**
 * Get a specific voyage by id (user must own it or be captain).
 */
async function getVoyageById(id, { userId, role }) {
  const voyage = await voyageModel.findById(id);
  if (!voyage) throw new AppError('Voyage not found.', 'NOT_FOUND');

  // Crew can only see their own voyages; captains see all
  if (role !== 'captain' && voyage.user_id !== userId) {
    throw new AppError('Access denied.', 'FORBIDDEN');
  }
  return voyage;
}

/**
 * Update voyage status.
 */
async function updateVoyageStatus(id, status, { userId, role }) {
  const voyage = await voyageModel.findById(id);
  if (!voyage) throw new AppError('Voyage not found.', 'NOT_FOUND');

  if (role !== 'captain' && voyage.user_id !== userId) {
    throw new AppError('Access denied.', 'FORBIDDEN');
  }

  await voyageModel.updateStatus(id, status);
  return voyageModel.findById(id);
}

module.exports = { createVoyage, getUserVoyages, getVoyageById, updateVoyageStatus };
