import { create } from 'zustand';
import { api } from '../api/client.js';

let bound = false;

export const useAuth = create((set) => {
  if (!bound && typeof window !== 'undefined') {
    bound = true;
    window.addEventListener('auth:expired', () =>
      set((s) => ({
        user: null,
        loading: false,
        notice: s.user ? 'Your session expired. Please sign in again.' : s.notice
      }))
    );
  }

  return {
    user: null,
    loading: true,
    notice: null,
    clearNotice: () => set({ notice: null }),
    setUser: (user) => set({ user }),
    async loadMe() {
      try {
        const user = await api.get('/auth/me');
        set({ user, loading: false, notice: null });
      } catch {
        set({ user: null, loading: false });
      }
    },
    async login(email, password) {
      const r = await api.post('/auth/login', { email, password });
      set({ user: r.user, notice: null });
      return r.user;
    },
    async register(name, email, password) {
      const r = await api.post('/auth/register', { name, email, password });
      set({ user: r.user, notice: null });
      return r.user;
    },
    async logout() {
      await api.post('/auth/logout', {});
      set({ user: null, notice: null });
    }
  };
});
