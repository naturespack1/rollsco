import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStoreStore } from '@/store/useStoreStore';
import { useCartStore } from '@/store/useCartStore';
import { api } from '@/lib/api';
import CategoryNav from '@/components/CategoryNav';
import MenuItemCard from '@/components/MenuItemCard';
import CartDrawer from '@/components/CartDrawer';
import MobileCart from '@/components/MobileCart';
import type { MenuItem, Store } from '@/types';

interface MenuCategory {
  category: string;
  items: MenuItem[];
}

export default function MenuPage() {
  const navigate = useNavigate();
  const selectedStore = useStoreStore((s) => s.selectedStore);
  const clearStore = useStoreStore((s) => s.clearStore);
  const setStoreId = useCartStore((s) => s.setStoreId);
  const clearCart = useCartStore((s) => s.clearCart);
  const [menu, setMenu] = useState<MenuCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!selectedStore) return;
    setStoreId(selectedStore.id);
    setLoading(true);
    setError('');
    api.get(`/menu/${selectedStore.id}`)
      .then((res) => {
        const liveStore = res.data.data?.store as Store | undefined;
        if (!liveStore || !liveStore.isOpen || !liveStore.acceptingOrders) {
          clearCart();
          clearStore();
          navigate('/', { replace: true });
          return;
        }

        const data = res.data.data?.menu || [];
        setMenu(data);
        if (data.length > 0) setActiveCategory(data[0].category);
      })
      .catch(() => setError('Failed to load menu'))
      .finally(() => setLoading(false));
  }, [selectedStore, setStoreId, clearCart, clearStore, navigate]);

  const activeItems = useMemo(() => {
    return menu.find((m) => m.category === activeCategory)?.items || [];
  }, [menu, activeCategory]);

  const categories = menu.map((m) => m.category);

  if (!selectedStore) return null;

  return (
    <div className="flex flex-col lg:flex-row max-w-6xl mx-auto">
      <div className="flex-1 min-w-0">
        <CategoryNav categories={categories} active={activeCategory} onSelect={setActiveCategory} />

        <div className="px-4 py-4 pb-28 lg:pb-8">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
            </div>
          ) : error ? (
            <div className="text-center text-red-600 py-12">{error}</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">{activeCategory}</h2>
                <span className="text-xs text-gray-500">{activeItems.length} items</span>
              </div>
              <div className="grid gap-3">
                {activeItems.map((item) => (
                  <MenuItemCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <CartDrawer />
      <MobileCart />
    </div>
  );
}
