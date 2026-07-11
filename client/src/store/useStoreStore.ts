import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Store } from '@/types';

interface StoreState {
  selectedStore: Store | null;
  setSelectedStore: (store: Store) => void;
  clearStore: () => void;
}

export const useStoreStore = create<StoreState>()(
  persist(
    (set) => ({
      selectedStore: null,
      setSelectedStore: (store) => set({ selectedStore: store }),
      clearStore: () => set({ selectedStore: null }),
    }),
    { name: 'quickbite-store' }
  )
);
