# OceanRoute / Nautilus — Backend API Contract
**SIH 2026 | Version 2.0 | Backend Member 1**

All endpoints use base URL: `http://localhost:5005/api`

## Response Envelope

**Success:**
```json
{ "success": true, "data": { ... } }
```

**Error:**
```json
{ "success": false, "message": "Human readable message", "code": "ERROR_CODE" }
```

**Error codes:** `VALIDATION_ERROR` (422) · `UNAUTHORIZED` (401) · `FORBIDDEN` (403) · `NOT_FOUND` (404) · `CONFLICT` (409) · `RATE_LIMITED` (429) · `INTERNAL_ERROR` (500)

---

## Health

### `GET /api/health`
Server + database connectivity check.

**Auth:** None

**Response 200:**
```json
{ "success": true, "status": "ok", "database": "connected", "timestamp": "2026-08-16T14:30:00.000Z" }
```

**Response 503** (DB unreachable):
```json
{ "success": false, "status": "degraded", "database": "disconnected", "timestamp": "..." }
```

---

## Authentication

> Rate limit: 10 requests per 15 minutes per IP on all auth endpoints.

### `POST /api/auth/register`
Create a new user account.

**Auth:** None

**Request body:**
```json
{ "name": "string (2-120)", "email": "valid email", "password": "string (min 6)", "role": "captain|crew (optional, default: crew)" }
```

**Response 201:**
```json
{ "success": true, "data": { "id": 1, "name": "...", "email": "...", "role": "crew" } }
```

**Errors:** 422 VALIDATION_ERROR · 409 CONFLICT (email taken)

---

### `POST /api/auth/login`
Authenticate and receive a JWT.

**Auth:** None

**Request body:**
```json
{ "email": "demo@oceanroute.com", "password": "demo123" }
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGci...",
    "user": { "id": 1, "name": "Demo Captain", "email": "demo@oceanroute.com", "role": "captain" }
  }
}
```

**Errors:** 401 UNAUTHORIZED · 422 VALIDATION_ERROR

---

### `GET /api/auth/me`
Get the authenticated user's profile.

**Auth:** `Authorization: Bearer <token>`

**Response 200:**
```json
{ "success": true, "data": { "id": 1, "name": "Demo Captain", "email": "...", "role": "captain", "created_at": "..." } }
```

**Errors:** 401 UNAUTHORIZED

---

## Ships

### `GET /api/ships`
List all ships.

