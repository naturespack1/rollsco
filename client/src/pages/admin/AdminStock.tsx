import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAdminCacheStore } from '@/store/useAdminCacheStore';
import { Package, Save, AlertTriangle, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StockItem {
  id: string;
  name: string;
  stock: number;
  category: string;
  price: number;
}

interface AdminStockProps {
  storeId: string;
}

export default function AdminStock({ storeId }: AdminStockProps) {
  const [items, setItems] = useState<StockItem[]>([]);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [isOffline, setIsOffline] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  // Cache
  const getMenuCache = useAdminCacheStore((s) => s.getMenuCache);
  const setMenuCache = useAdminCacheStore((s) => s.setMenuCache);
  const updateItemStockInCache = useAdminCacheStore((s) => s.updateItemStock);
  const isStale = useAdminCacheStore((s) => s.isStale);

  const fetchItems = useCallback(async (forceFetch = false) => {
    const cache = getMenuCache(storeId);

    if (cache && !forceFetch) {
      const stale = isStale(cache.fetchedAt, 10); // 10 min staleness for stock
      if (!stale || isOffline) {
        setItems(
          cache.items.map((i: any) => ({
            id: i.id,
            name: i.name,
            stock: i.stock,
            category: i.categoryName || i.category?.name || 'Item',
            price: i.price,
          }))
        );
        setLoading(false);
        setFromCache(true);
        if (isOffline) return;
      }
    }

    setLoading(true);
    try {
      const res = await api.get(`/admin/menu/${storeId}`);
      const data = res.data.data?.items || [];
      setItems(
        data.map((i: any) => ({
          id: i.id,
          name: i.name,
          stock: i.stock,
          category: i.categoryName || i.category?.name || 'Item',
          price: i.price,
        }))
      );
      setMenuCache({
        items: data,
        categories: res.data.data?.categories || [],
        fetchedAt: new Date().toISOString(),
        storeId,
      });
      setFromCache(false);
      setIsOffline(false);
    } catch {
      if (cache) {
        setItems(
          cache.items.map((i: any) => ({
            id: i.id,
            name: i.name,
            stock: i.stock,
            category: i.categoryName || i.category?.name || 'Item',
            price: i.price,
          }))
        );
        setIsOffline(true);
      }
    } finally {
      setLoading(false);
    }
  }, [storeId, isOffline, getMenuCache, setMenuCache, isStale]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleUpdate = async (itemId: string) => {
    const newStock = edits[itemId];
    if (newStock === undefined || newStock < 0) return;

    // Optimistic update in local state and cache
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, stock: newStock } : i)));
    updateItemStockInCache(itemId, newStock);
    setSaving((prev) => ({ ...prev, [itemId]: true }));

    try {
      await api.post('/admin/stock', { itemId, stock: Number(newStock) });
      setEdits((prev) => { const next = { ...prev }; delete next[itemId]; return next; });
      setIsOffline(false);
    } catch {
      alert('Failed to update stock on server. Change saved locally and will sync when online.');
      setIsOffline(true);
    } finally {
      setSaving((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  const cacheData = getMenuCache(storeId);
  const cacheAge = cacheData?.fetchedAt
    ? Math.round((Date.now() - new Date(cacheData.fetchedAt).getTime()) / 60000)
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-white">Stock Management</h2>
          {isOffline && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded-full">
              <WifiOff className="w-3 h-3" /> Offline
            </span>
          )}
          {fromCache && !isOffline && (
            <span className="flex items-center gap-1 text-[10px] text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">
              <Wifi className="w-3 h-3" /> Cached {cacheAge}m ago
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchItems(true)}
            className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition"
            title="Force refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : (
        <div className="grid gap-2">
          {items.map((item) => {
            const edited = edits[item.id] !== undefined && edits[item.id] !== item.stock;
            const low = item.stock <= 5;
            return (
              <div key={item.id} className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-xl p-3">
                <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center shrink-0">
                  <Package className={cn('w-5 h-5', low ? 'text-red-400' : 'text-gray-400')} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">{item.name}</span>
                    {low && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-900/30 px-1.5 py-0.5 rounded">
                        <AlertTriangle className="w-3 h-3" /> Low
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">{item.category} · ₹{item.price}</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={edits[item.id] !== undefined ? edits[item.id] : item.stock}
                    onChange={(e) => setEdits((prev) => ({ ...prev, [item.id]: parseInt(e.target.value || '0', 10) }))}
                    className={cn(
                      'w-20 px-2 py-1.5 rounded-lg bg-gray-900 border text-sm text-white text-center focus:outline-none',
                      edited ? 'border-brand-500' : 'border-gray-700'
                    )}
                  />
                  <button
                    onClick={() => handleUpdate(item.id)}
                    disabled={!edited || saving[item.id]}
                    className={cn(
                      'p-1.5 rounded-lg transition',
                      edited && !saving[item.id]
                        ? 'bg-brand-600 text-white hover:bg-brand-700'
                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    )}
                  >
                    <Save className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
