'use strict';

/**
 * models/voyage.model.js
 * Parameterized SQL queries for the voyages table.
 */

const { pool } = require('../config/db');

const VALID_STATUSES = ['PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'];

/**
 * Find all voyages, optionally filtered by userId.
 * Joins user/ship/port names for display.
 * @param {{ userId?: number }} opts
 * @returns {Promise<Array>}
 */
async function findAll({ userId } = {}) {
  const params = [];
  let where = '';

  if (userId) {
    where = 'WHERE v.user_id = ?';
    params.push(userId);
  }

  const [rows] = await pool.execute(`
    SELECT
      v.id,
      v.status,
      v.departed_at,
      v.arrived_at,
      v.planned_eta,
      v.notes,
      v.created_at,
      v.updated_at,
      u.id   AS user_id,
      u.name AS user_name,
      s.id         AS ship_id,
      s.ship_code,
      s.name       AS ship_name,
      sp.id   AS source_port_id,
      sp.name AS source_port_name,
      dp.id   AS dest_port_id,
      dp.name AS dest_port_name
    FROM voyages v
    JOIN users u  ON v.user_id        = u.id
    JOIN ships s  ON v.ship_id        = s.id
    JOIN ports sp ON v.source_port_id = sp.id
    JOIN ports dp ON v.dest_port_id   = dp.id
    ${where}
    ORDER BY v.created_at DESC
  `, params);
  return rows;
}

/**
 * Find a single voyage by id.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function findById(id) {
  const [rows] = await pool.execute(`
    SELECT
      v.id,
      v.user_id,
      v.ship_id,
      v.source_port_id,
      v.dest_port_id,
      v.status,
      v.departed_at,
      v.arrived_at,
      v.planned_eta,
      v.notes,
      v.created_at,
      v.updated_at,
      s.ship_code,
      s.name AS ship_name,
      sp.name AS source_port_name,
      dp.name AS dest_port_name
    FROM voyages v
    JOIN ships s  ON v.ship_id        = s.id
    JOIN ports sp ON v.source_port_id = sp.id
    JOIN ports dp ON v.dest_port_id   = dp.id
    WHERE v.id = ?
    LIMIT 1
  `, [id]);
  return rows[0] || null;
}

/**
 * Create a new voyage.
 * @param {{ userId, shipId, sourcePortId, destPortId, plannedEta?, notes? }}
 * @returns {Promise<{ id: number }>}
 */
async function create({ userId, shipId, sourcePortId, destPortId, plannedEta = null, notes = null }) {
  const [result] = await pool.execute(
    `INSERT INTO voyages (user_id, ship_id, source_port_id, dest_port_id, planned_eta, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, shipId, sourcePortId, destPortId, plannedEta, notes]
  );
  return { id: result.insertId };
}

/**
 * Update voyage status. Automatically sets departed_at / arrived_at timestamps.
 * @param {number} id
 * @param {string} status
 * @returns {Promise<boolean>}
 */
async function updateStatus(id, status) {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid voyage status: ${status}`);
  }

  const extras = [];
  const params = [status];

  if (status === 'ACTIVE')    { extras.push('departed_at = NOW()'); }
  if (status === 'COMPLETED') { extras.push('arrived_at = NOW()');  }

  const setClause = ['status = ?', ...extras].join(', ');
  params.push(id);

  const [result] = await pool.execute(
    `UPDATE voyages SET ${setClause} WHERE id = ?`,
    params
  );
  return result.affectedRows > 0;
}

module.exports = { findAll, findById, create, updateStatus, VALID_STATUSES };
