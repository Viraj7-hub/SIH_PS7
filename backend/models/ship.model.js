'use strict';

/**
 * models/ship.model.js
 * Parameterized SQL queries for the ships table.
 */

const { pool } = require('../config/db');

/**
 * Fetch all ships, joining source/dest port names for display.
 * @returns {Promise<Array>}
 */
async function findAll() {
  const [rows] = await pool.execute(`
    SELECT
      s.id,
      s.ship_code,
      s.name,
      s.type,
      s.max_speed,
      s.draft,
      s.fuel_consumption,
      s.status,
      s.current_lat,
      s.current_lon,
      s.current_speed,
      s.current_heading,
      s.source_port_id,
      s.dest_port_id,
      sp.name AS source_port_name,
      dp.name AS dest_port_name,
      s.created_at,
      s.updated_at
    FROM ships s
    LEFT JOIN ports sp ON s.source_port_id = sp.id
    LEFT JOIN ports dp ON s.dest_port_id   = dp.id
    ORDER BY s.ship_code
  `);
  return rows;
}

/**
 * Fetch a single ship by its ship_code (e.g. 'SHIP001').
 * @param {string} shipCode
 * @returns {Promise<Object|null>}
 */
async function findByShipCode(shipCode) {
  if (!shipCode) return null;
  const cleanCode = String(shipCode).replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const [rows] = await pool.execute(`
    SELECT
      s.id,
      s.ship_code,
      s.name,
      s.type,
      s.max_speed,
      s.draft,
      s.fuel_consumption,
      s.status,
      s.current_lat,
      s.current_lon,
      s.current_speed,
      s.current_heading,
      s.source_port_id,
      s.dest_port_id,
      sp.name  AS source_port_name,
      sp.latitude  AS source_lat,
      sp.longitude AS source_lon,
      dp.name  AS dest_port_name,
      dp.latitude  AS dest_lat,
      dp.longitude AS dest_lon,
      s.created_at,
      s.updated_at
    FROM ships s
    LEFT JOIN ports sp ON s.source_port_id = sp.id
    LEFT JOIN ports dp ON s.dest_port_id   = dp.id
    WHERE s.ship_code = ? OR REPLACE(s.ship_code, '-', '') = ?
    LIMIT 1
  `, [shipCode, cleanCode]);
  return rows[0] || null;
}

/**
 * Fetch a ship by internal numeric id.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function findById(id) {
  const [rows] = await pool.execute(
    'SELECT * FROM ships WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

/**
 * Insert a new ship.
 * @param {Object} data
 * @returns {Promise<{ id: number }>}
 */
async function create(data) {
  const {
    shipCode, name, type = 'Container Ship',
    maxSpeed = 14, draft = 12, fuelConsumption = 0.035,
    status = 'active', sourcePortId = null, destPortId = null,
  } = data;

  const [result] = await pool.execute(
    `INSERT INTO ships
      (ship_code, name, type, max_speed, draft, fuel_consumption, status, source_port_id, dest_port_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [shipCode, name, type, maxSpeed, draft, fuelConsumption, status, sourcePortId, destPortId]
  );
  return { id: result.insertId };
}

/**
 * Update mutable fields of a ship.
 * @param {number} id
 * @param {Object} data
 * @returns {Promise<boolean>} true if a row was updated
 */
async function update(id, data) {
  const fields = [];
  const values = [];

  const allowed = {
    name: 'name', type: 'type', maxSpeed: 'max_speed',
    draft: 'draft', fuelConsumption: 'fuel_consumption',
    status: 'status', sourcePortId: 'source_port_id', destPortId: 'dest_port_id',
    currentLat: 'current_lat', currentLon: 'current_lon',
    currentSpeed: 'current_speed', currentHeading: 'current_heading',
  };

  for (const [key, col] of Object.entries(allowed)) {
    if (data[key] !== undefined) {
      fields.push(`${col} = ?`);
      values.push(data[key]);
    }
  }

  if (fields.length === 0) return false;
  values.push(id);

  const [result] = await pool.execute(
    `UPDATE ships SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
  return result.affectedRows > 0;
}

module.exports = { findAll, findByShipCode, findById, create, update };
