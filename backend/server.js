'use strict';

/**
 * server.js — OceanRoute / Nautilus Backend Entry Point
 *
 * Responsibilities:
 *   1. Load environment & validate required vars
 *   2. Configure Express middleware (security, CORS, JSON, rate limiting)
 *   3. Mount route modules
 *   4. Attach error handlers
 *   5. Start listening
 *
 * Business logic lives in: routes/ controllers/ services/ models/
 * Database config:          config/db.js
 * Authentication:           middleware/auth.middleware.js
 */

const dotenv  = require('dotenv');
dotenv.config();

const { validateEnv, env } = require('./config/env');
validateEnv(); // Exit immediately if required env vars are missing

const express  = require('express');
const helmet   = require('helmet');
const cors     = require('cors');

const { apiLimiter }          = require('./middleware/rateLimiter.middleware');
const { notFoundHandler, globalErrorHandler } = require('./middleware/error.middleware');

// Route modules
const authRoutes    = require('./routes/auth.routes');
const shipRoutes    = require('./routes/ship.routes');
const portRoutes    = require('./routes/port.routes');
const voyageRoutes  = require('./routes/voyage.routes');
const routeRoutes   = require('./routes/route.routes');   // Member 2 — Route Engine
const legacyRoutes  = require('./routes/legacy.routes');
const { healthCheck } = require('./controllers/health.controller');

// ─────────────────────────────────────────────────────────────────────────────
const app = express();

// Security headers
app.use(helmet());

// CORS — restrict to frontend origin
app.use(cors({
  origin:      env.clientUrl,
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// General API rate limit
app.use('/api', apiLimiter);

// ── Routes ───────────────────────────────────────────────────────────────────
app.get('/api/health',   healthCheck);
app.use('/api/auth',     authRoutes);
app.use('/api/ships',    shipRoutes);
app.use('/api/ports',    portRoutes);
app.use('/api/voyages',  voyageRoutes);
app.use('/api/routes',   routeRoutes);   // Nautilus Route Engine (Member 2)
app.use('/api',          legacyRoutes);  // legacy compat — last

// ── Error Handlers ───────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(globalErrorHandler);

// ── Start Server ─────────────────────────────────────────────────────────────
app.listen(env.port, () => {
  console.log(`[OceanRoute] Backend running on http://localhost:${env.port}`);
  console.log(`[OceanRoute] Environment: ${env.nodeEnv}`);
  console.log(`[OceanRoute] CORS origin: ${env.clientUrl}`);
});

module.exports = app; // exported for tests