**Auth:** None

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "shipId": "SHIP001",
      "shipName": "Ocean Star",
      "source": "Mumbai Port",
      "destination": "Port of Colombo",
      "currentPosition": { "lat": 18.9388, "lon": 72.8354 },
      "destinationPosition": { "lat": 6.9271, "lon": 79.8612 },
      "speed": 18.2,
      "type": "Container Ship",
      "maxSpeed": 18.2,
      "draft": 12.0,
      "status": "active",
      "sourcePortId": "in-mum",
      "destPortId": "lk-col"
    }
  ]
}
```

---

### `GET /api/ships/:shipId`
Get a single ship by its code (e.g. `SHIP001`). **Used by `ShipSelect.jsx` and `Dashboard.jsx`.**

**Auth:** None

**Params:** `shipId` — ship code (case-insensitive)

**Response 200:** Same shape as single item from GET /api/ships list.

**Errors:** 404 NOT_FOUND

---

### `POST /api/ships`
Create a new ship.

**Auth:** Bearer JWT · Role: `captain`

**Request body:**
```json
{
  "shipCode": "SHIP004",
  "name": "New Vessel",
  "type": "Container Ship",
  "maxSpeed": 16.0,
  "draft": 11.5,
  "fuelConsumption": 0.035,
  "sourcePortId": "in-mum",
  "destPortId": "lk-col"
}
```

**Response 201:** Ship object

**Errors:** 401 · 403 FORBIDDEN · 422 VALIDATION_ERROR · 409 CONFLICT (duplicate ship code)

---

### `PUT /api/ships/:shipId`
Update a ship.

**Auth:** Bearer JWT · Role: `captain`

**Request body (all optional):**
```json
{ "name": "...", "status": "active|inactive|maintenance", "maxSpeed": 18, "draft": 12 }
```

**Response 200:** Updated ship object

---

### `GET /api/ships/:shipId/position`
Get the latest position for a ship. **Polled every 5s by `Dashboard.jsx`.**

**Auth:** None

**Response 200:**
```json
{ "success": true, "data": { "shipId": "SHIP001", "lat": 15.5, "lon": 76.5, "speed": 18.2, "heading": 145 } }
```

**Errors:** 404 NOT_FOUND

---

## Ports

### `GET /api/ports`
All 55 ports from the Indian Ocean region.

**Auth:** None

**Response 200:**
```json
{ "success": true, "data": [{ "id": "in-mum", "name": "Mumbai Port", "country": "India", "latitude": 18.9388, "longitude": 72.8354 }, ...] }
```

---

### `GET /api/ports/search?q=:query`
Search ports by name or country.

**Auth:** None · **Query:** `q` (string)

**Response 200:** Filtered port array (max 50)

---

### `GET /api/ports/country/:country`
Ports for a specific country.

**Auth:** None

**Response 200:** Filtered port array

**Errors:** 404 NOT_FOUND (no ports for country)

---

### `GET /api/ports/:id`
Single port by string id (e.g. `in-mum`).

**Auth:** None

**Response 200:**
```json
{ "success": true, "data": { "id": "in-mum", "name": "Mumbai Port", "country": "India", "latitude": 18.9388, "longitude": 72.8354 } }
```

**Errors:** 404 NOT_FOUND

---

## Voyages

All voyage endpoints require `Authorization: Bearer <token>`.

### `POST /api/voyages`
Create a new voyage.

**Auth:** Bearer JWT (any role)

**Request body:**
```json
{
  "shipCode": "SHIP001",
  "sourcePortId": "in-mum",
  "destPortId": "lk-col",
  "plannedEta": "2026-08-17T10:00:00Z",
  "notes": "Optional notes"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": 1, "status": "PLANNED",
    "ship_code": "SHIP001", "ship_name": "Ocean Star",
    "source_port_name": "Mumbai Port", "dest_port_name": "Port of Colombo",
    "planned_eta": "2026-08-17T10:00:00.000Z",
    "created_at": "..."
  }
}
```

**Errors:** 401 · 404 (invalid ship/port) · 422 (validation)

---

### `GET /api/voyages`
List voyages. Captains see all; crew see only their own.

**Auth:** Bearer JWT

**Response 200:**
```json
{ "success": true, "data": [ { "id": 1, "status": "ACTIVE", "ship_code": "SHIP001", ... } ] }
```

---

### `GET /api/voyages/:id`
Single voyage. Crew can only access their own.

**Auth:** Bearer JWT

**Errors:** 401 · 403 · 404

---

### `PUT /api/voyages/:id/status`
Update voyage status.

**Auth:** Bearer JWT

**Request body:**
```json
{ "status": "PLANNED|ACTIVE|PAUSED|COMPLETED|CANCELLED" }
```

**Response 200:** Updated voyage object

**Errors:** 401 · 403 · 404 · 422 (invalid status)

---

## Legacy Endpoints (Backwards Compatibility)

These match the original `server.js` URL structure. The frontend calls them via the legacy route layer.

| Endpoint | Method | Notes |
|---|---|---|
| `POST /api/login` | POST | Compat wrapper → auth.service |
| `POST /api/route/optimize` | POST `{ shipId }` | → route.service stub (Member 2) |
| `GET /api/weather/:shipId` | GET | → weather.service stub (Member 3) |
| `GET /api/ocean/:shipId` | GET | → weather.service stub (Member 3) |
| `GET /api/cyclones/:shipId` | GET | → weather.service stub (Member 3) |
| `POST /api/chat` | POST `{ shipId, message }` | Keyword chatbot |
| `GET /api/marine-weather` | GET | Open-Meteo proxy (Member 3 to own) |

### `POST /api/login` Legacy shape
```json
{ "token": "eyJhbGci...", "user": { "email": "...", "name": "...", "role": "captain" } }
```

### `POST /api/route/optimize`
**Request:** `{ "shipId": "SHIP001" }`
**Response:**
```json
{ "algorithm": "Multi-Objective Dijkstra", "route": [{"lat":18.9,"lon":72.8},...], "distanceKm": 1190, "estimatedTimeHours": 28.6, "fuelEstimate": 38.2, "safetyScore": 92, "shipId": "SHIP001" }
```

---

## Security Notes

- JWT expiry: `24h` (configurable via `JWT_EXPIRES_IN`)
- Passwords: bcrypt, cost factor 12
- Rate limits: 10/15min on auth, 120/min general
- CORS: restricted to `CLIENT_URL` env var
- SQL: fully parameterized — no string concatenation
- Error responses: never expose SQL errors, stack traces, or secrets

---

## Integration for Member 2 (Route Engine)

Implement `backend/services/route.service.js` → `optimizeRoute(params)`.
See the stub file for full JSDoc and expected return shape.
Endpoint: `POST /api/route/optimize` is already wired up.

## Integration for Member 3 (Weather / Ocean / Live Data)

Implement `backend/services/weather.service.js`:
- `getWeatherForShip(shipId)` → `GET /api/weather/:shipId`
- `getOceanConditions(shipId)` → `GET /api/ocean/:shipId`
- `getCyclones(shipId)` → `GET /api/cyclones/:shipId`
- `getMarineWeatherGrid()` → `GET /api/marine-weather`
- `getLivePosition(shipId)` → already partially implemented using `ship_positions` table

See the stub file for full JSDoc and return shapes.
