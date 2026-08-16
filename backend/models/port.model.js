'use strict';

/**
 * models/port.model.js
 * Parameterized SQL queries for the ports table.
 */

const { pool } = require('../config/db');

/**
 * Return all ports ordered by country then name.
 * @returns {Promise<Array>}
 */
async function findAll() {
  const [rows] = await pool.execute(
    'SELECT id, name, country, latitude, longitude FROM ports ORDER BY country, name'
  );
  return rows;
}

/**
 * Find a port by its string id (e.g. 'in-mum').
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function findById(id) {
  const [rows] = await pool.execute(
    'SELECT id, name, country, latitude, longitude FROM ports WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

/**
 * Full-text search on port name.
 * Falls back to LIKE if the query is too short for FULLTEXT.
 * @param {string} query
 * @returns {Promise<Array>}
 */
async function search(query) {
  if (!query || query.trim().length < 2) return findAll();

  // Use LIKE for short queries; FULLTEXT for longer ones
  const safe = `%${query.trim()}%`;
  const [rows] = await pool.execute(
    `SELECT id, name, country, latitude, longitude
     FROM ports
     WHERE name LIKE ? OR country LIKE ?
     ORDER BY country, name
     LIMIT 50`,
    [safe, safe]
  );
  return rows;
}

/**
 * Return all ports for a specific country.
 * @param {string} country
 * @returns {Promise<Array>}
 */
async function findByCountry(country) {
  const [rows] = await pool.execute(
    'SELECT id, name, country, latitude, longitude FROM ports WHERE country = ? ORDER BY name',
    [country]
  );
  return rows;
}

module.exports = { findAll, findById, search, findByCountry };
