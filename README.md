# 🚢 OceanRoute — Smart Maritime Route Optimization

> **SIH PS7** | AI-powered maritime route planner for passenger ships — optimizing for safety, fuel efficiency, weather, and voyage time.

---

## 📁 Project Structure

```
SIH_PS7/
├── backend/              # Node.js + Express REST API (v2)
│   ├── config/           # DB connection & env validation
│   ├── controllers/      # Route handler functions
│   ├── middleware/        # Auth, rate-limiting, error handling
│   ├── models/           # MySQL query models
│   ├── routes/           # Express route definitions
│   ├── services/         # Business logic (route, weather, ship, etc.)
│   ├── tests/            # Node built-in test runner specs
│   ├── validators/       # express-validator schemas
│   ├── server.js         # Entry point
│   ├── .env.example      # Environment variable template
│   └── package.json
│
├── frontend/             # React 19 + Vite SPA
│   ├── public/           # Static assets (favicon, icons)
│   ├── src/
│   │   ├── assets/       # Images and SVGs
│   │   ├── components/   # Reusable UI components (Map, Chatbot, Overlays…)
│   │   ├── pages/        # Page-level components (Login, Dashboard, ShipSelect)
│   │   └── services/     # Axios API client
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── database/             # MySQL schema & seed data
│   ├── schema.sql        # Table definitions
│   └── seed.sql          # Demo data
│
├── BACKEND_API_CONTRACT.md   # Full REST API reference
└── README.md
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, React-Leaflet, TailwindCSS |
| Backend | Node.js ≥20, Express 5, Helmet, JWT |
| Database | MySQL 8 |
| Auth | JWT (bcryptjs) |
| Maps | Leaflet.js + React-Leaflet |

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 20
- MySQL 8 running locally

---

### 1. Database Setup

```bash
mysql -u root -p < database/schema.sql
mysql -u root -p oceanroute < database/seed.sql
```

---

### 2. Backend

```bash
cd backend
cp .env.example .env        # Fill in DB credentials & JWT secret
npm install
npm run dev                 # Starts on http://localhost:5005
```

**Required `.env` values:**

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: `5005`) |
| `DB_HOST` | MySQL host |
| `DB_PORT` | MySQL port (default: `3306`) |
| `DB_USER` | MySQL username |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | Database name (`oceanroute`) |
| `JWT_SECRET` | 64+ character random secret |
| `JWT_EXPIRES_IN` | Token expiry (e.g. `24h`) |
| `CLIENT_URL` | Frontend origin (e.g. `http://localhost:5173`) |
| `NODE_ENV` | `development` or `production` |

---

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                 # Starts on http://localhost:5173
```

---

### 4. Running Tests (Backend)

```bash
cd backend
npm test                    # All tests
npm run test:auth           # Auth tests only
npm run test:ships          # Ships tests only
```

---

## 🗺️ Key Features

- **AI Route Optimization** — Multi-objective Dijkstra balancing safety, fuel, and time
- **Live Weather Overlays** — Wind, wave height, cyclone zones on interactive map
- **JWT Authentication** — Secure login with token-based sessions
- **Voyage Dashboard** — Real-time ship position, route explanation, voyage status
- **AI Chatbot** — Onboard voyage assistant for passenger queries
- **API Rate Limiting** — Helmet + express-rate-limit for production security

---

## 📄 API Reference

See [`BACKEND_API_CONTRACT.md`](./BACKEND_API_CONTRACT.md) for full REST endpoint documentation.

---

## 🌿 Git Branches

| Branch | Purpose |
|--------|---------|
| `master` | Stable, production-ready code |
| `backend` | Backend development & features |

---

## 👥 Team

Smart India Hackathon — Problem Statement 7
