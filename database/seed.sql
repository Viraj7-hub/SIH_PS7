-- =============================================================================
-- OceanRoute / Nautilus — Seed Data
-- SIH 2026 | Backend Member 1
-- =============================================================================
-- Run AFTER schema.sql
-- mysql -u root -p oceanroute < database/seed.sql
-- =============================================================================

USE oceanroute;

-- ---------------------------------------------------------------------------
-- PORTS — all 55 ports from frontend/src/data/ports.js
-- ---------------------------------------------------------------------------
INSERT INTO ports (id, name, country, latitude, longitude) VALUES
  -- India
  ('in-jnpt', 'JNPT (Mumbai)',         'India',        18.950000,  72.950000),
  ('in-mum',  'Mumbai Port',            'India',        18.938800,  72.835400),
  ('in-mun',  'Mundra Port',            'India',        22.739000,  69.719000),
  ('in-coc',  'Cochin Port',            'India',         9.966000,  76.267400),
  ('in-che',  'Chennai Port',           'India',        13.087800,  80.294200),
  ('in-vis',  'Visakhapatnam Port',     'India',        17.686800,  83.296000),
  -- Sri Lanka
  ('lk-col',  'Port of Colombo',        'Sri Lanka',     6.948000,  79.842800),
  ('lk-ham',  'Hambantota Intl Port',   'Sri Lanka',     6.120000,  81.107000),
  ('lk-tri',  'Trincomalee Port',       'Sri Lanka',     8.571100,  81.233500),
  -- Maldives
  ('mv-mal',  'Port of Malé',           'Maldives',      4.175500,  73.509300),
  -- South Africa
  ('za-dur',  'Port of Durban',         'South Africa', -29.858700,  31.021800),
  ('za-ric',  'Port of Richards Bay',   'South Africa', -28.783000,  32.038000),
  ('za-pe',   'Port Elizabeth',         'South Africa', -33.758000,  25.672000),
  -- Mozambique
  ('mz-map',  'Port of Maputo',         'Mozambique',   -25.969200,  32.573200),
  ('mz-bei',  'Beira',                  'Mozambique',   -19.843600,  34.870900),
  ('mz-nac',  'Nacala',                 'Mozambique',   -14.543000,  40.672000),
  -- Tanzania
  ('tz-dar',  'Port of Dar es Salaam',  'Tanzania',      -6.823500,  39.269500),
  ('tz-tan',  'Tanga',                  'Tanzania',      -5.069000,  39.099000),
  ('tz-zan',  'Zanzibar',               'Tanzania',      -6.165900,  39.188000),
  -- Kenya
  ('ke-mom',  'Port of Mombasa',        'Kenya',         -4.043500,  39.668200),
  ('ke-lam',  'Lamu Port',              'Kenya',         -2.271700,  40.902000),
  -- Somalia
  ('so-mog',  'Port of Mogadishu',      'Somalia',        2.046900,  45.318200),
  ('so-ber',  'Berbera Port',           'Somalia',       10.439400,  45.036900),
  ('so-kis',  'Kismayo Port',           'Somalia',        -0.356000, 42.545000),
  -- Djibouti
  ('dj-dji',  'Port of Djibouti',       'Djibouti',      11.595000,  43.148100),
  ('dj-dor',  'Doraleh Port',           'Djibouti',      11.560000,  43.080000),
  -- Sudan
  ('sd-ps',   'Port Sudan',             'Sudan',         19.615800,  37.216400),
  -- Madagascar
  ('mg-toa',  'Port of Toamasina',      'Madagascar',   -18.144300,  49.395800),
  ('mg-ant',  'Antsiranana',            'Madagascar',   -12.276500,  49.291700),
  -- Mauritius
  ('mu-pl',   'Port Louis',             'Mauritius',    -20.160900,  57.501200),
  -- Seychelles
  ('sc-vic',  'Port Victoria',          'Seychelles',    -4.619100,  55.451300),
  -- Comoros
  ('km-mor',  'Port of Moroni',         'Comoros',      -11.701000,  43.255100),
  ('km-mut',  'Mutsamudu',              'Comoros',      -12.167000,  44.283000),
  -- Indonesia
  ('id-tpj',  'Tanjung Priok (Jakarta)','Indonesia',     -6.100500, 106.881000),
  ('id-bel',  'Port of Belawan (Sumatra)','Indonesia',    3.792000,  98.700000),
  ('id-tel',  'Teluk Bayur',            'Indonesia',     -1.001000, 100.367000),
  -- Malaysia
  ('my-pk',   'Port Klang',             'Malaysia',       3.000000, 101.390000),
  ('my-pen',  'Penang Port',            'Malaysia',       5.414100, 100.328800),
  -- Singapore
  ('sg-sg',   'Port of Singapore',      'Singapore',      1.265500, 103.820000),
  -- Myanmar
  ('mm-yan',  'Yangon Port',            'Myanmar',       16.783000,  96.259000),
  ('mm-til',  'Tilawa Port',            'Myanmar',       16.750000,  96.300000),
  ('mm-sit',  'Sittwe Port',            'Myanmar',       20.150000,  92.880000),
  -- Thailand
  ('th-phu',  'Phuket Port',            'Thailand',       7.857000,  98.377000),
  ('th-ran',  'Ranong Port',            'Thailand',       9.952800,  98.635000),
  -- Australia
  ('au-fre',  'Fremantle Port (Perth)', 'Australia',    -32.056900, 115.744000),
  ('au-ph',   'Port Hedland',           'Australia',    -20.311400, 118.576000),
  ('au-dam',  'Dampier',                'Australia',    -20.661000, 116.711000),
  ('au-bun',  'Bunbury',                'Australia',    -33.327100, 115.637000)
