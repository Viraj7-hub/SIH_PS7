-- =============================================================================
-- OceanRoute / Nautilus — BE3 Database Migration
-- SIH 2026 | Backend Member 3
-- =============================================================================
-- Run this file ONLY if schema.sql was already applied before this migration.
-- If running schema.sql fresh, this file is not needed (schema.sql is updated).
--
-- mysql -u root -p oceanroute < database/migration_be3.sql
-- =============================================================================

USE oceanroute;

-- ---------------------------------------------------------------------------
-- Add pressure_hpa column to cyclones table
-- (safe: ALTER TABLE ... ADD COLUMN IF NOT EXISTS is MySQL 8.0+)
-- ---------------------------------------------------------------------------
ALTER TABLE cyclones
  ADD COLUMN IF NOT EXISTS pressure_hpa DECIMAL(7,2) NULL
    COMMENT 'Central pressure in hPa (lower = more intense)' AFTER wind_speed;

-- ---------------------------------------------------------------------------
-- Add expires_at column to cyclones table
-- Allows setting an explicit expiry time from external data sources.
-- ---------------------------------------------------------------------------
ALTER TABLE cyclones
  ADD COLUMN IF NOT EXISTS expires_at DATETIME NULL
    COMMENT 'When this cyclone record should be auto-deactivated'
    AFTER pressure_hpa;

-- ---------------------------------------------------------------------------
-- Add valid_until to weather_observations
-- Used by cache.service.js to do fast validity checks.
-- ---------------------------------------------------------------------------
ALTER TABLE weather_observations
  ADD COLUMN IF NOT EXISTS valid_until DATETIME NULL
    COMMENT 'Timestamp after which this observation is considered stale'
    AFTER observed_at;

-- Backfill valid_until for existing rows (30 minute default TTL)
UPDATE weather_observations
SET valid_until = DATE_ADD(observed_at, INTERVAL 30 MINUTE)
WHERE valid_until IS NULL;

-- Add index on valid_until for efficient cache invalidation queries
ALTER TABLE weather_observations
  ADD INDEX IF NOT EXISTS idx_wo_valid (valid_until);

-- ---------------------------------------------------------------------------
-- Verify the migration
-- ---------------------------------------------------------------------------
SELECT 'migration_be3.sql applied successfully' AS status;
