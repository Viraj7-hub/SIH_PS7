'use strict';

/**
 * controllers/voyage.controller.js
 */

const voyageService = require('../services/voyage.service');

async function createVoyage(req, res, next) {
  try {
    const { shipCode, sourcePortId, destPortId, plannedEta, notes } = req.body;
    const voyage = await voyageService.createVoyage({
      userId: req.user.userId,
      shipCode,
      sourcePortId,
      destPortId,
      plannedEta,
      notes,
    });
    res.status(201).json({ success: true, data: voyage });
  } catch (err) {
    next(err);
  }
}

async function getVoyages(req, res, next) {
  try {
    // Crew only sees their voyages; captains see all
    const userId = req.user.role === 'captain' ? undefined : req.user.userId;
    const voyages = await voyageService.getUserVoyages(userId);
    res.json({ success: true, data: voyages });
  } catch (err) {
    next(err);
  }
}

async function getVoyage(req, res, next) {
  try {
    const voyage = await voyageService.getVoyageById(
      parseInt(req.params.id, 10),
      req.user
    );
    res.json({ success: true, data: voyage });
  } catch (err) {
    next(err);
  }
}

async function updateVoyageStatus(req, res, next) {
  try {
    const voyage = await voyageService.updateVoyageStatus(
      parseInt(req.params.id, 10),
      req.body.status,
      req.user
    );
    res.json({ success: true, data: voyage });
  } catch (err) {
    next(err);
  }
}

module.exports = { createVoyage, getVoyages, getVoyage, updateVoyageStatus };
