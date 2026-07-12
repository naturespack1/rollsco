import { create } from 'zustand';
import type { AdminUser } from '@/types';

if (typeof window !== 'undefined') {
  // Remove the legacy persisted bearer token on first load of this version.
  localStorage.removeItem('admin_token');
  localStorage.removeItem('quickbite-admin');
}

interface AdminState {
  token: string | null;
  admin: AdminUser | null;
  setAuth: (token: string, admin: AdminUser) => void;
  logout: () => void;
}

/**
 * Admin credentials intentionally live only in memory. Persisting a seven-day
 * bearer token in localStorage made it available to any injected script and on
 * shared devices after the browser was closed. Admins must sign in again after
 * a full page reload.
 */
export const useAdminStore = create<AdminState>()((set) => ({
  token: null,
  admin: null,
  setAuth: (token, admin) => set({ token, admin }),
  logout: () => set({ token: null, admin: null }),
}));
