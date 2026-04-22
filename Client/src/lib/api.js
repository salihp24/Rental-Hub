import axios from "axios";

const AUTH_STORAGE_KEY = "rentalhub_auth";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1",
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return config;
    const parsed = JSON.parse(raw);
    const token = parsed?.token;
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // ignore malformed storage
  }
  return config;
});

export default api;

