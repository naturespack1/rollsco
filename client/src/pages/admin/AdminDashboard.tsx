import { useState, useEffect, Suspense, lazy } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdminStore } from '@/store/useAdminStore';
import { useAdminCacheStore } from '@/store/useAdminCacheStore';
import { api } from '@/lib/api';
import { Store as StoreType } from '@/types';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  UtensilsCrossed,
  BarChart3,
  Users,
  LogOut,
  ChevronDown,
  Menu,
  X,
  RefreshCw,
  CirclePlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import AdminOrders from './AdminOrders';
import AdminStock from './AdminStock';
import AdminReports from './AdminReports';
import AdminMenu from './AdminMenu';
import AdminCreateOrder from './AdminCreateOrder';
import StoreStatusControls from '@/components/StoreStatusControls';

const AdminStaff = lazy(() => import('./AdminStaff'));

type Tab = 'instoreOrder' | 'orders' | 'stock' | 'menu' | 'reports' | 'staff';

const managerTabs: { id: Tab; label: string; icon: any }[] = [
  { id: 'instoreOrder', label: 'New Order', icon: CirclePlus },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'stock', label: 'Stock', icon: Package },
];

const superAdminTabs: { id: Tab; label: string; icon: any }[] = [
  { id: 'menu', label: 'Menu', icon: UtensilsCrossed },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'staff', label: 'Staff', icon: Users },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const admin = useAdminStore((s) => s.admin);
  const logout = useAdminStore((s) => s.logout);
  const [activeTab, setActiveTab] = useState<Tab>('orders');
  const [stores, setStores] = useState<StoreType[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [loadingStores, setLoadingStores] = useState(true);

  const isSuperAdmin = admin?.role === 'SUPER_ADMIN';
  const tabs = isSuperAdmin ? [...managerTabs, ...superAdminTabs] : managerTabs;

  useEffect(() => {
    api.get('/stores').then((res) => {
      const all = res.data.data || [];
      setStores(all);
      const allowed = all.filter((s: StoreType) => admin?.role === 'SUPER_ADMIN' || admin?.storeIds.includes(s.id));
      setSelectedStoreId(allowed[0]?.id || all[0]?.id || '');
      setLoadingStores(false);
    });
  }, [admin]);

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const handleClearCache = () => {
    if (confirm('Clear all cached dashboard data? This will force fresh fetches from server.')) {
      useAdminCacheStore.getState().invalidateAll();
      window.location.reload();
    }
  };

  const selectedStore = stores.find((store) => store.id === selectedStoreId);

  const handleStoreUpdated = (updatedStore: StoreType) => {
    setStores((currentStores) =>
      currentStores.map((store) => store.id === updatedStore.id ? updatedStore : store)
    );
  };

  if (loadingStores) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-gray-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-gray-800 bg-black">
        <div className="p-4 border-b border-gray-800 flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-brand-400" />
          <span className="font-bold text-white">Dashboard</span>
        </div>

        <div className="p-4 border-b border-gray-800">
          <div className="text-xs text-gray-500 uppercase font-semibold mb-2">Store</div>
          <div className="relative">
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white appearance-none focus:outline-none focus:border-brand-500"
            >
              {stores
                .filter((s) => admin?.role === 'SUPER_ADMIN' || admin?.storeIds.includes(s.id))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
            <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition',
                activeTab === tab.id
                  ? 'bg-brand-900/40 text-brand-400 border border-brand-800'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800 space-y-2">
          <button
            onClick={handleClearCache}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition"
          >
            <RefreshCw className="w-4 h-4" /> Clear Cache
          </button>
          <div className="text-xs text-gray-500">{admin?.name}</div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-900/20 transition"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-black border-b border-gray-800 px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setMobileNavOpen(!mobileNavOpen)} className="p-2 -ml-2 text-gray-300">
            {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <span className="font-bold text-white">Dashboard</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedStoreId}
            onChange={(e) => setSelectedStoreId(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-xs text-white"
          >
            {stores
              .filter((s) => admin?.role === 'SUPER_ADMIN' || admin?.storeIds.includes(s.id))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Mobile Nav Overlay */}
      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/95 pt-16 px-4 pb-4">
          <nav className="space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setMobileNavOpen(false); }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition',
                  activeTab === tab.id
                    ? 'bg-brand-900/40 text-brand-400'
                    : 'text-gray-400 hover:bg-gray-800'
                )}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="mt-6 pt-4 border-t border-gray-800">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-4 py-3 rounded-lg text-sm text-red-400 hover:bg-red-900/20"
            >
              <LogOut className="w-5 h-5" /> Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          {selectedStoreId && selectedStore ? (
            <>
              <StoreStatusControls store={selectedStore} onStoreUpdated={handleStoreUpdated} />
              {activeTab === 'instoreOrder' && <AdminCreateOrder storeId={selectedStoreId} onViewOrders={() => setActiveTab('orders')} />}
              {activeTab === 'orders' && <AdminOrders storeId={selectedStoreId} />}
              {activeTab === 'stock' && <AdminStock storeId={selectedStoreId} />}
              {isSuperAdmin && activeTab === 'menu' && <AdminMenu storeId={selectedStoreId} />}
              {isSuperAdmin && activeTab === 'reports' && <AdminReports storeId={selectedStoreId} />}
              {isSuperAdmin && activeTab === 'staff' && (
                <Suspense
                  fallback={
                    <div className="flex justify-center py-20">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
                    </div>
                  }
                >
                  <AdminStaff />
                </Suspense>
              )}
            </>
          ) : (
            <div className="text-center text-gray-500 py-20">No store assigned</div>
          )}
        </div>
      </main>
    </div>
  );
}
