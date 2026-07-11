import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem } from '@/types';

interface CartState {
  storeId: string | null;
  items: CartItem[];
  setStoreId: (id: string) => void;
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getTotals: () => { subtotal: number; cgst: number; sgst: number; total: number };
  getItemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      storeId: null,
      items: [],
      setStoreId: (id) => {
        const current = get().storeId;
        if (current && current !== id) {
          set({ storeId: id, items: [] }); // clear cart on store change
        } else {
          set({ storeId: id });
        }
      },
      addItem: (item) => {
        const items = get().items;
        const existing = items.find((i) => i.id === item.id);
        if (existing) {
          set({
            items: items.map((i) =>
              i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i
            ),
          });
        } else {
          set({ items: [...items, item] });
        }
      },
      removeItem: (id) => {
        set({ items: get().items.filter((i) => i.id !== id) });
      },
      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id);
          return;
        }
        set({
          items: get().items.map((i) => (i.id === id ? { ...i, quantity } : i)),
        });
      },
      clearCart: () => set({ items: [] }),
      getTotals: () => {
        let subtotal = 0;  // base price before tax (reverse-calculated)
        let cgst = 0;
        let sgst = 0;
        let total = 0;     // sum of menu prices (what customer pays)
        for (const item of get().items) {
          const lineTotal = item.price * item.quantity;  // inclusive price × qty
          const gstMultiplier = 1 + (item.gstRate / 100);
          const lineBase = lineTotal / gstMultiplier;      // reverse-calculate base
          const lineGst = lineTotal - lineBase;            // total tax for this line
          subtotal += lineBase;
          cgst += lineGst / 2;
          sgst += lineGst / 2;
          total += lineTotal;
        }
        return {
          subtotal: Math.round(subtotal * 100) / 100,
          cgst: Math.round(cgst * 100) / 100,
          sgst: Math.round(sgst * 100) / 100,
          total: Math.round(total * 100) / 100,
        };
      },
      getItemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      name: 'quickbite-cart',
      partialize: (state) => ({ storeId: state.storeId, items: state.items }),
    }
  )
);
