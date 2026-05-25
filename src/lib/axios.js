import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 429) {
      if (import.meta.env.DEV) console.log('Rate limited');
    }
    return Promise.reject(error);
  }
);

export default api;
