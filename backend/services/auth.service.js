'use strict';

/**
 * services/auth.service.js
 * Business logic for registration, login, and identity retrieval.
 */

const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { env }  = require('../config/env');
const userModel = require('../models/user.model');
const { AppError } = require('../middleware/error.middleware');

const BCRYPT_ROUNDS = 12;

/**
 * Register a new user.
 * Rejects duplicate emails with a 409 CONFLICT error.
 *
 * @param {{ name: string, email: string, password: string, role: string }}
 * @returns {Promise<{ id: number, name: string, email: string, role: string }>}
 */
async function register({ name, email, password, role }) {
  const existing = await userModel.findByEmail(email);
  if (existing) {
    throw new AppError('An account with that email already exists.', 'CONFLICT');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const { id } = await userModel.create({ name, email, passwordHash, role });

  return { id, name, email, role };
}

/**
 * Authenticate a user and return a signed JWT.
 * Deliberately uses a generic error message to prevent user enumeration.
 *
 * @param {{ email: string, password: string }}
 * @returns {Promise<{ token: string, user: Object }>}
 */
async function login({ email, password }) {
  const user = await userModel.findByEmail(email);

  // Always run bcrypt.compare even if user not found to prevent timing attacks
  const dummyHash = '$2b$12$invalidhashpadding000000000000000000000000000000000000';
  const match = await bcrypt.compare(password, user ? user.password_hash : dummyHash);

  if (!user || !match) {
    throw new AppError('Invalid email or password.', 'UNAUTHORIZED');
  }

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
}

/**
 * Retrieve the authenticated user's profile.
 * @param {number} userId
 * @returns {Promise<Object>}
 */
async function getMe(userId) {
  const user = await userModel.findById(userId);
  if (!user) {
    throw new AppError('User not found.', 'NOT_FOUND');
  }
  return user;
}

module.exports = { register, login, getMe };
