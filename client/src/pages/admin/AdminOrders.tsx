import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useAdminCacheStore } from '@/store/useAdminCacheStore';
import type { Order } from '@/types';
import BillPrint from '@/components/BillPrint';
import {
  RefreshCw,
  CheckCircle,
  Clock,
  Truck,
  ChevronDown,
  ChevronUp,
  Filter,
  Wifi,
  WifiOff,
  AlertCircle,
} from 'lucide-react';

const statusColors: Record<string, string> = {
  CREATED: 'bg-accent-100 text-accent-700 border-accent-200',
  PROCESSING: 'bg-blue-100 text-blue-700 border-blue-200',
  DELIVERED: 'bg-green-100 text-green-700 border-green-200',
};

const statusIcons = {
  CREATED: Clock,
  PROCESSING: Truck,
  DELIVERED: CheckCircle,
};

interface AdminOrdersProps {
  storeId: string;
}

export default function AdminOrders({ storeId }: AdminOrdersProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, string>>(() => {
    const cached = useAdminCacheStore.getState().pendingOrderUpdates;
    const map: Record<string, string> = {};
    Object.entries(cached).forEach(([id, data]) => { map[id] = data.status; });
    return map;
  });
  const [filter, setFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSyncLocal] = useState<string>('');
  const [autoSyncInterval, setAutoSyncIntervalLocal] = useState<number>(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [isOffline, setIsOffline] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storeName, setStoreName] = useState('Rolls & Co.');
  const [storeAddress, setStoreAddress] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const handleSyncRef = useRef<((silent?: boolean) => Promise<void>) | null>(null);

  // Cache store
  const cachedOrders = useAdminCacheStore((s) => s.ordersCache);
  const getCachedOrders = useAdminCacheStore((s) => s.getOrdersCache);
  const setCachedOrders = useAdminCacheStore((s) => s.setOrdersCache);
  const isStale = useAdminCacheStore((s) => s.isStale);
  const setPendingCacheUpdate = useAdminCacheStore((s) => s.setPendingOrderUpdate);
  const clearPendingCacheUpdates = useAdminCacheStore((s) => s.clearPendingOrderUpdates);
  const persistedAutoSync = useAdminCacheStore((s) => s.autoSyncInterval);
  const setPersistedAutoSync = useAdminCacheStore((s) => s.setAutoSyncInterval);
  const persistedLastSync = useAdminCacheStore((s) => s.lastSync);
  const setPersistedLastSync = useAdminCacheStore((s) => s.setLastSync);

  // Initialize sync settings from persisted cache store on mount
  useEffect(() => {
    if (persistedAutoSync > 0) setAutoSyncIntervalLocal(persistedAutoSync);
    if (persistedLastSync) setLastSyncLocal(persistedLastSync);
  }, [persistedAutoSync, persistedLastSync]);

  // Load from cache immediately, then fetch fresh
  const loadOrders = useCallback(async (forceFetch = false) => {
    setError(null);
    const cache = getCachedOrders(storeId, filter);

    // Show cache first if available and not stale (or offline)
    if (cache && !forceFetch) {
      const stale = isStale(cache.fetchedAt, 5); // 5 minute staleness threshold
      if (!stale || isOffline) {
        setOrders(cache.orders);
        setLoading(false);
        setFromCache(true);
        if (!stale) return; // Fresh cache — no background fetch needed
        if (isOffline) return; // Offline — can't fetch
      }
    }

    setLoading(true);
    try {
      const res = await api.get('/admin/orders', {
        params: { storeId, status: filter === 'ALL' ? undefined : filter },
      });
      const data = res.data.data?.orders || [];
      setOrders(data);
      setCachedOrders({
        orders: data,
        total: res.data.data?.total || 0,
        page: res.data.data?.page || 1,
        limit: res.data.data?.limit || 20,
        fetchedAt: new Date().toISOString(),
        storeId,
        filter,
      });
      setFromCache(false);
      setIsOffline(false);
      setError(null);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to load orders from server';
      setError(msg);
      // If fetch fails and we have cache, show cache (offline mode)
      if (cache) {
        setOrders(cache.orders);
        setIsOffline(true);
      }
    } finally {
      setLoading(false);
    }
  }, [storeId, filter, isOffline, getCachedOrders, setCachedOrders, isStale]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Load store info for bill printing
  useEffect(() => {
    api.get('/stores').then((res) => {
      const stores = res.data.data || [];
      const s = stores.find((st: any) => st.id === storeId);
      if (s) {
        setStoreName(s.name);
        setStoreAddress(s.address || '');
      }
    }).catch(() => {});
  }, [storeId]);

  const handleSync = async (silent = false) => {
    if (!silent) setSyncing(true);
    setError(null);
    try {
      // Push pending updates if any
      const updates = Object.entries(pendingUpdates).map(([orderId, status]) => ({ orderId, status }));
      if (updates.length > 0) {
        await api.post('/admin/orders/sync', { updates, lastSync: lastSync || undefined }, { params: { storeId } });
        clearPendingCacheUpdates(Object.keys(pendingUpdates));
        setPendingUpdates({});
        const syncTime = new Date().toISOString();
        setLastSyncLocal(syncTime);
        setPersistedLastSync(syncTime);
      }
      
      // Always fetch full orders from server after sync
      await loadOrders(true);
      setIsOffline(false);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Sync failed';
      if (!silent) setError(msg);
      setIsOffline(true);
    } finally {
      if (!silent) setSyncing(false);
    }
  };

  // Keep ref to latest handleSync for interval
  useEffect(() => {
    handleSyncRef.current = handleSync;
  });

  // Auto sync interval — always does a full server fetch
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoSyncInterval > 0) {
      timerRef.current = setInterval(() => {
        handleSyncRef.current?.(true);
      }, autoSyncInterval * 60 * 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoSyncInterval]);

  // Network status listener
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

  const handleStatusChange = (orderId: string, newStatus: string) => {
    setPendingUpdates((prev) => ({ ...prev, [orderId]: newStatus }));
    setPendingCacheUpdate(orderId, newStatus);
    // Optimistic update locally
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );
  };



  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const pendingCount = Object.keys(pendingUpdates).length;
  const cacheAge = cachedOrders?.fetchedAt
    ? Math.round((Date.now() - new Date(cachedOrders.fetchedAt).getTime()) / 60000)
    : null;

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-white">Active Orders</h2>
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
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg border border-gray-700 px-2 py-1.5">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-transparent text-xs text-gray-200 focus:outline-none"
            >
              <option value="ALL">All</option>
              <option value="CREATED">Created</option>
              <option value="PROCESSING">Processing</option>
              <option value="DELIVERED">Delivered</option>
            </select>
          </div>

          <select
            value={autoSyncInterval}
            onChange={(e) => {
              const val = Number(e.target.value);
              setAutoSyncIntervalLocal(val);
              setPersistedAutoSync(val);
            }}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none"
          >
            <option value={0}>Manual Sync</option>
            <option value={1}>Auto: 1 min</option>
            <option value={3}>Auto: 3 min</option>
            <option value={5}>Auto: 5 min</option>
          </select>

          <button
            onClick={() => handleSync()}
            disabled={syncing}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition',
              pendingCount > 0
                ? 'bg-brand-600 text-white hover:bg-brand-700'
                : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
            )}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')} />
            {pendingCount > 0 ? `Sync (${pendingCount})` : 'Fetch'}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 rounded-lg px-3 py-2 text-xs text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button 
            onClick={() => loadOrders(true)} 
            className="text-red-300 hover:text-red-200 underline font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {loading && orders.length === 0 ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          {isOffline ? 'No cached orders. Connect to internet to load.' : 'No orders found'}
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            const StatusIcon = statusIcons[order.status as keyof typeof statusIcons] || Clock;
            const isExpanded = expanded[order.id];
            const hasPendingUpdate = pendingUpdates[order.id];
            return (
              <div
                key={order.id}
                className={cn(
                  'bg-gray-800 rounded-xl border border-gray-700 overflow-hidden transition',
                  hasPendingUpdate && 'border-l-2 border-l-brand-500'
                )}
              >
                <div className="p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center shrink-0">
                    <StatusIcon className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{order.orderNo}</span>
                      <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', statusColors[order.status])}>
                        {order.status}
                      </span>
                      {hasPendingUpdate && (
                        <span className="text-[10px] text-brand-400 bg-brand-900/30 px-1.5 py-0.5 rounded-full">
                          unsynced
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {order.customerPhone} · {order.items?.reduce((s, i) => s + i.quantity, 0)} items · {formatPrice(order.total || 0)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <BillPrint
                      order={order}
                      storeName={storeName}
                      storeAddress={storeAddress}
                    />
                    <select
                      value={pendingUpdates[order.id] || order.status}
                      onChange={(e) => handleStatusChange(order.id, e.target.value)}
                      className="bg-gray-900 border border-gray-700 rounded-md px-2 py-1 text-xs text-white focus:outline-none"
                    >
                      <option value="CREATED">Created</option>
                      <option value="PROCESSING">Processing</option>
                      <option value="DELIVERED">Delivered</option>
                    </select>
                    <button onClick={() => toggleExpand(order.id)} className="p-1 text-gray-400 hover:text-white">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-gray-700 pt-2">
                    <div className="text-xs text-gray-400 mb-2">{new Date(order.createdAt).toLocaleString()}</div>
                    <div className="space-y-1.5">
                      {order.items?.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm text-gray-300">
                          <span>
                            {item.itemName} × {item.quantity}
                          </span>
                          <span>{formatPrice(item.totalPrice || item.unitPrice * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                    {order.customerMessage && (
                      <div className="mt-2 text-xs text-accent-400 bg-accent-900/20 rounded-lg p-2">
                        Note: {order.customerMessage}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
