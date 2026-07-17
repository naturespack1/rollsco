import { Printer } from 'lucide-react';
import type { Order } from '@/types';
import { openChefBillPrint, openCustomerBillPrint, openMultipleChefBillPrint } from '@/lib/thermalPrint';

interface BillPrintProps {
  order: Order;
  storeName: string;
  storeAddress: string;
}

export default function BillPrint({ order, storeName, storeAddress }: BillPrintProps) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => openChefBillPrint(order, storeName, storeAddress)}
        className="p-1.5 rounded-lg bg-black text-white hover:bg-gray-800 transition"
        title="Print Chef Bill (Kitchen Copy) - Auto on new orders"
      >
        <Printer className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => openCustomerBillPrint(order, storeName, storeAddress)}
        className="p-1.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition"
        title="Print Customer Bill"
      >
        <Printer className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// Re-export for convenience
export { openChefBillPrint, openCustomerBillPrint, openMultipleChefBillPrint };
