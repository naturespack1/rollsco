import { Navigate, useLocation } from 'react-router-dom';
import { useAdminStore } from '@/store/useAdminStore';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAdminStore((s) => s.token);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
