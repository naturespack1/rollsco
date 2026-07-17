import { useEffect } from 'react';
import { Printer, Download } from 'lucide-react';
import type { Order } from '@/types';

interface CustomerBillProps {
  order: Order;
  storeName: string;
  storeAddress: string;
  autoPrint?: boolean;
}

export function openCustomerBillPrint(order: Order, storeName: string, storeAddress: string) {
  const items = order.items || [];
  const totalNum = typeof order.total === 'string' ? parseFloat(order.total) : (order.total || 0);
  const cgstNum = typeof order.cgstAmount === 'string' ? parseFloat(order.cgstAmount) : (order.cgstAmount || 0);
  const sgstNum = typeof order.sgstAmount === 'string' ? parseFloat(order.sgstAmount) : (order.sgstAmount || 0);
  const subtotal = totalNum - cgstNum - sgstNum;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print your bill');
    return;
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Bill - ${order.orderNo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { width: 302px; font-family: 'Courier New', 'Courier', monospace; font-size: 13px; line-height: 1.4; color: #000; background: #fff; margin: 0 auto; padding: 4px 8px; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .large { font-size: 16px; }
    .xlarge { font-size: 22px; }
    .small { font-size: 11px; }
    .tiny { font-size: 10px; }
    .border-dashed { border-top: 1px dashed #000; margin: 6px 0; }
    .border-double { border-top: 2px solid #000; margin: 6px 0; }
    .flex { display: flex; justify-content: space-between; }
    .mt { margin-top: 6px; }
    .mb { margin-bottom: 6px; }
    .item-row { display: flex; justify-content: space-between; margin: 1px 0; }
    .item-name { flex: 1; padding-right: 4px; word-break: break-word; }
    .item-qty { width: 28px; text-align: right; font-weight: bold; }
    .item-price { width: 56px; text-align: right; }
    .gst-row { display: flex; justify-content: space-between; font-size: 11px; }
    .footer { text-align: center; margin-top: 8px; font-size: 11px; }
    .store-name { font-size: 18px; font-weight: bold; letter-spacing: 1px; }
    @media print { body { width: 100%; padding: 0; margin: 0; } }
  </style>
</head>
<body>
<div class="center mb">
  <div class="store-name">ROLLS & CO.</div>
  <div class="small bold">${escapeHtml(storeName)}</div>
  <div class="tiny">${escapeHtml(storeAddress)}</div>
  <div class="tiny">GST INVOICE</div>
</div>

<div class="border-dashed"></div>

<div class="flex">
  <span>Order No</span>
  <span class="bold xlarge">${order.orderNo}</span>
</div>

<div class="mt tiny">${new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</div>
${order.customerPhone ? `<div class="tiny">Ph: ${order.customerPhone}</div>` : ''}
${order.customerName ? `<div class="tiny">Name: ${escapeHtml(order.customerName)}</div>` : ''}

<div class="border-dashed"></div>

${items.map(item => {
  const qty = item.quantity;
  const name = escapeHtml(item.itemName);
  const unitPrice = typeof item.unitPrice === 'string' ? parseFloat(item.unitPrice) : (item.unitPrice || 0);
  return `<div class="item-row"><span class="item-name">${name}</span><span class="item-qty">x${qty}</span><span class="item-price">${unitPrice.toFixed(2)}</span></div>`;
}).join('')}

<div class="border-dashed"></div>

<div class="gst-row">
  <span>Subtotal (excl. tax)</span>
  <span>${subtotal.toFixed(2)}</span>
</div>
<div class="gst-row">
  <span>CGST</span>
  <span>${cgstNum.toFixed(2)}</span>
</div>
<div class="gst-row">
  <span>SGST</span>
  <span>${sgstNum.toFixed(2)}</span>
</div>
<div class="border-double"></div>
<div class="flex bold large">
  <span>TOTAL (incl. GST)</span>
  <span>${totalNum.toFixed(2)}</span>
</div>
<div class="footer">
  <div class="tiny">Thank you! Visit again.</div>
</div>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();

  setTimeout(() => {
    try { printWindow.print(); } catch (e) { console.error('Auto print failed:', e); }
  }, 300);
}

export function downloadBillHtml(order: Order, storeName: string, storeAddress: string) {
  const items = order.items || [];
  const totalNum = typeof order.total === 'string' ? parseFloat(order.total) : (order.total || 0);
  const cgstNum = typeof order.cgstAmount === 'string' ? parseFloat(order.cgstAmount) : (order.cgstAmount || 0);
  const sgstNum = typeof order.sgstAmount === 'string' ? parseFloat(order.sgstAmount) : (order.sgstAmount || 0);
  const subtotal = totalNum - cgstNum - sgstNum;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Bill - ${order.orderNo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 302px; font-family: 'Courier New', monospace; font-size: 13px; line-height: 1.4; color: #000; background: #fff; margin: 20px auto; padding: 4px 8px; border: 1px solid #ddd; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .large { font-size: 16px; }
    .xlarge { font-size: 22px; }
    .small { font-size: 11px; }
    .tiny { font-size: 10px; }
    .border-dashed { border-top: 1px dashed #000; margin: 6px 0; }
    .border-double { border-top: 2px solid #000; margin: 6px 0; }
    .flex { display: flex; justify-content: space-between; }
    .mt { margin-top: 6px; }
    .mb { margin-bottom: 6px; }
    .item-row { display: flex; justify-content: space-between; margin: 1px 0; }
    .item-name { flex: 1; padding-right: 4px; word-break: break-word; }
    .item-qty { width: 28px; text-align: right; font-weight: bold; }
    .item-price { width: 56px; text-align: right; }
    .gst-row { display: flex; justify-content: space-between; font-size: 11px; }
    .footer { text-align: center; margin-top: 8px; font-size: 11px; }
    .store-name { font-size: 18px; font-weight: bold; letter-spacing: 1px; }
  </style>
</head>
<body>
<div class="center mb">
  <div class="store-name">ROLLS & CO.</div>
  <div class="small bold">${escapeHtml(storeName)}</div>
  <div class="tiny">${escapeHtml(storeAddress)}</div>
  <div class="tiny">GST INVOICE</div>
</div>
<div class="border-dashed"></div>
<div class="flex"><span>Order No</span><span class="bold xlarge">${order.orderNo}</span></div>
<div class="mt tiny">${new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</div>
${order.customerPhone ? `<div class="tiny">Ph: ${order.customerPhone}</div>` : ''}
${order.customerName ? `<div class="tiny">Name: ${escapeHtml(order.customerName)}</div>` : ''}
<div class="border-dashed"></div>
${items.map(item => {
  const qty = item.quantity;
  const name = escapeHtml(item.itemName);
  const unitPrice = typeof item.unitPrice === 'string' ? parseFloat(item.unitPrice) : (item.unitPrice || 0);
  return `<div class="item-row"><span class="item-name">${name}</span><span class="item-qty">x${qty}</span><span class="item-price">${unitPrice.toFixed(2)}</span></div>`;
}).join('')}
<div class="border-dashed"></div>
<div class="gst-row"><span>Subtotal (excl. tax)</span><span>${subtotal.toFixed(2)}</span></div>
<div class="gst-row"><span>CGST</span><span>${cgstNum.toFixed(2)}</span></div>
<div class="gst-row"><span>SGST</span><span>${sgstNum.toFixed(2)}</span></div>
<div class="border-double"></div>
<div class="flex bold large"><span>TOTAL (incl. GST)</span><span>${totalNum.toFixed(2)}</span></div>
<div class="footer"><div class="tiny">Thank you! Visit again.</div></div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bill-${order.orderNo}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default function CustomerBill({ order, storeName, storeAddress, autoPrint = false }: CustomerBillProps) {
  const handlePrint = () => {
    openCustomerBillPrint(order, storeName, storeAddress);
  };

  const handleDownload = () => {
    downloadBillHtml(order, storeName, storeAddress);
  };

  // Auto-print on mount if enabled
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
