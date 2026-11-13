import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  timeout: 15000,
});

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('medicare_auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
axiosInstance.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 401) {
    localStorage.removeItem('medicare_auth_token');
    localStorage.removeItem('medicare_auth_user');
    window.dispatchEvent(new CustomEvent('medicare:session-expired', {
      detail: { message: 'Your session has expired or your account has changed. Please sign in again.' },
    }));
  }
  return Promise.reject(error);
});
export default axiosInstance;
