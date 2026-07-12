import { create } from 'zustand';
import type { Order } from '@/types';

if (typeof window !== 'undefined') {
  // Purge the legacy persisted customer-order cache, which contained PII.
  localStorage.removeItem('rolls-customer-orders');
}

/** Customer order data is kept in memory only to avoid persisting PII on a device. */
const CACHE_EXPIRY_MINUTES = 24 * 60;

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
  return Date.now() - new Date(fetchedAt).getTime() > maxAgeMinutes * 60 * 1000;
}

export const useCustomerOrdersStore = create<CustomerOrdersState>()((set, get) => ({
  orders: {},
  lastCompletedOrderId: null,
  lastCompletedOrderShown: false,

  addOrder: (order) => {
    const now = new Date().toISOString();
    set((state) => {
      const orders = { ...state.orders };
      Object.entries(orders).forEach(([id, cached]) => {
        if (isStale(cached.fetchedAt)) delete orders[id];
      });
      orders[order.id] = { order, fetchedAt: now };
      return { orders, lastCompletedOrderId: order.id, lastCompletedOrderShown: false };
    });
  },

  getOrder: (orderId) => {
    const cached = get().orders[orderId];
    return cached && !isStale(cached.fetchedAt) ? cached.order : null;
  },

  getLastCompletedOrder: () => {
    const id = get().lastCompletedOrderId;
    return id ? get().getOrder(id) : null;
  },

  getRecentOrders: (maxAgeMinutes = CACHE_EXPIRY_MINUTES) =>
    Object.values(get().orders)
      .filter((cached) => !isStale(cached.fetchedAt, maxAgeMinutes))
      .map((cached) => cached.order)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),

  markLastOrderShown: () => set({ lastCompletedOrderShown: true }),
  hasRecentOrder: () => !!get().getLastCompletedOrder() && !get().lastCompletedOrderShown,
  clearLastOrder: () => set({ lastCompletedOrderId: null, lastCompletedOrderShown: false }),
}));
