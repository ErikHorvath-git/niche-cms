import axios from 'axios';
import { logout, token } from './store/auth';

const backendBase = (
  (import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000/api')
).replace(/\/+$/, '');

const apiClient = axios.create({
  baseURL: backendBase,
  headers: {
    'Content-Type': 'application/json'
  }
});

apiClient.interceptors.request.use((config) => {
  const authToken = token.value;
  if (authToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if ([401, 403].includes(error?.response?.status)) {
      logout();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
