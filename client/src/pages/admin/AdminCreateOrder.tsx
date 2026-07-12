import { FormEvent, useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  LoaderCircle,
  Minus,
  Package,
  Plus,
  ReceiptText,
  ShoppingBag,
  UserRound,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAdminCacheStore } from '@/store/useAdminCacheStore';
import { cn, formatPhone, formatPrice } from '@/lib/utils';

const ADMIN_SCROLL_OFFSET = 80; // header (56px) + small gap

interface AdminMenuItem {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  stock: number;
  gstRate: number;
  imageUrl?: string | null;
  isAvailable: boolean;
  categoryName: string;
}

interface CartLine extends AdminMenuItem {
  quantity: number;
}

interface CreatedInstoreOrder {
  orderNo: string;
  total: number | string;
}

interface AdminCreateOrderProps {
  storeId: string;
  onViewOrders: () => void;
}

export default function AdminCreateOrder({ storeId, onViewOrders }: AdminCreateOrderProps) {
  const [menuItems, setMenuItems] = useState<AdminMenuItem[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdOrder, setCreatedOrder] = useState<CreatedInstoreOrder | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const isScrolling = useRef(false);

  useEffect(() => {
    let isCurrent = true;

    setLoadingMenu(true);
    setError('');
    setCart([]);
    setCreatedOrder(null);
    setPhone('');
    setName('');
    setMessage('');

    api.get(`/admin/menu/${storeId}`)
      .then((response) => {
        if (!isCurrent) return;
        const items = (response.data.data?.items || []) as AdminMenuItem[];
        const availableItems = items.filter((item) => item.isAvailable);
        setMenuItems(availableItems);
        setActiveCategory(availableItems[0]?.categoryName || '');
      })
      .catch((err: any) => {
        if (!isCurrent) return;
        setError(err.response?.data?.error || 'Unable to load the store menu.');
      })
      .finally(() => {
        if (isCurrent) setLoadingMenu(false);
      });

    return () => { isCurrent = false; };
  }, [storeId]);

  const categories = useMemo(
    () => Array.from(new Set(menuItems.map((item) => item.categoryName))),
    [menuItems]
  );

  const itemsByCategory = useMemo(() => {
    const groups: Record<string, AdminMenuItem[]> = {};
    categories.forEach((cat) => {
      groups[cat] = menuItems.filter((item) => item.categoryName === cat);
    });
    return groups;
  }, [menuItems, categories]);

  // Track which section is visible via IntersectionObserver
  useEffect(() => {
    if (loadingMenu || categories.length === 0) return;

    const observers: IntersectionObserver[] = [];

    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      if (isScrolling.current) return;
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setActiveCategory(entry.target.getAttribute('data-category') || '');
          break;
        }
      }
    };

    categories.forEach((cat) => {
      const el = sectionRefs.current[cat];
      if (!el) return;
      const observer = new IntersectionObserver(handleIntersect, {
        rootMargin: `-${ADMIN_SCROLL_OFFSET}px 0px -60% 0px`,
        threshold: 0,
      });
      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [loadingMenu, categories]);

  const scrollToCategory = useCallback((category: string) => {
    const el = sectionRefs.current[category];
    if (!el) return;
    setActiveCategory(category);
    isScrolling.current = true;
    const top = el.getBoundingClientRect().top + window.scrollY - ADMIN_SCROLL_OFFSET;
    window.scrollTo({ top, behavior: 'smooth' });
    setTimeout(() => { isScrolling.current = false; }, 600);
  }, []);

  const totals = useMemo(() => {
    return cart.reduce((result, item) => {
      const lineTotal = item.price * item.quantity;
      const baseTotal = lineTotal / (1 + item.gstRate / 100);
      const tax = lineTotal - baseTotal;
      return {
        subtotal: result.subtotal + baseTotal,
        cgst: result.cgst + tax / 2,
        sgst: result.sgst + tax / 2,
        total: result.total + lineTotal,
      };
    }, { subtotal: 0, cgst: 0, sgst: 0, total: 0 });
  }, [cart]);

  const itemCount = cart.reduce((count, item) => count + item.quantity, 0);
  const canSubmit = phone.length === 10 && cart.length > 0 && !submitting;

  const getCartQuantity = (itemId: string) => cart.find((item) => item.id === itemId)?.quantity || 0;

  const updateQuantity = (item: AdminMenuItem, nextQuantity: number) => {
    if (nextQuantity < 1) {
      setCart((current) => current.filter((line) => line.id !== item.id));
      return;
    }
    if (nextQuantity > item.stock) return;

    setCart((current) => {
      const existing = current.find((line) => line.id === item.id);
      if (existing) {
        return current.map((line) => line.id === item.id ? { ...line, quantity: nextQuantity } : line);
      }
      return [...current, { ...item, quantity: nextQuantity }];
    });
  };

  const handlePlaceOrder = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError('');
    setCreatedOrder(null);

    try {
      const response = await api.post('/admin/orders/instore', {
        storeId,
        customerPhone: formatPhone(phone),
        customerName: name.trim() || undefined,
        customerMessage: message.trim() || undefined,
        items: cart.map((item) => ({ id: item.id, quantity: item.quantity })),
      });
      const order = response.data.data as CreatedInstoreOrder;

      setCreatedOrder(order);
      useAdminCacheStore.getState().invalidateOrders();
      useAdminCacheStore.getState().invalidateMenu();
      useAdminCacheStore.getState().invalidateBestsellers();
      setMenuItems((currentItems) => currentItems.map((item) => {
        const orderedItem = cart.find((cartItem) => cartItem.id === item.id);
        return orderedItem ? { ...item, stock: Math.max(0, item.stock - orderedItem.quantity) } : item;
      }));
      setCart([]);
      setPhone('');
      setName('');
      setMessage('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to place the instore order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-gray-800 bg-gray-900/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-500/10 text-green-400">
            <CircleDollarSign className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-white">New instore order</h2>
            <p className="mt-0.5 text-xs text-gray-400">Creates a paid instore order immediately — no online payment checkout.</p>
          </div>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-semibold text-green-400 ring-1 ring-inset ring-green-500/20">
          <CheckCircle2 className="h-3.5 w-3.5" /> Paid instore
        </span>
      </div>

      {createdOrder && (
        <div className="flex flex-col gap-3 rounded-xl border border-green-500/30 bg-green-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />
            <div>
              <p className="text-sm font-semibold text-green-300">Instore order {createdOrder.orderNo} placed</p>
              <p className="mt-0.5 text-xs text-green-200/80">
                {formatPrice(createdOrder.total)} has been recorded as paid instore.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onViewOrders}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-green-500 px-3 py-2 text-xs font-semibold text-black transition hover:bg-green-400"
          >
            View orders <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-800 bg-red-900/30 p-3 text-xs text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handlePlaceOrder} className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="min-w-0 rounded-xl border border-gray-800 bg-gray-900/60">
          <div className="border-b border-gray-800 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Package className="h-4 w-4 text-brand-400" /> Select items
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => scrollToCategory(category)}
                  className={cn(
                    'whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition',
                    activeCategory === category
                      ? 'bg-brand-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                  )}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {loadingMenu ? (
            <div className="flex justify-center py-16">
              <LoaderCircle className="h-7 w-7 animate-spin text-brand-400" />
            </div>
          ) : categories.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">No available items.</div>
          ) : (
            <div className="p-4 space-y-8">
              {categories.map((category) => (
                <section
                  key={category}
                  data-category={category}
                  ref={(el) => { sectionRefs.current[category] = el; }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-white">{category}</h3>
                    <span className="text-[11px] text-gray-500">{itemsByCategory[category]?.length || 0} items</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(itemsByCategory[category] || []).map((item) => {
                      const quantity = getCartQuantity(item.id);
                      const canAdd = quantity < item.stock;
                      return (
                        <article key={item.id} className={cn('rounded-lg border border-gray-800 bg-black/30 p-3', item.stock === 0 && 'opacity-60')}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-semibold text-white">{item.name}</h3>
                              {item.description && <p className="mt-1 line-clamp-2 text-xs text-gray-500">{item.description}</p>}
                            </div>
                            <span className="shrink-0 text-sm font-bold text-white">{formatPrice(item.price)}</span>
                          </div>
                          <div className="mt-3 flex items-end justify-between gap-3">
                            <span className={cn('text-[11px]', item.stock > 0 ? 'text-gray-500' : 'text-red-400')}>
                              {item.stock > 0 ? `${item.stock} in stock` : 'Out of stock'}
                            </span>
                            {quantity > 0 ? (
                              <div className="flex items-center gap-2 rounded-lg bg-gray-800 p-1">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item, quantity - 1)}
                                  className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-700 text-gray-100 hover:bg-gray-600"
                                  aria-label={`Remove one ${item.name}`}
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </button>
                                <span className="w-4 text-center text-sm font-semibold text-white">{quantity}</span>
                                <button
                                  type="button"
                                  disabled={!canAdd}
                                  onClick={() => updateQuantity(item, quantity + 1)}
                                  className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                                  aria-label={`Add one ${item.name}`}
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={!canAdd}
                                onClick={() => updateQuantity(item, 1)}
                                className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-500"
                              >
                                <Plus className="h-3.5 w-3.5" /> Add
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>

        <aside className="h-fit rounded-xl border border-gray-800 bg-gray-900/60 xl:sticky xl:top-6">
          <div className="border-b border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                <ShoppingBag className="h-4 w-4 text-brand-400" /> Order summary
              </h2>
              <span className="text-xs text-gray-500">{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
            </div>
          </div>

          <div className="max-h-64 space-y-3 overflow-y-auto p-4">
            {cart.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500">Add items to start an order.</p>
            ) : cart.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-200">{item.name}</p>
                  <p className="text-xs text-gray-500">{formatPrice(item.price)} × {item.quantity}</p>
                </div>
                <p className="text-sm font-semibold text-white">{formatPrice(item.price * item.quantity)}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2 border-y border-gray-800 bg-black/20 p-4 text-xs">
            <div className="flex justify-between text-gray-400"><span>Subtotal (excl. tax)</span><span>{formatPrice(totals.subtotal)}</span></div>
            <div className="flex justify-between text-gray-400"><span>CGST</span><span>{formatPrice(totals.cgst)}</span></div>
            <div className="flex justify-between text-gray-400"><span>SGST</span><span>{formatPrice(totals.sgst)}</span></div>
            <div className="flex justify-between border-t border-gray-800 pt-2 text-sm font-bold text-white"><span>Total</span><span>{formatPrice(totals.total)}</span></div>
          </div>

          <div className="space-y-3 p-4">
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-300"><UserRound className="h-3.5 w-3.5" /> Customer mobile number *</span>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                placeholder="10 digit mobile number"
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-300">Customer name <span className="text-gray-600">(optional)</span></span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value.slice(0, 100))}
                placeholder="Walk-in customer"
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-300">Preparation note <span className="text-gray-600">(optional)</span></span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value.slice(0, 500))}
                placeholder="Less spicy, no onions, etc."
                rows={2}
                className="w-full resize-none rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </label>

            <div className="flex items-start gap-2 rounded-lg bg-green-500/10 p-2.5 text-xs text-green-300">
              <ReceiptText className="mt-0.5 h-4 w-4 shrink-0" />
              This order is saved as <strong className="font-semibold">PAID · INSTORE</strong>. No payment gateway is opened.
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-3 text-sm font-bold text-black transition hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-500"
            >
              {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CircleDollarSign className="h-4 w-4" />}
              {submitting ? 'Placing order…' : `Place instore order · ${formatPrice(totals.total)}`}
            </button>
          </div>
        </aside>
      </form>
    </div>
  );
}
