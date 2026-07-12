import { useNavigate } from 'react-router-dom';
import { Plus, Minus, ArrowRight } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';
import { formatPrice } from '@/lib/utils';

export default function CartDrawer() {
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const totals = useCartStore((s) => s.getTotals());

  if (items.length === 0) return null;

  return (
    <div className="hidden lg:block w-80 shrink-0">
      <div className="sticky top-28 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Your Cart</h3>
          <p className="text-xs text-gray-500 mt-0.5">{items.reduce((s, i) => s + i.quantity, 0)} items</p>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
          {items.map((item) => {
            const canIncrease = item.quantity < Math.min(item.maxStock ?? 20, 20);
            return (
            <div key={item.id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{item.name}</div>
                <div className="text-xs text-gray-500">{item.category} · {formatPrice(item.price)} × {item.quantity}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  className="w-6 h-6 flex items-center justify-center rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-sm font-semibold w-4 text-center">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  disabled={!canIncrease}
                  className="w-6 h-6 flex items-center justify-center rounded bg-brand-50 text-brand-600 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal (excl. tax)</span>
            <span>{formatPrice(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>CGST</span>
            <span>{formatPrice(totals.cgst)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>SGST</span>
            <span>{formatPrice(totals.sgst)}</span>
          </div>
          <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-200">
            <span>Total (incl. GST)</span>
            <span>{formatPrice(totals.total)}</span>
          </div>
          <button
            onClick={() => navigate('/checkout')}
            className="w-full mt-2 py-2.5 rounded-lg bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition flex items-center justify-center gap-2"
          >
            Checkout <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
