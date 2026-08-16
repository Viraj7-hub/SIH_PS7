'use strict';

/**
 * config/db.js
 * Creates and exports a mysql2 promise-based connection pool.
 * All queries must use parameterized statements — never string concatenation.
 */

const mysql = require('mysql2/promise');
const { env } = require('./env');

const pool = mysql.createPool({
  host:               env.db.host,
  port:               env.db.port,
  user:               env.db.user,
  password:           env.db.password,
  database:           env.db.database,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           '+00:00',
  charset:            'utf8mb4',
});

/**
 * Sends a lightweight ping to MySQL to verify connectivity.
 * Used by the health endpoint and startup check.
 * @returns {Promise<boolean>}
 */
async function testConnection() {
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
  return true;
}

module.exports = { pool, testConnection };
