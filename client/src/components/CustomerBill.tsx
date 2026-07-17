import { useEffect } from 'react';
import { Printer, Download } from 'lucide-react';
import type { Order } from '@/types';
import { openCustomerBillPrint, downloadBillHtml } from '@/lib/thermalPrint';

interface CustomerBillProps {
  order: Order;
  storeName: string;
  storeAddress: string;
  autoPrint?: boolean;
}

export { openCustomerBillPrint, downloadBillHtml };

export default function CustomerBill({ order, storeName, storeAddress, autoPrint = false }: CustomerBillProps) {
  const handlePrint = () => {
    openCustomerBillPrint(order, storeName, storeAddress);
  };

  const handleDownload = () => {
    downloadBillHtml(order, storeName, storeAddress);
  };

  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, order, storeName, storeAddress]);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Printer className="w-4 h-4 text-brand-600" />
        Your Bill
      </h3>
      <div className="text-xs text-gray-500 mb-3">
        A bill has been auto-printed. You can also download or print again below.
      </div>
      <div className="flex gap-2">
        <button
          onClick={handlePrint}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition"
        >
          <Printer className="w-4 h-4" />
          Print Bill
        </button>
        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition"
        >
          <Download className="w-4 h-4" />
          Download Bill
        </button>
      </div>
    </div>
  );
}
