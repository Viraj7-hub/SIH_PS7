'use strict';

/**
 * controllers/ship.controller.js
 */

const shipService = require('../services/ship.service');

async function getAllShips(req, res, next) {
  try {
    const ships = await shipService.getAllShips();
    res.json({ success: true, data: ships });
  } catch (err) {
    next(err);
  }
}

async function getShip(req, res, next) {
  try {
    const ship = await shipService.getShipByCode(req.params.shipId);
    res.json({ success: true, data: ship });
  } catch (err) {
    next(err);
  }
}

async function createShip(req, res, next) {
  try {
    const ship = await shipService.createShip(req.body);
    res.status(201).json({ success: true, data: ship });
  } catch (err) {
    next(err);
  }
}

async function updateShip(req, res, next) {
  try {
    // req.params.shipId is the ship_code, service resolves to internal id
    const row = await require('../models/ship.model').findByShipCode(req.params.shipId);
    if (!row) {
      const { AppError } = require('../middleware/error.middleware');
      throw new AppError('Ship not found.', 'NOT_FOUND');
    }
    const ship = await shipService.updateShip(row.id, req.body);
    res.json({ success: true, data: ship });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAllShips, getShip, createShip, updateShip };
