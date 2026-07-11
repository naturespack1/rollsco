import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AdminUser } from '@/types';

interface AdminState {
  token: string | null;
  admin: AdminUser | null;
  setAuth: (token: string, admin: AdminUser) => void;
  logout: () => void;
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      token: null,
      admin: null,
      setAuth: (token, admin) => set({ token, admin }),
      logout: () => {
        localStorage.removeItem('admin_token');
        set({ token: null, admin: null });
      },
    }),
    {
      name: 'quickbite-admin',
      partialize: (state) => ({ token: state.token, admin: state.admin }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          localStorage.setItem('admin_token', state.token);
        }
      },
    }
  )
);
