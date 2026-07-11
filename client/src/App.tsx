import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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
    </div>
  );
}

export default App;
