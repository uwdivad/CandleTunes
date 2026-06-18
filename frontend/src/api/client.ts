import axios from "axios";

import { useAuthStore } from "../state/authStore";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000",
});

// Attach the Google ID token (when signed in) to every request.
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().idToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// A 401 from a protected endpoint means the token is missing/expired — drop the
// session so the UI reflects signed-out state.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearSession();
    }
    return Promise.reject(error);
  }
);
