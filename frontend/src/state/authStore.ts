import { create } from "zustand";

import type { User } from "../api/types";

const TOKEN_STORAGE_KEY = "candletunes.idToken";

interface AuthState {
  /** Google ID token (JWT) sent as a Bearer credential to the backend. */
  idToken: string | null;
  /** Verified profile from GET /api/auth/me; null until that resolves. */
  user: User | null;
  setToken: (token: string) => void;
  setUser: (user: User | null) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  // Rehydrate the token on load so a refresh keeps the session (until it expires).
  idToken: localStorage.getItem(TOKEN_STORAGE_KEY),
  user: null,
  setToken: (token) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    set({ idToken: token });
  },
  setUser: (user) => set({ user }),
  clearSession: () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    set({ idToken: null, user: null });
  },
}));
