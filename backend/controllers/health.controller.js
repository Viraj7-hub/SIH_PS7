'use strict';

/**
 * controllers/health.controller.js
 * Returns server + database connectivity status.
 */

const { testConnection } = require('../config/db');

async function healthCheck(req, res) {
  try {
    await testConnection();
    res.json({
      success:  true,
      status:   'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    // Don't expose internal error details
    res.status(503).json({
      success:  false,
      status:   'degraded',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = { healthCheck };
