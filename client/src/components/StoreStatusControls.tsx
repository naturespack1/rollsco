import { useState } from 'react';
import { AlertCircle, LoaderCircle, PauseCircle, PlayCircle, Power, Store as StoreIcon } from 'lucide-react';
import { api } from '@/lib/api';
import type { Store } from '@/types';

interface StoreStatusControlsProps {
  store: Store;
  onStoreUpdated: (store: Store) => void;
}

type PendingAction = 'store' | 'orders' | null;

export default function StoreStatusControls({ store, onStoreUpdated }: StoreStatusControlsProps) {
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [error, setError] = useState('');

  const updateStatus = async (updates: Pick<Store, 'isOpen'> | Pick<Store, 'acceptingOrders'>, action: Exclude<PendingAction, null>) => {
    setPendingAction(action);
    setError('');

    try {
      const response = await api.patch(`/admin/stores/${store.id}/status`, updates);
      onStoreUpdated(response.data.data as Store);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to update the store status. Please try again.');
    } finally {
      setPendingAction(null);
    }
  };

  const isAvailableToCustomers = store.isOpen && store.acceptingOrders;

  return (
    <section className="mb-6 rounded-xl border border-gray-800 bg-gray-900/60 overflow-hidden shadow-sm">
      <div className="flex flex-col gap-3 border-b border-gray-800 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-900/40 text-brand-400">
            <StoreIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Store controls</p>
            <h1 className="font-semibold text-white">{store.name}</h1>
          </div>
        </div>
        <span
          className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
            isAvailableToCustomers
              ? 'bg-green-500/10 text-green-400 ring-1 ring-inset ring-green-500/20'
              : 'bg-red-500/10 text-red-400 ring-1 ring-inset ring-red-500/20'
          }`}
        >
          {isAvailableToCustomers ? 'Live for orders' : 'Not available for orders'}
        </span>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-800 bg-black/30 p-3">
          <div className="mb-3">
            <p className="text-sm font-medium text-white">Store status</p>
            <p className="mt-0.5 text-xs text-gray-500">
              {store.isOpen ? 'The store is currently open.' : 'The store is currently closed.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => updateStatus({ isOpen: !store.isOpen }, 'store')}
            disabled={pendingAction !== null}
            className={`flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
              store.isOpen
                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
            }`}
          >
            {pendingAction === 'store' ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Power className="h-4 w-4" />
            )}
            {store.isOpen ? 'Close Store' : 'Open Store'}
          </button>
        </div>

        <div className="rounded-lg border border-gray-800 bg-black/30 p-3">
          <div className="mb-3">
            <p className="text-sm font-medium text-white">Online orders</p>
            <p className="mt-0.5 text-xs text-gray-500">
              {store.acceptingOrders ? 'Customers can place orders.' : 'New customer orders are paused.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => updateStatus({ acceptingOrders: !store.acceptingOrders }, 'orders')}
            disabled={pendingAction !== null}
            className={`flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
              store.acceptingOrders
                ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
            }`}
          >
            {pendingAction === 'orders' ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : store.acceptingOrders ? (
              <PauseCircle className="h-4 w-4" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}
            {store.acceptingOrders ? 'Pause Orders' : 'Accept Orders'}
          </button>
        </div>
      </div>

      {!store.isOpen && store.acceptingOrders && (
        <div className="mx-4 mb-4 flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          Orders are enabled, but customers cannot order until the store is opened.
        </div>
      )}

      {error && (
        <div className="mx-4 mb-4 flex items-start gap-2 rounded-lg bg-red-500/10 p-3 text-xs text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </section>
  );
}
