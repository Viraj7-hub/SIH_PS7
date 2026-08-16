const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const SHIPS = {
  SHIP001: {
    shipId: 'SHIP001',
    shipName: 'Ocean Star',
    source: 'Mumbai',
    destination: 'Colombo',
    currentPosition: { lat: 18.9388, lon: 72.8354 },
    destinationPosition: { lat: 6.9271, lon: 79.8612 },
    speed: 18.2,
  },
  SHIP002: {
    shipId: 'SHIP002',
    shipName: 'Arabian Voyager',
    source: 'Mumbai',
    destination: 'Colombo',
    currentPosition: { lat: 18.9388, lon: 72.8354 },
    destinationPosition: { lat: 6.9271, lon: 79.8612 },
    speed: 19.4,
  },
  SHIP003: {
    shipId: 'SHIP003',
    shipName: 'Indian Ocean Express',
    source: 'Mumbai',
    destination: 'Colombo',
    currentPosition: { lat: 18.9388, lon: 72.8354 },
    destinationPosition: { lat: 6.9271, lon: 79.8612 },
    speed: 17.8,
  },
};

const WEATHER_POINTS = [
  { lat: 17.5, lon: 74.5, risk: 20, condition: 'Clear' },
  { lat: 14.5, lon: 76.5, risk: 50, condition: 'Moderate' },
  { lat: 10.5, lon: 78.5, risk: 80, condition: 'Rough Sea' },
  { lat: 9.2, lon: 79.1, risk: 65, condition: 'Changing Winds' },
];

const getRoute = () => [
  { lat: 18.9388, lon: 72.8354 },
  { lat: 18.2, lon: 74.0 },
  { lat: 15.5, lon: 76.5 },
  { lat: 12.5, lon: 78.5 },
  { lat: 9.5, lon: 79.5 },
  { lat: 6.9271, lon: 79.8612 },
];

const getPositionData = (shipId) => ({
  shipId,
  lat: 15.5,
  lon: 76.5,
  speed: SHIPS[shipId]?.speed || 18.2,
  heading: 145,
});

const getRouteResponse = (shipId) => ({
  algorithm: 'Multi-Objective Dijkstra',
  route: getRoute(),
  distanceKm: 1190,
  estimatedTimeHours: 28.6,
  fuelEstimate: 38.2,
  safetyScore: 92,
  shipId,
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'OceanRoute backend is running.' });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};

  if (email === 'demo@oceanroute.com' && password === 'demo123') {
    return res.json({
      token: 'mock-token-12345',
      user: {
        email,
        name: 'Demo Passenger',
      },
    });
  }

  return res.status(401).json({ message: 'Invalid email or password.' });
});

app.get('/api/ships/:shipId', (req, res) => {
  const { shipId } = req.params;

  if (!SHIPS[shipId]) {
    return res.status(404).json({ message: 'Ship ID not found. Please check your Ship ID.' });
  }

  return res.json(SHIPS[shipId]);
});

app.post('/api/route/optimize', (req, res) => {
  const { shipId } = req.body || {};

  if (!shipId || !SHIPS[shipId]) {
    return res.status(404).json({ message: 'Unable to calculate the optimized route.' });
  }

  return res.json(getRouteResponse(shipId));
});

app.get('/api/weather/:shipId', (req, res) => {
  const { shipId } = req.params;

  if (!shipId || !SHIPS[shipId]) {
    return res.status(404).json({ message: 'Weather data temporarily unavailable.' });
  }

  return res.json(WEATHER_POINTS);
});

app.get('/api/ocean/:shipId', (req, res) => {
  const { shipId } = req.params;

  if (!shipId || !SHIPS[shipId]) {
    return res.status(404).json({ message: 'Ocean data temporarily unavailable.' });
  }

  return res.json({
    waveHeight: 2.8,
    currentSpeed: 1.4,
    currentDirection: 120,
  });
});

app.get('/api/cyclones/:shipId', (req, res) => {
  const { shipId } = req.params;

  if (!shipId || !SHIPS[shipId]) {
    return res.status(404).json({ message: 'Cyclone data temporarily unavailable.' });
  }

  return res.json({
    cyclones: [
      {
        name: 'Demo Cyclone',
        lat: 14.5,
        lon: 75.5,
        radiusKm: 150,
        risk: 75,
      },
    ],
  });
});

app.get('/api/ships/:shipId/position', (req, res) => {
  const { shipId } = req.params;

  if (!shipId || !SHIPS[shipId]) {
    return res.status(404).json({ message: 'Ship position unavailable.' });
  }

  return res.json(getPositionData(shipId));
});

app.post('/api/chat', (req, res) => {
  const { shipId, message } = req.body || {};

  if (!shipId || !SHIPS[shipId]) {
    return res.status(404).json({ message: 'Unable to access voyage assistance.' });
  }

  const text = (message || '').toLowerCase();

  if (text.includes('distance') || text.includes('destination')) {
    return res.json({ reply: 'You have approximately 1,190 km remaining.' });
  }

  if (text.includes('arrive') || text.includes('arrival') || text.includes('when')) {
    return res.json({ reply: 'You are expected to arrive in approximately 28 hours and 36 minutes.' });
  }

  if (text.includes('speed') || text.includes('current speed')) {
    return res.json({ reply: 'Our current speed is 18.2 knots.' });
  }

  if (text.includes('safe') || text.includes('route safe') || text.includes('safety')) {
    return res.json({ reply: 'The route is considered safe with a safety score of 92%.' });
  }

  if (text.includes('weather')) {
    return res.json({ reply: 'Weather conditions are moderate ahead, with a few rough sea pockets near the route.' });
  }

  if (text.includes('why') || text.includes('selected') || text.includes('route')) {
    return res.json({
      reply: 'Your route is optimized using multiple factors. The system balances safety, travel time, fuel efficiency, and weather risk to select the most efficient and secure voyage.',
    });
  }

  return res.json({ reply: 'I can help with route status, arrival timing, weather, and vessel safety.' });
});

app.listen(PORT, () => {
  console.log(`OceanRoute backend running on http://localhost:${PORT}`);
});
