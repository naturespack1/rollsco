import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAdminCacheStore } from '@/store/useAdminCacheStore';
import { Download, TrendingUp, Calendar, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface Bestseller {
  id: string;
  name: string;
  totalSold: number;
}

interface AdminReportsProps {
  storeId: string;
}

const ranges = [
  { label: 'Today', value: '1' },
  { label: 'Last 7 Days', value: '7' },
  { label: 'Last 30 Days', value: '30' },
  { label: 'All Time', value: '0' },
];

export default function AdminReports({ storeId }: AdminReportsProps) {
  const [bestsellers, setBestsellers] = useState<Bestseller[]>([]);
  const [days, setDays] = useState('30');
  const [loading, setLoading] = useState(true);
  const [exportDate, setExportDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isOffline, setIsOffline] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  // Cache
  const getBestsellersCache = useAdminCacheStore((s) => s.getBestsellersCache);
  const setBestsellersCache = useAdminCacheStore((s) => s.setBestsellersCache);
  const isStale = useAdminCacheStore((s) => s.isStale);

  const fetchBestsellers = async (forceFetch = false) => {
    const cache = getBestsellersCache(storeId, days);

    if (cache && !forceFetch) {
      const stale = isStale(cache.fetchedAt, 5); // 5 min staleness for reports
      if (!stale || isOffline) {
        setBestsellers(cache.data);
        setLoading(false);
        setFromCache(true);
        if (isOffline) return;
      }
    }

    setLoading(true);
    try {
      const res = await api.get('/admin/bestsellers', { params: { storeId, days } });
      const data = res.data.data || [];
      setBestsellers(data);
      setBestsellersCache({
        data,
        days,
        fetchedAt: new Date().toISOString(),
        storeId,
      });
      setFromCache(false);
      setIsOffline(false);
    } catch {
      if (cache) {
        setBestsellers(cache.data);
        setIsOffline(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBestsellers();
  }, [storeId, days]);

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

  const handleExport = async () => {
    try {
      const res = await api.get('/admin/export/daily', {
        params: { storeId, date: exportDate },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `sales-${storeId}-${exportDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Export failed';
      alert(`Export failed: ${msg}`);
    }
  };

  const cacheData = getBestsellersCache(storeId, days);
  const cacheAge = cacheData?.fetchedAt
    ? Math.round((Date.now() - new Date(cacheData.fetchedAt).getTime()) / 60000)
    : null;
  const rangeLabel = ranges.find((r) => r.value === days)?.label || 'Last 30 Days';

  return (
    <div className="space-y-6">
      {/* Daily Export */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4">Export & Reports</h2>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>Daily Sales Export</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={exportDate}
              onChange={(e) => setExportDate(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
            />
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition"
            >
              <Download className="w-4 h-4" />
              Export Excel
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Downloads a detailed Excel sheet with order breakdown, CGST, SGST, and grand totals for the selected date.
          </p>
        </div>
      </div>

      {/* Bestsellers */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-brand-400" />
              <h3 className="text-base font-bold text-white">Top Selling Items</h3>
            </div>
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
            <div className="flex bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
              {ranges.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setDays(r.value)}
                  className={
                    days === r.value
                      ? 'px-3 py-1.5 text-xs font-medium bg-brand-900/40 text-brand-400 border-r border-gray-700 last:border-r-0'
                      : 'px-3 py-1.5 text-xs font-medium text-gray-400 hover:bg-gray-700 border-r border-gray-700 last:border-r-0 transition'
                  }
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => fetchBestsellers(true)}
              className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition"
              title="Force refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
          </div>
        ) : bestsellers.length === 0 ? (
          <div className="text-gray-500 text-sm py-4">
            {isOffline ? 'No cached data. Connect to internet to load.' : `No sales data for ${rangeLabel}`}
          </div>
        ) : (
          <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-gray-900/50 text-xs font-semibold text-gray-400 uppercase">
              <div className="col-span-1">#</div>
              <div className="col-span-7">Item</div>
              <div className="col-span-4 text-right">Sold</div>
            </div>
            {bestsellers.map((b, idx) => (
              <div key={b.id} className="grid grid-cols-12 gap-2 px-4 py-3 border-t border-gray-700 items-center">
                <div className="col-span-1 text-sm font-bold text-gray-500">{idx + 1}</div>
                <div className="col-span-7 text-sm text-white font-medium">{b.name}</div>
                <div className="col-span-4 text-right text-sm font-bold text-brand-400">{b.totalSold}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
