'use strict';

/**
 * controllers/port.controller.js
 */

const portService = require('../services/port.service');

async function getAllPorts(req, res, next) {
  try {
    const ports = await portService.getAllPorts();
    res.json({ success: true, data: ports });
  } catch (err) {
    next(err);
  }
}

async function getPort(req, res, next) {
  try {
    const port = await portService.getPortById(req.params.id);
    res.json({ success: true, data: port });
  } catch (err) {
    next(err);
  }
}

async function searchPorts(req, res, next) {
  try {
    const ports = await portService.searchPorts(req.query.q || '');
    res.json({ success: true, data: ports });
  } catch (err) {
    next(err);
  }
}

async function getPortsByCountry(req, res, next) {
  try {
    const ports = await portService.getPortsByCountry(req.params.country);
    res.json({ success: true, data: ports });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAllPorts, getPort, searchPorts, getPortsByCountry };
