import axios from 'axios';
import { useAdminStore } from '@/store/useAdminStore';

// VITE_API_URL should be set in production, e.g. https://rollsco-server.vercel.app/api
// Falls back to relative /api for local dev (Vite proxy handles localhost:3000)
const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || '/api';
const DEVICE_ID_KEY = 'rolls-device-id';

function getDeviceId() {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const token = useAdminStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['X-Device-Id'] = getDeviceId();
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isAdminRequest = String(err.config?.url || '').startsWith('/admin');
    if (err.response?.status === 401 && isAdminRequest) {
      useAdminStore.getState().logout();
      window.location.href = '/admin/login';
    }
    return Promise.reject(err);
  }
);
