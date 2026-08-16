-- =============================================================================
-- OceanRoute / Nautilus — MySQL Database Schema
-- SIH 2026 | Backend Member 1
-- =============================================================================
-- Run this file FIRST before seed.sql
-- mysql -u root -p < database/schema.sql
-- =============================================================================

CREATE DATABASE IF NOT EXISTS oceanroute
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE oceanroute;

-- ---------------------------------------------------------------------------
-- 1. USERS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120)  NOT NULL,
  email         VARCHAR(255)  NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  role          ENUM('captain','crew') NOT NULL DEFAULT 'crew',
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_users_email (email),
  INDEX idx_users_role (role)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 2. PORTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ports (
  id          VARCHAR(20)   NOT NULL PRIMARY KEY,   -- e.g. 'in-mum'
  name        VARCHAR(150)  NOT NULL,
  country     VARCHAR(80)   NOT NULL,
  latitude    DECIMAL(9,6)  NOT NULL,
  longitude   DECIMAL(9,6)  NOT NULL,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_ports_country (country),
  FULLTEXT INDEX ft_ports_name (name)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 3. SHIPS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ships (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ship_code         VARCHAR(20)   NOT NULL,          -- e.g. 'SHIP001'
  name              VARCHAR(120)  NOT NULL,
  type              VARCHAR(80)   NOT NULL DEFAULT 'Container Ship',
  max_speed         DECIMAL(6,2)  NOT NULL DEFAULT 14.00,   -- knots
  draft             DECIMAL(5,2)  NOT NULL DEFAULT 12.00,   -- metres
  fuel_consumption  DECIMAL(8,4)  NOT NULL DEFAULT 0.0350,  -- tons/NM
  status            ENUM('active','inactive','maintenance') NOT NULL DEFAULT 'active',

  -- Current route info (updated by voyage lifecycle)
  source_port_id    VARCHAR(20)   NULL,
  dest_port_id      VARCHAR(20)   NULL,

  -- Last known position
  current_lat       DECIMAL(9,6)  NULL,
  current_lon       DECIMAL(9,6)  NULL,
  current_speed     DECIMAL(6,2)  NULL,
  current_heading   DECIMAL(5,1)  NULL,

  created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_ships_code (ship_code),
  INDEX idx_ships_status (status),
  CONSTRAINT fk_ships_source FOREIGN KEY (source_port_id) REFERENCES ports (id) ON DELETE SET NULL,
  CONSTRAINT fk_ships_dest   FOREIGN KEY (dest_port_id)   REFERENCES ports (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 4. VOYAGES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS voyages (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED  NOT NULL,
  ship_id         INT UNSIGNED  NOT NULL,
  source_port_id  VARCHAR(20)   NOT NULL,
  dest_port_id    VARCHAR(20)   NOT NULL,
  status          ENUM('PLANNED','ACTIVE','PAUSED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'PLANNED',
  departed_at     DATETIME      NULL,
  arrived_at      DATETIME      NULL,
  planned_eta     DATETIME      NULL,
  notes           TEXT          NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_voyages_user   (user_id),
  INDEX idx_voyages_ship   (ship_id),
  INDEX idx_voyages_status (status),

  CONSTRAINT fk_voyages_user   FOREIGN KEY (user_id)        REFERENCES users  (id) ON DELETE RESTRICT,
  CONSTRAINT fk_voyages_ship   FOREIGN KEY (ship_id)        REFERENCES ships  (id) ON DELETE RESTRICT,
  CONSTRAINT fk_voyages_source FOREIGN KEY (source_port_id) REFERENCES ports  (id) ON DELETE RESTRICT,
  CONSTRAINT fk_voyages_dest   FOREIGN KEY (dest_port_id)   REFERENCES ports  (id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 5. ROUTE REQUESTS  (one per voyage, updated as Member 2 fills it in)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS route_requests (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  voyage_id     INT UNSIGNED  NOT NULL,
  priority_fuel TINYINT(1)    NOT NULL DEFAULT 1,
  priority_time TINYINT(1)    NOT NULL DEFAULT 0,
  priority_safety TINYINT(1)  NOT NULL DEFAULT 1,
  vessel_type   VARCHAR(80)   NULL,
  max_speed     DECIMAL(6,2)  NULL,
  draft         DECIMAL(5,2)  NULL,
  status        ENUM('PENDING','PROCESSING','COMPLETE','FAILED') NOT NULL DEFAULT 'PENDING',
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_rr_voyage (voyage_id),
  CONSTRAINT fk_rr_voyage FOREIGN KEY (voyage_id) REFERENCES voyages (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 6. ROUTE RESULTS  (filled by Member 2's optimization engine)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS route_results (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  route_request_id    INT UNSIGNED  NOT NULL,
  algorithm           VARCHAR(80)   NOT NULL DEFAULT 'Multi-Objective Dijkstra',
  waypoints_json      LONGTEXT      NOT NULL,  -- JSON array [{lat,lon}]
  distance_km         DECIMAL(10,3) NULL,
  estimated_time_hrs  DECIMAL(8,2)  NULL,
  fuel_estimate_tons  DECIMAL(10,4) NULL,
  safety_score        TINYINT UNSIGNED NULL,    -- 0-100
  created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_rr_result (route_request_id),
  CONSTRAINT fk_result_request FOREIGN KEY (route_request_id) REFERENCES route_requests (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 7. SHIP POSITIONS  (time-series, appended by Member 3 / AIS feeds)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ship_positions (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ship_id     INT UNSIGNED  NOT NULL,
  latitude    DECIMAL(9,6)  NOT NULL,
  longitude   DECIMAL(9,6)  NOT NULL,
  speed       DECIMAL(6,2)  NULL,    -- knots
  heading     DECIMAL(5,1)  NULL,    -- degrees
  recorded_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_sp_ship_time (ship_id, recorded_at DESC),
  CONSTRAINT fk_sp_ship FOREIGN KEY (ship_id) REFERENCES ships (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 8. WEATHER OBSERVATIONS  (filled by Member 3)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS weather_observations (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  latitude        DECIMAL(9,6)  NOT NULL,
  longitude       DECIMAL(9,6)  NOT NULL,
  wave_height     DECIMAL(5,2)  NULL,    -- metres
  wave_direction  DECIMAL(5,1)  NULL,    -- degrees
  wave_period     DECIMAL(5,2)  NULL,    -- seconds
  wind_speed      DECIMAL(6,2)  NULL,    -- knots
  wind_direction  DECIMAL(5,1)  NULL,
  wind_gusts      DECIMAL(6,2)  NULL,
  swell_height    DECIMAL(5,2)  NULL,
  swell_direction DECIMAL(5,1)  NULL,
  current_speed   DECIMAL(5,3)  NULL,    -- m/s
  current_dir     DECIMAL(5,1)  NULL,
  sea_temp        DECIMAL(5,2)  NULL,    -- Celsius
  pressure_msl    DECIMAL(7,2)  NULL,    -- hPa
  cloud_cover     TINYINT UNSIGNED NULL, -- %
  precipitation   DECIMAL(6,2)  NULL,    -- mm
  weather_code    SMALLINT UNSIGNED NULL,
  risk_score      TINYINT UNSIGNED NULL, -- 0-100 computed
  observed_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_wo_location (latitude, longitude),
  INDEX idx_wo_time     (observed_at DESC)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 9. OCEAN CONDITIONS  (snapshot per ship per observation, Member 3)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ocean_conditions (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ship_id           INT UNSIGNED  NOT NULL,
  wave_height       DECIMAL(5,2)  NULL,
  current_speed     DECIMAL(5,3)  NULL,
  current_direction DECIMAL(5,1)  NULL,
  sea_temperature   DECIMAL(5,2)  NULL,
  sea_level         DECIMAL(7,3)  NULL,
  observed_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_oc_ship_time (ship_id, observed_at DESC),
  CONSTRAINT fk_oc_ship FOREIGN KEY (ship_id) REFERENCES ships (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 10. CYCLONES  (Member 3 — active storm tracking)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cyclones (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(80)   NOT NULL,
  latitude    DECIMAL(9,6)  NOT NULL,
  longitude   DECIMAL(9,6)  NOT NULL,
  radius_km   DECIMAL(7,2)  NOT NULL DEFAULT 150.00,
  risk_score  TINYINT UNSIGNED NOT NULL DEFAULT 0,  -- 0-100
  category    TINYINT UNSIGNED NULL,                 -- Saffir-Simpson 1-5
  wind_speed  DECIMAL(6,2)  NULL,                   -- knots
  is_active   TINYINT(1)    NOT NULL DEFAULT 1,
  detected_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_cyclones_active (is_active),
  INDEX idx_cyclones_location (latitude, longitude)
) ENGINE=InnoDB;
