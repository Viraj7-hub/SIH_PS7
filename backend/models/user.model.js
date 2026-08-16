'use strict';

/**
 * models/user.model.js
 * All SQL queries related to the users table.
 * ALWAYS use parameterized queries. Never interpolate user input into SQL.
 */

const { pool } = require('../config/db');

/**
 * Find a user by their email address.
 * @param {string} email
 * @returns {Promise<Object|null>}
 */
async function findByEmail(email) {
  const [rows] = await pool.execute(
    'SELECT id, name, email, password_hash, role, created_at FROM users WHERE email = ? LIMIT 1',
    [email]
  );
  return rows[0] || null;
}

/**
 * Find a user by primary key.
 * Never returns password_hash.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function findById(id) {
  const [rows] = await pool.execute(
    'SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

/**
 * Insert a new user record.
 * @param {{ name: string, email: string, passwordHash: string, role: string }}
 * @returns {Promise<{ id: number }>}
 */
async function create({ name, email, passwordHash, role }) {
  const [result] = await pool.execute(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [name, email, passwordHash, role]
  );
  return { id: result.insertId };
}

module.exports = { findByEmail, findById, create };