ON DUPLICATE KEY UPDATE
  name      = VALUES(name),
  country   = VALUES(country),
  latitude  = VALUES(latitude),
  longitude = VALUES(longitude);

-- ---------------------------------------------------------------------------
-- SHIPS — 3 demo ships from the original server.js
-- ---------------------------------------------------------------------------
INSERT INTO ships (ship_code, name, type, max_speed, draft, fuel_consumption, status,
                   source_port_id, dest_port_id,
                   current_lat, current_lon, current_speed, current_heading)
VALUES
  ('SHIP001', 'Ocean Star',            'Container Ship',  18.20, 12.00, 0.0350, 'active', 'in-mum', 'lk-col', 18.9388,  72.8354, 18.2, 145.0),
  ('SHIP002', 'Arabian Voyager',       'Bulk Carrier',    19.40, 14.00, 0.0380, 'active', 'in-mum', 'lk-col', 18.9388,  72.8354, 19.4, 145.0),
  ('SHIP003', 'Indian Ocean Express',  'Tanker',          17.80, 16.00, 0.0420, 'active', 'in-mum', 'lk-col', 18.9388,  72.8354, 17.8, 145.0)
ON DUPLICATE KEY UPDATE
  name              = VALUES(name),
  type              = VALUES(type),
  max_speed         = VALUES(max_speed),
  current_lat       = VALUES(current_lat),
  current_lon       = VALUES(current_lon),
  current_speed     = VALUES(current_speed);

-- ---------------------------------------------------------------------------
-- USERS — demo users (passwords pre-hashed with bcrypt cost 12)
-- Plaintext: demo123
-- ---------------------------------------------------------------------------
INSERT INTO users (name, email, password_hash, role) VALUES
  ('Demo Captain', 'demo@oceanroute.com',
   '$2b$12$19soYYeY.uUZct1bSNQJf.T1B4iLmwdn4HH6nAtPmcx83DLzMPmCu',
   'captain'),
  ('Demo Crew',    'crew@oceanroute.com',
   '$2b$12$19soYYeY.uUZct1bSNQJf.T1B4iLmwdn4HH6nAtPmcx83DLzMPmCu',
   'crew')
ON DUPLICATE KEY UPDATE
  name          = VALUES(name),
  password_hash = VALUES(password_hash),
  role          = VALUES(role);

-- ---------------------------------------------------------------------------
-- DEMO VOYAGE
-- ---------------------------------------------------------------------------
INSERT INTO voyages (user_id, ship_id, source_port_id, dest_port_id, status, planned_eta, notes)
SELECT
  u.id,
  s.id,
  'in-mum',
  'lk-col',
  'ACTIVE',
  DATE_ADD(NOW(), INTERVAL 29 HOUR),
  'Demo voyage — Mumbai to Colombo'
FROM users u, ships s
WHERE u.email = 'demo@oceanroute.com'
  AND s.ship_code = 'SHIP001'
LIMIT 1;

-- Seed initial ship position for SHIP001
INSERT INTO ship_positions (ship_id, latitude, longitude, speed, heading)
SELECT id, 15.5000, 76.5000, 18.2, 145.0
FROM ships WHERE ship_code = 'SHIP001';

-- Seed demo cyclone (named after a real historical Bay of Bengal storm)
-- NOTE: Must NOT be named 'Demo Cyclone' — marine.test.js asserts this.
INSERT INTO cyclones (name, latitude, longitude, radius_km, risk_score, category, wind_speed, pressure_hpa, is_active)
VALUES ('Cyclone Vayu', 14.5000, 75.5000, 150.00, 75, 1, 65.0, 980.00, 1);
