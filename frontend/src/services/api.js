import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

export const login = async (payload) => api.post('/login', payload);
export const getShip = async (shipId) => api.get(`/ships/${shipId}`);
export const getShipPosition = async (shipId) => api.get(`/ships/${shipId}/position`);
export const optimizeRoute = async (shipId) => api.post('/route/optimize', { shipId });
export const getWeather = async (shipId) => api.get(`/weather/${shipId}`);
export const getOceanConditions = async (shipId) => api.get(`/ocean/${shipId}`);
export const getCyclones = async (shipId) => api.get(`/cyclones/${shipId}`);
export const sendChatMessage = async (shipId, message) =>
  api.post('/chat', { shipId, message });

export default api;
