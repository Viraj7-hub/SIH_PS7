'use strict';

/**
 * services/port.service.js
 * Business logic for port queries. All data comes from MySQL.
 */

const portModel  = require('../models/port.model');
const { AppError } = require('../middleware/error.middleware');

async function getAllPorts() {
  return portModel.findAll();
}

async function getPortById(id) {
  const port = await portModel.findById(id);
  if (!port) {
    throw new AppError(`Port '${id}' not found.`, 'NOT_FOUND');
  }
  return port;
}

async function searchPorts(query) {
  return portModel.search(query);
}

async function getPortsByCountry(country) {
  const ports = await portModel.findByCountry(country);
  if (ports.length === 0) {
    throw new AppError(`No ports found for country '${country}'.`, 'NOT_FOUND');
  }
  return ports;
}

module.exports = { getAllPorts, getPortById, searchPorts, getPortsByCountry };
