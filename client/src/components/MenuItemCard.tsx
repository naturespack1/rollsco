import { Plus, Minus, Flame, Star } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';
import { cn, formatPrice } from '@/lib/utils';
import type { MenuItem } from '@/types';

interface MenuItemCardProps {
  item: MenuItem;
}

export default function MenuItemCard({ item }: MenuItemCardProps) {
  const cartItems = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const cartItem = cartItems.find((c) => c.id === item.id);
  const inCartQty = cartItem?.quantity || 0;

  const canAdd = item.stock > inCartQty;

  const handleAdd = () => {
    if (!canAdd) return;
    addItem({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
      maxStock: item.stock,
      category: item.category,
      imageUrl: item.imageUrl,
      gstRate: item.gstRate,
    });
  };

  return (
    <div className={cn('flex gap-3 p-3 rounded-xl bg-white border border-gray-100 shadow-sm transition', item.stock === 0 && 'opacity-50')}>
      <div className="relative w-24 h-24 shrink-0 rounded-lg overflow-hidden bg-gray-100">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <Star className="w-8 h-8" />
          </div>
        )}
        {item.isBestseller && (
          <div className="absolute top-1 left-1 flex items-center gap-0.5 bg-accent-500 text-black text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full">
            <Flame className="w-3 h-3" /> Most loved
          </div>
        )}
        {item.category?.toLowerCase().includes('roll') && (
          <div className="absolute bottom-1 left-1 right-1 bg-black/85 backdrop-blur-sm text-white text-[8px] font-black tracking-[0.15em] uppercase px-2 py-0.5 rounded-full text-center">
            ⚡ Extremely Loaded
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-semibold text-gray-900 text-sm leading-tight">{item.name}</h4>
          </div>
          {item.description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>
          )}
        </div>

        <div className="flex items-end justify-between mt-2">
          <div>
            <div className="text-sm font-bold text-gray-900">{formatPrice(item.price)}</div>
            {item.stock <= 5 && item.stock > 0 && (
              <div className="text-[10px] font-medium text-red-600 mt-0.5">Only {item.stock} left!</div>
            )}
            {item.stock === 0 && (
              <div className="text-[10px] font-medium text-gray-400 mt-0.5">Sold out</div>
            )}
          </div>

          {inCartQty > 0 ? (
            <div className="flex items-center gap-2 bg-brand-50 rounded-lg p-1">
              <button
                onClick={() => updateQuantity(item.id, inCartQty - 1)}
                className="w-7 h-7 flex items-center justify-center rounded-md bg-white text-brand-600 shadow-sm hover:bg-gray-50"
                aria-label="Decrease"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold text-brand-700 w-4 text-center">{inCartQty}</span>
              <button
                onClick={() => canAdd && handleAdd()}
                disabled={!canAdd}
                className="w-7 h-7 flex items-center justify-center rounded-md bg-brand-600 text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Increase"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleAdd}
              disabled={item.stock === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:bg-gray-200 disabled:text-gray-400 transition"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
