import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(config => {
  const staff = localStorage.getItem('ntpc-staff');
  if (staff) {
    try {
      const parsed = JSON.parse(staff);
      config.headers['x-nhan-vien'] = parsed.maNV;
    } catch { /* ignore */ }
  }
  return config;
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
