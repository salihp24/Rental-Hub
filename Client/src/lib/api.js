import axios from "axios";

const normalizeBaseUrl = (value) => String(value || "").trim().replace(/\/+$/, "");

export const getApiBaseUrl = () => {
  const configured = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);
  if (configured) {
    return configured;
  }

  if (import.meta.env.DEV) {
    return "/api/v1";
  }

  throw new Error(
    "Missing VITE_API_BASE_URL in production. Set it to your backend API base URL (for example: https://api.example.com/api/v1)."
  );
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
});

export default api;

