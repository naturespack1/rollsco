import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useStoreStore } from '@/store/useStoreStore';
import { useCartStore } from '@/store/useCartStore';
import Header from '@/components/Header';
import StoreSelector from '@/pages/StoreSelector';
import MenuPage from '@/pages/MenuPage';
import CheckoutPage from '@/pages/CheckoutPage';
import OrderSuccess from '@/pages/OrderSuccess';
import AdminLogin from '@/pages/admin/AdminLogin';
import ProtectedRoute from '@/components/ProtectedRoute';

const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));

function GlobalTaglineFooter() {
  const location = useLocation();
  if (location.pathname.startsWith('/admin')) return null;
  if (location.pathname === '/' ) return null; // StoreSelector has its own full footer
  return (
    <footer className="mt-8 border-t border-gray-100 bg-white py-4">
      <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] font-black tracking-[0.15em] uppercase">
          <span className="text-gray-900">No Empty Bites.</span>
          <span className="text-brand-600">Only Loaded Rolls.</span>
          <span className="hidden md:inline w-1 h-1 bg-gray-300 rounded-full" />
          <span className="hidden md:inline text-gray-500">We Don't Roll Small</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-gray-400">
          <span>⚡ Extremely Loaded</span>
          <span>•</span>
          <span>🙌 Two Hands Needed</span>
          <span>•</span>
          <span>🔄 Wrap. Bite. Repeat.</span>
        </div>
      </div>
    </footer>
  );
}

function App() {
  const selectedStore = useStoreStore((s) => s.selectedStore);
  const cartItems = useCartStore((s) => s.items);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route
            path="/"
            element={selectedStore ? <MenuPage /> : <StoreSelector />}
          />
          <Route
            path="/checkout"
            element={
              selectedStore && cartItems.length > 0 ? (
                <CheckoutPage />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route path="/success/:orderId" element={<OrderSuccess />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute>
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center h-screen">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600" />
                    </div>
                  }
                >
                  <AdminDashboard />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <GlobalTaglineFooter />
    </div>
  );
}

export default App;
