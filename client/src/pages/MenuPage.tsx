import { useEffect, useState, useRef, useCallback } from 'react';
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

const SCROLL_OFFSET = 120; // header (56px) + sticky nav (~64px)

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
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const isScrolling = useRef(false);

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

        const rawData = (res.data.data?.menu || []) as MenuCategory[];

        // Remove any existing virtual "Most loved" from server to avoid duplication (we will rebuild fresh)
        const cleanData = rawData.filter((c) => c.category.toLowerCase() !== 'most loved');

        const processed = cleanData
          .map((cat) => ({
            ...cat,
            items: [...cat.items].sort((a, b) => {
              const aLoved = a.isBestseller ? 0 : 1;
              const bLoved = b.isBestseller ? 0 : 1;
              if (aLoved !== bLoved) return aLoved - bLoved;
              return a.name.localeCompare(b.name);
            }),
          }))
          .sort((a, b) => {
            const aCount = a.items.filter((i) => i.isBestseller).length;
            const bCount = b.items.filter((i) => i.isBestseller).length;
            if (aCount !== bCount) return bCount - aCount;
            return a.category.localeCompare(b.category);
          });

        // Build "Most loved" virtual category aggregating all bestseller items
        const allItems = cleanData.flatMap((c) => c.items);
        const lovedMap = new Map<string, MenuItem>();
        allItems.forEach((item) => {
          if (item.isBestseller) lovedMap.set(item.id, item);
        });
        const mostLovedItems = Array.from(lovedMap.values()).sort((a, b) => a.name.localeCompare(b.name));

        let finalMenu: MenuCategory[] = processed;
        if (mostLovedItems.length > 0) {
          const mostLovedCategory: MenuCategory = {
            category: 'Most loved',
            items: mostLovedItems,
          };
          finalMenu = [mostLovedCategory, ...processed];
        }

        setMenu(finalMenu);
        if (finalMenu.length > 0) setActiveCategory(finalMenu[0].category);
      })
      .catch(() => setError('Failed to load menu'))
      .finally(() => setLoading(false));
  }, [selectedStore, setStoreId, clearCart, clearStore, navigate]);

  const categories = menu.map((m) => m.category);

  // Track which section is visible via IntersectionObserver
  useEffect(() => {
    if (loading || menu.length === 0) return;

    const observers: IntersectionObserver[] = [];

    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      if (isScrolling.current) return;
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setActiveCategory(entry.target.getAttribute('data-category') || '');
          break;
        }
      }
    };

    menu.forEach((cat) => {
      const el = sectionRefs.current[cat.category];
      if (!el) return;
      const observer = new IntersectionObserver(handleIntersect, {
        rootMargin: `-${SCROLL_OFFSET}px 0px -60% 0px`,
        threshold: 0,
      });
      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [loading, menu]);

  const scrollToCategory = useCallback((category: string) => {
    const el = sectionRefs.current[category];
    if (!el) return;
    setActiveCategory(category);
    isScrolling.current = true;
    const top = el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET;
    window.scrollTo({ top, behavior: 'smooth' });
    setTimeout(() => { isScrolling.current = false; }, 600);
  }, []);

  if (!selectedStore) return null;

  return (
    <div className="flex flex-col lg:flex-row max-w-6xl mx-auto">
      <div className="flex-1 min-w-0">
        <CategoryNav categories={categories} active={activeCategory} onSelect={scrollToCategory} />

        <div className="px-4 py-4 pb-28 lg:pb-8">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
            </div>
          ) : error ? (
            <div className="text-center text-red-600 py-12">{error}</div>
          ) : (
            <div className="space-y-8">
              {menu.map((cat) => {
                const lovedCount = cat.items.filter((i) => i.isBestseller).length;
                const isMostLovedCat = cat.category === 'Most loved';
                return (
                  <section
                    key={cat.category}
                    data-category={cat.category}
                    ref={(el) => { sectionRefs.current[cat.category] = el; }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          {isMostLovedCat && <span className="text-accent-500">🔥</span>} {cat.category}
                        </h2>
                        {!isMostLovedCat && lovedCount > 0 && (
                          <span className="text-[10px] font-bold bg-accent-500 text-black px-2 py-0.5 rounded-full">Most loved • {lovedCount}</span>
                        )}
                        {isMostLovedCat && (
                          <span className="text-[10px] font-bold bg-black text-white px-2 py-0.5 rounded-full">{cat.items.length} favourites</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">{cat.items.length} items</span>
                    </div>
                    <div className="grid gap-3">
                      {cat.items.map((item) => (
                        <MenuItemCard key={item.id} item={item} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <CartDrawer />
      <MobileCart />
    </div>
  );
}
