import { useNavigate } from 'react-router-dom';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';
import { formatPrice } from '@/lib/utils';

export default function MobileCart() {
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const totals = useCartStore((s) => s.getTotals());
  const itemCount = useCartStore((s) => s.getItemCount());

  if (items.length === 0) return null;

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-4 py-3 pb-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-600">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </div>
            <div className="text-xs text-gray-500">
              {items.slice(0, 2).map((i) => i.name).join(', ')}
              {items.length > 2 && '...'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-bold text-gray-900">{formatPrice(totals.total)}</div>
            <div className="text-[10px] text-gray-400">Inc. taxes</div>
          </div>
          <button
            onClick={() => navigate('/checkout')}
            className="px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition flex items-center gap-1 shadow-sm"
          >
            Checkout <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
