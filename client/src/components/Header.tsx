import { useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, ArrowLeft, ChefHat } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';
import { useStoreStore } from '@/store/useStoreStore';
import { cn } from '@/lib/utils';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const itemCount = useCartStore((s) => s.getItemCount());
  const selectedStore = useStoreStore((s) => s.selectedStore);
  const clearStore = useStoreStore((s) => s.clearStore);
  const clearCart = useCartStore((s) => s.clearCart);

  const isAdmin = location.pathname.startsWith('/admin');
  const isCheckout = location.pathname === '/checkout';

  return (
    <header className={cn('sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm', isAdmin && 'bg-gray-900 border-gray-800 text-white')}>
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isCheckout && (
            <button
              onClick={() => navigate('/')}
              className="p-1 -ml-1 rounded-full hover:bg-gray-100 transition"
              aria-label="Back"
            >
              <ArrowLeft className={cn('w-5 h-5', isAdmin ? 'text-white' : 'text-gray-700')} />
            </button>
          )}
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => {
              if (!isAdmin) {
                clearStore();
                clearCart();
              }
              navigate('/');
            }}
          >
            <ChefHat className={cn('w-6 h-6', isAdmin ? 'text-brand-400' : 'text-brand-600')} />
            <div className="flex flex-col leading-none">
              <span className={cn('font-black text-[18px] tracking-tight', isAdmin ? 'text-white' : 'text-gray-900')}>
                ROLLS & CO.
              </span>
              {!isAdmin && (
                <span className="hidden md:block text-[8.5px] font-black tracking-[0.18em] uppercase text-brand-600 -mt-0.5">
                  No Empty Bites. Only Loaded Rolls.
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isAdmin && selectedStore && !isCheckout && (
            <button
              onClick={() => {
                if (confirm('Change store? Your cart will be cleared.')) {
                  clearStore();
                  clearCart();
                  navigate('/');
                }
              }}
              className="text-xs font-medium text-brand-600 hover:text-brand-700 underline"
            >
              {selectedStore.name}
            </button>
          )}

          {!isAdmin && !isCheckout && itemCount > 0 && (
            <button
              onClick={() => navigate('/checkout')}
              className="relative p-2 rounded-full bg-brand-50 text-brand-600 hover:bg-brand-100 transition"
              aria-label="Cart"
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 bg-brand-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {itemCount}
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
