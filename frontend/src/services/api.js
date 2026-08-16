import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5005/api',
});

// Attach JWT from localStorage to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('oceanroute_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear session and redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('oceanroute_token');
      localStorage.removeItem('oceanroute_role');
      localStorage.removeItem('oceanroute_ship');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const login = async (payload) => api.post('/auth/login', payload);
export const getShip = async (shipId) => api.get(`/ships/${shipId}`);
export const getShipPosition = async (shipId) => api.get(`/ships/${shipId}/position`);
export const optimizeRoute = async (shipId) => api.post('/route/optimize', { shipId });
export const getWeather = async (shipId) => api.get(`/weather/${shipId}`);
export const getOceanConditions = async (shipId) => api.get(`/ocean/${shipId}`);
export const getCyclones = async (shipId) => api.get(`/cyclones/${shipId}`);
export const sendChatMessage = async (shipId, message) =>
  api.post('/chat', { shipId, message });

export default api;
