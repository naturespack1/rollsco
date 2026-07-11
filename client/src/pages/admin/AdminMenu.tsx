import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAdminCacheStore } from '@/store/useAdminCacheStore';
import {
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Package,
  Star,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Wifi,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';

interface Category {
  id: string;
  name: string;
  sort: number;
}

interface MenuItemData {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  gstRate: number;
  hsnCode: string | null;
  imageUrl: string | null;
  isBestseller: boolean;
  isAvailable: boolean;
  storeId: string;
  categoryId: string;
  categoryName: string;
  category?: { id: string; name: string };
}

interface AdminMenuProps {
  storeId: string;
}

const emptyForm = {
  name: '',
  description: '',
  price: '',
  stock: '0',
  gstRate: '5',
  hsnCode: '',
  imageUrl: '',
  isBestseller: false,
  isAvailable: true,
  categoryId: '',
};

export default function AdminMenu({ storeId }: AdminMenuProps) {
  const [items, setItems] = useState<MenuItemData[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [isOffline, setIsOffline] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  // Cache
  const getMenuCache = useAdminCacheStore((s) => s.getMenuCache);
  const setMenuCache = useAdminCacheStore((s) => s.setMenuCache);
  const updateItemAvailabilityInCache = useAdminCacheStore((s) => s.updateItemAvailability);
  const addItemToCache = useAdminCacheStore((s) => s.addItemToCache);
  const updateItemInCache = useAdminCacheStore((s) => s.updateItemInCache);
  const removeItemFromCache = useAdminCacheStore((s) => s.removeItemFromCache);
  const isStale = useAdminCacheStore((s) => s.isStale);

  const fetchData = useCallback(async (forceFetch = false) => {
    const cache = getMenuCache(storeId);

    if (cache && !forceFetch) {
      const stale = isStale(cache.fetchedAt, 10);
      if (!stale || isOffline) {
        setItems(cache.items);
        setLoading(false);
        setFromCache(true);
        if (isOffline) return;
      }
    }

    setLoading(true);
    try {
      const [menuRes, catRes] = await Promise.all([
        api.get(`/admin/menu/${storeId}`),
        api.get('/admin/categories'),
      ]);
      const allItems = menuRes.data.data?.items || [];
      setItems(allItems);
      setCategories(catRes.data.data || []);
      setMenuCache({
        items: allItems,
        categories: catRes.data.data || [],
        fetchedAt: new Date().toISOString(),
        storeId,
      });
      setFromCache(false);
      setIsOffline(false);
    } catch {
      if (cache) {
        setItems(cache.items);
        setIsOffline(true);
      }
    } finally {
      setLoading(false);
    }
  }, [storeId, isOffline, getMenuCache, setMenuCache, isStale]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const startEdit = (item: MenuItemData) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description || '',
      price: String(item.price),
      stock: String(item.stock),
      gstRate: String(item.gstRate || 5),
      hsnCode: item.hsnCode || '',
      imageUrl: item.imageUrl || '',
      isBestseller: item.isBestseller,
      isAvailable: item.isAvailable,
      categoryId: item.categoryId || '',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm, categoryId: categories[0]?.id || '' });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const handleSubmit = async () => {
    if (!form.name || !form.price || !form.categoryId) return;
    setSaving(true);
    try {
      const payload = {
        ...(editingId ? { itemId: editingId } : { storeId, categoryId: form.categoryId }),
        name: form.name,
        description: form.description || undefined,
        price: parseFloat(form.price),
        stock: parseInt(form.stock, 10),
        gstRate: parseFloat(form.gstRate),
        hsnCode: form.hsnCode || undefined,
        imageUrl: form.imageUrl || undefined,
        isBestseller: form.isBestseller,
        isAvailable: form.isAvailable,
      };

      if (editingId) {
        await api.put('/admin/items', payload);
        updateItemInCache(editingId, payload);
        setItems((prev) =>
          prev.map((i) => (i.id === editingId ? { ...i, ...payload } : i))
        );
      } else {
        const res = await api.post('/admin/items', payload);
        const newItem = res.data.data;
        addItemToCache(newItem);
        setItems((prev) => [...prev, newItem]);
      }
      cancelForm();
      setIsOffline(false);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Save failed. Change saved locally if applicable.');
      setIsOffline(true);
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailability = async (item: MenuItemData) => {
    const newStatus = !item.isAvailable;
    // Optimistic update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isAvailable: newStatus } : i))
    );
    updateItemAvailabilityInCache(item.id, newStatus);

    try {
      await api.put('/admin/items', {
        itemId: item.id,
        isAvailable: newStatus,
      });
    } catch {
      alert('Failed to update server. Reverting...');
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, isAvailable: !newStatus } : i))
      );
      updateItemAvailabilityInCache(item.id, !newStatus);
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!confirm('Delete this item permanently? This cannot be undone.')) return;
    try {
      await api.delete(`/admin/items/${itemId}`);
      removeItemFromCache(itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch {
      alert('Delete failed');
    }
  };

  const filteredItems = items.filter((i) => {
    if (filter === 'ALL') return true;
    if (filter === 'AVAILABLE') return i.isAvailable;
    if (filter === 'UNAVAILABLE') return !i.isAvailable;
    return i.categoryName === filter;
  });

  const categoryNames = [...new Set(items.map((i) => i.categoryName).filter(Boolean))];

  const cacheData = getMenuCache(storeId);
  const cacheAge = cacheData?.fetchedAt
    ? Math.round((Date.now() - new Date(cacheData.fetchedAt).getTime()) / 60000)
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-white">Menu Management</h2>
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
            onClick={() => fetchData(true)}
            className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition"
            title="Force refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={showForm ? cancelForm : startAdd}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition',
              showForm
                ? 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
                : 'bg-brand-600 text-white hover:bg-brand-700'
            )}
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cancel' : 'Add Item'}
          </button>
        </div>
      </div>

      {/* Form ... rest of component unchanged ... */}
      {showForm && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-4">
          <h3 className="text-sm font-semibold text-white">
            {editingId ? 'Edit Item' : 'Add New Item'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                placeholder="Chicken Kathi Roll"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Category *</label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                disabled={!!editingId}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 disabled:opacity-50"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Price (₹) * <span className="text-accent-500">(GST inclusive)</span></label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                placeholder="120"
              />
              <p className="text-[10px] text-gray-500 mt-0.5">This is the final price customer pays. Tax is calculated automatically.</p>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Stock</label>
              <input
                type="number"
                min={0}
                value={form.stock}
                onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">GST Rate (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.gstRate}
                onChange={(e) => setForm((f) => ({ ...f, gstRate: e.target.value }))}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                placeholder="5"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">HSN Code</label>
              <input
                value={form.hsnCode}
                onChange={(e) => setForm((f) => ({ ...f, hsnCode: e.target.value }))}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                placeholder="2106"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-gray-400 mb-1 block">Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                placeholder="Short description shown on menu"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-gray-400 mb-1 block">Image URL</label>
              <input
                value={form.imageUrl}
                onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                placeholder="/images/rolls.jpg"
              />
            </div>
            <div className="flex items-center gap-4 md:col-span-2">
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isBestseller}
                  onChange={(e) => setForm((f) => ({ ...f, isBestseller: e.target.checked }))}
                  className="rounded border-gray-600 bg-gray-900 text-brand-600 focus:ring-brand-600"
                />
                <Star className="w-4 h-4 text-accent-500" /> Mark as Bestseller
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isAvailable}
                  onChange={(e) => setForm((f) => ({ ...f, isAvailable: e.target.checked }))}
                  className="rounded border-gray-600 bg-gray-900 text-brand-600 focus:ring-brand-600"
                />
                Available on menu
              </label>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSubmit}
              disabled={saving || !form.name || !form.price || !form.categoryId}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:bg-gray-700 disabled:text-gray-400 transition"
            >
              <Check className="w-4 h-4" />
              {saving ? 'Saving...' : editingId ? 'Update Item' : 'Add Item'}
            </button>
            <button
              onClick={cancelForm}
              className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm font-medium hover:bg-gray-700 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('ALL')}
          className={cn(
            'px-3 py-1 rounded-full text-xs font-medium border transition',
            filter === 'ALL' ? 'bg-brand-900/40 text-brand-400 border-brand-800' : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'
          )}
        >
          All
        </button>
        <button
          onClick={() => setFilter('AVAILABLE')}
          className={cn(
            'px-3 py-1 rounded-full text-xs font-medium border transition',
            filter === 'AVAILABLE' ? 'bg-brand-900/40 text-brand-400 border-brand-800' : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'
          )}
        >
          Available
        </button>
        <button
          onClick={() => setFilter('UNAVAILABLE')}
          className={cn(
            'px-3 py-1 rounded-full text-xs font-medium border transition',
            filter === 'UNAVAILABLE' ? 'bg-brand-900/40 text-brand-400 border-brand-800' : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'
          )}
        >
          Hidden
        </button>
        {categoryNames.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium border transition',
              filter === cat ? 'bg-brand-900/40 text-brand-400 border-brand-800' : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center text-gray-500 py-12">No items found</div>
      ) : (
        <div className="grid gap-2">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={cn(
                'flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-xl p-3 transition',
                !item.isAvailable && 'opacity-60'
              )}
            >
              <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center shrink-0 overflow-hidden">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-5 h-5 text-gray-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white truncate">{item.name}</span>
                  {item.isBestseller && (
                    <Star className="w-3.5 h-3.5 text-accent-500 fill-accent-500" />
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  {item.categoryName || item.category?.name || 'Unknown'} · {formatPrice(item.price)} · GST {item.gstRate}% · Stock: {item.stock}
                </div>
                {!item.isAvailable && (
                  <div className="text-[10px] text-gray-500 mt-0.5">Hidden from menu</div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleAvailability(item)}
                  className={cn(
                    'p-1.5 rounded-lg transition',
                    item.isAvailable ? 'text-green-400 hover:bg-green-900/20' : 'text-gray-400 hover:bg-gray-700'
                  )}
                  title={item.isAvailable ? 'Hide from menu' : 'Show on menu'}
                >
                  {item.isAvailable ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => startEdit(item)}
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white transition"
                  title="Edit"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-900/20 transition"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
