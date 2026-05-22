export const resolveSocketUrl = () => {
  const explicit = import.meta.env.VITE_SOCKET_URL?.trim();
  if (explicit) return explicit;

  const apiBase = import.meta.env.VITE_API_BASE_URL?.trim();
  if (apiBase && /^https?:\/\//i.test(apiBase)) {
    return new URL(apiBase).origin;
  }

  if (import.meta.env.DEV) {
    return "http://localhost:5000";
  }

  return window.location.origin;
};
