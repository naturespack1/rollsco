import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Order } from '@/types';

/** Customer order cache expiry: 1 day (1440 minutes) = 24h */
const CACHE_EXPIRY_MINUTES = 1440;

interface CachedCustomerOrder {
  order: Order;
  fetchedAt: string;
}

interface CustomerOrdersState {
  orders: Record<string, CachedCustomerOrder>;
  lastCompletedOrderId: string | null;
  lastCompletedOrderShown: boolean;

  addOrder: (order: Order) => void;
  getOrder: (orderId: string) => Order | null;
  getLastCompletedOrder: () => Order | null;
  getRecentOrders: (maxAgeMinutes?: number) => Order[];
  markLastOrderShown: () => void;
  hasRecentOrder: () => boolean;
  clearLastOrder: () => void;
}

function isStale(fetchedAt: string, maxAgeMinutes = CACHE_EXPIRY_MINUTES): boolean {
  const fetched = new Date(fetchedAt).getTime();
  return Date.now() - fetched > maxAgeMinutes * 60 * 1000;
}

export const useCustomerOrdersStore = create<CustomerOrdersState>()(
  persist(
    (set, get) => ({
      orders: {},
      lastCompletedOrderId: null,
      lastCompletedOrderShown: false,

      addOrder: (order) => {
        const now = new Date().toISOString();
        set((state) => {
          const orders = { ...state.orders };
          // Purge stale entries on add (24h)
          Object.entries(orders).forEach(([id, cached]) => {
            if (isStale(cached.fetchedAt)) delete orders[id];
          });
          orders[order.id] = { order, fetchedAt: now };
          return {
            orders,
            lastCompletedOrderId: order.id,
            lastCompletedOrderShown: false,
          };
        });
      },

      getOrder: (orderId) => {
        const cached = get().orders[orderId];
        if (!cached) return null;
        if (isStale(cached.fetchedAt)) return null;
        return cached.order;
      },

      getLastCompletedOrder: () => {
        const id = get().lastCompletedOrderId;
        if (!id) return null;
        return get().getOrder(id);
      },

      getRecentOrders: (maxAgeMinutes = CACHE_EXPIRY_MINUTES) => {
        const all = get().orders;
        return Object.values(all)
          .filter((cached) => !isStale(cached.fetchedAt, maxAgeMinutes))
          .map((cached) => cached.order)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      },

      markLastOrderShown: () => set({ lastCompletedOrderShown: true }),

      hasRecentOrder: () => {
        const order = get().getLastCompletedOrder();
        return !!order && !get().lastCompletedOrderShown;
      },

      clearLastOrder: () => set({ lastCompletedOrderId: null, lastCompletedOrderShown: false }),
    }),
    {
      name: 'rolls-customer-orders',
      partialize: (state) => ({
        orders: state.orders,
        lastCompletedOrderId: state.lastCompletedOrderId,
        lastCompletedOrderShown: state.lastCompletedOrderShown,
      }),
    }
  )
);
