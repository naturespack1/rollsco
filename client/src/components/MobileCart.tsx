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
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
      {/* Mini tagline strip */}
      <div className="bg-black text-white px-4 py-1 flex items-center justify-center gap-2">
        <span className="text-[8px] font-black tracking-[0.2em] uppercase">🔥 No Empty Bites. Only Loaded Rolls. • ⚡ Extremely Loaded</span>
      </div>
      <div className="px-4 py-3 pb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center text-white">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-black text-gray-900 uppercase tracking-tight">
                {itemCount} {itemCount === 1 ? 'roll' : 'rolls'} • We Don't Roll Small
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
              <div className="text-[9px] font-black uppercase tracking-widest text-gray-400">Wrap. Bite. Repeat.</div>
            </div>
            <button
              onClick={() => navigate('/checkout')}
              className="px-4 py-2.5 rounded-xl bg-brand-600 text-white text-[12px] font-black uppercase tracking-wide hover:bg-brand-700 transition flex items-center gap-1 shadow-sm"
            >
              Checkout <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
