import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Order } from '@/types';

/** Hard cache expiry: 6 hours (360 minutes) */
const CACHE_EXPIRY_MINUTES = 360;

interface CachedOrderData {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
  fetchedAt: string;
  storeId: string;
  filter: string;
}

interface CachedMenuData {
  items: any[];
  categories: any[];
  fetchedAt: string;
  storeId: string;
}

interface CachedBestsellers {
  data: any[];
  days: string;
  fetchedAt: string;
  storeId: string;
}

interface AdminCacheState {
  // Orders cache
  ordersCache: CachedOrderData | null;
  setOrdersCache: (data: CachedOrderData) => void;
  getOrdersCache: (storeId: string, filter: string) => CachedOrderData | null;

  // Menu/Stock cache
  menuCache: CachedMenuData | null;
  setMenuCache: (data: CachedMenuData) => void;
  getMenuCache: (storeId: string) => CachedMenuData | null;
  updateItemStock: (itemId: string, newStock: number) => void;
  updateItemAvailability: (itemId: string, isAvailable: boolean) => void;
  addItemToCache: (item: any) => void;
  updateItemInCache: (itemId: string, updates: any) => void;
  removeItemFromCache: (itemId: string) => void;

  // Bestsellers cache
  bestsellersCache: CachedBestsellers | null;
  setBestsellersCache: (data: CachedBestsellers) => void;
  getBestsellersCache: (storeId: string, days: string) => CachedBestsellers | null;

  // Sync settings
  autoSyncInterval: number;
  setAutoSyncInterval: (minutes: number) => void;
  lastSync: string;
  setLastSync: (time: string) => void;

  // Pending updates (for sync)
  pendingOrderUpdates: Record<string, { status: string; updatedAt: number }>;
  setPendingOrderUpdate: (orderId: string, status: string) => void;
  clearPendingOrderUpdates: (orderIds: string[]) => void;

  // Cache invalidation
  invalidateOrders: () => void;
  invalidateMenu: () => void;
  invalidateBestsellers: () => void;
  invalidateAll: () => void;

  // Cache age check (defaults to 6-hour hard expiry)
  isStale: (fetchedAt: string, maxAgeMinutes?: number) => boolean;
}

function isCacheStale(fetchedAt: string, maxAgeMinutes = CACHE_EXPIRY_MINUTES): boolean {
  const fetched = new Date(fetchedAt).getTime();
  const now = Date.now();
  return now - fetched > maxAgeMinutes * 60 * 1000;
}

export const useAdminCacheStore = create<AdminCacheState>()(
  persist(
    (set, get) => ({
      ordersCache: null,
      menuCache: null,
      bestsellersCache: null,
      autoSyncInterval: 0,
      lastSync: '',
      pendingOrderUpdates: {},

      setOrdersCache: (data) => set({ ordersCache: data }),
      getOrdersCache: (storeId, filter) => {
        const cache = get().ordersCache;
        if (!cache) return null;
        if (cache.storeId !== storeId || cache.filter !== filter) return null;
        if (isCacheStale(cache.fetchedAt)) return null;
        return cache;
      },

      setMenuCache: (data) => set({ menuCache: data }),
      getMenuCache: (storeId) => {
        const cache = get().menuCache;
        if (!cache) return null;
        if (cache.storeId !== storeId) return null;
        if (isCacheStale(cache.fetchedAt)) return null;
        return cache;
      },
      updateItemStock: (itemId, newStock) => {
        const cache = get().menuCache;
        if (!cache) return;
        set({
          menuCache: {
            ...cache,
            items: cache.items.map((i) =>
              i.id === itemId ? { ...i, stock: newStock } : i
            ),
          },
        });
      },
      updateItemAvailability: (itemId, isAvailable) => {
        const cache = get().menuCache;
        if (!cache) return;
        set({
          menuCache: {
            ...cache,
            items: cache.items.map((i) =>
              i.id === itemId ? { ...i, isAvailable } : i
            ),
          },
        });
      },
      addItemToCache: (item) => {
        const cache = get().menuCache;
        if (!cache) return;
        set({
          menuCache: {
            ...cache,
            items: [...cache.items, item],
          },
        });
      },
      updateItemInCache: (itemId, updates) => {
        const cache = get().menuCache;
        if (!cache) return;
        set({
          menuCache: {
            ...cache,
            items: cache.items.map((i) =>
              i.id === itemId ? { ...i, ...updates } : i
            ),
          },
        });
      },
      removeItemFromCache: (itemId) => {
        const cache = get().menuCache;
        if (!cache) return;
        set({
          menuCache: {
            ...cache,
            items: cache.items.filter((i) => i.id !== itemId),
          },
        });
      },

      setBestsellersCache: (data) => set({ bestsellersCache: data }),
      setAutoSyncInterval: (minutes) => set({ autoSyncInterval: minutes }),
      setLastSync: (time) => set({ lastSync: time }),
      getBestsellersCache: (storeId, days) => {
        const cache = get().bestsellersCache;
        if (!cache) return null;
        if (cache.storeId !== storeId || cache.days !== days) return null;
        if (isCacheStale(cache.fetchedAt)) return null;
        return cache;
      },

      setPendingOrderUpdate: (orderId, status) =>
        set((state) => ({
          pendingOrderUpdates: {
            ...state.pendingOrderUpdates,
            [orderId]: { status, updatedAt: Date.now() },
          },
        })),
      clearPendingOrderUpdates: (orderIds) =>
        set((state) => {
          const updates = { ...state.pendingOrderUpdates };
          orderIds.forEach((id) => delete updates[id]);
          return { pendingOrderUpdates: updates };
        }),

      invalidateOrders: () => set({ ordersCache: null }),
      invalidateMenu: () => set({ menuCache: null }),
      invalidateBestsellers: () => set({ bestsellersCache: null }),
      invalidateAll: () =>
        set({
          ordersCache: null,
          menuCache: null,
          bestsellersCache: null,
        }),

      isStale: (fetchedAt, maxAgeMinutes = CACHE_EXPIRY_MINUTES) => {
        return isCacheStale(fetchedAt, maxAgeMinutes);
      },
    }),
    {
      name: 'rolls-admin-cache',
      // Do not persist order data: it contains customer phone numbers, names,
      // messages, and payment/order details on a shared admin device.
      partialize: (state) => ({
        menuCache: state.menuCache,
        bestsellersCache: state.bestsellersCache,
        autoSyncInterval: state.autoSyncInterval,
        lastSync: state.lastSync,
        pendingOrderUpdates: state.pendingOrderUpdates,
      }),
      version: 2,
      migrate: (persistedState: any, version) => {
        if (version < 2) return { ...persistedState, ordersCache: null };
        return persistedState;
      },
    }
  )
);
