import { Printer } from 'lucide-react';
import type { Order } from '@/types';

interface BillPrintProps {
  order: Order;
  storeName: string;
  storeAddress: string;
}

export default function BillPrint({ order, storeName, storeAddress }: BillPrintProps) {
  const handlePrint = (type: 'chef' | 'customer') => {
    const isChef = type === 'chef';
    const items = order.items || [];
    const totalNum = typeof order.total === 'string' ? parseFloat(order.total) : (order.total || 0);
    const cgstNum = typeof order.cgstAmount === 'string' ? parseFloat(order.cgstAmount) : (order.cgstAmount || 0);
    const sgstNum = typeof order.sgstAmount === 'string' ? parseFloat(order.sgstAmount) : (order.sgstAmount || 0);
    const subtotal = totalNum - cgstNum - sgstNum;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print bills');
      return;
    }

    // 80mm thermal paper = ~302px at 96dpi. Use 302px fixed width for reliable alignment.
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isChef ? 'Chef' : 'Customer'} Bill - ${order.orderNo}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      width: 302px;
      font-family: 'Courier New', 'Courier', monospace;
      font-size: 13px;
      line-height: 1.4;
      color: #000;
      background: #fff;
      margin: 0 auto;
      padding: 4px 8px;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .large { font-size: 16px; }
    .xlarge { font-size: 22px; }
    .small { font-size: 11px; }
    .tiny { font-size: 10px; }
    .border-dashed {
      border-top: 1px dashed #000;
      margin: 6px 0;
    }
    .border-double {
      border-top: 2px solid #000;
      margin: 6px 0;
    }
    .flex {
      display: flex;
      justify-content: space-between;
    }
    .mt { margin-top: 6px; }
    .mb { margin-bottom: 6px; }
    .red { color: #c00; }
    .chef-mark {
      background: #000;
      color: #fff;
      padding: 2px 8px;
      font-weight: bold;
      font-size: 13px;
      display: inline-block;
    }
    .item-row {
      display: flex;
      justify-content: space-between;
      margin: 1px 0;
    }
    .item-name {
      flex: 1;
      padding-right: 4px;
      word-break: break-word;
    }
    .item-qty {
      width: 28px;
      text-align: right;
      font-weight: bold;
    }
    .item-price {
      width: 56px;
      text-align: right;
    }
    .note-box {
      border: 1px dashed #c00;
      padding: 4px;
      margin: 6px 0;
    }
    .gst-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
    }
    .footer {
      text-align: center;
      margin-top: 8px;
      font-size: 11px;
    }
    .store-name {
      font-size: 18px;
      font-weight: bold;
      letter-spacing: 1px;
    }
    @media print {
      body {
        width: 100%;
        padding: 0;
        margin: 0;
      }
    }
  </style>
</head>
<body>
${isChef ? `
<div class="center mb">
  <span class="chef-mark">CHEF COPY</span>
</div>
` : `
<div class="center mb">
  <div class="store-name">ROLLS & CO.</div>
  <div class="small bold">${escapeHtml(storeName)}</div>
  <div class="tiny">${escapeHtml(storeAddress)}</div>
  <div class="tiny">GST INVOICE</div>
</div>
`}

<div class="border-dashed"></div>

<div class="flex">
  <span>Order No</span>
  <span class="bold xlarge">${order.orderNo}</span>
</div>

<div class="mt tiny">${new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</div>
${order.customerPhone ? `<div class="tiny">Ph: ${order.customerPhone}</div>` : ''}
${order.customerName ? `<div class="tiny">Name: ${escapeHtml(order.customerName)}</div>` : ''}
${!isChef ? `<div class="tiny">Payment: ${order.paymentMethod === 'INSTORE' ? 'Instore (Paid)' : 'Online'}</div>` : ''}

<div class="border-dashed"></div>

${items.map(item => {
  const qty = item.quantity;
  const name = escapeHtml(item.itemName);
  const unitPrice = typeof item.unitPrice === 'string' ? parseFloat(item.unitPrice) : (item.unitPrice || 0);
  const lineTotal = typeof item.totalPrice === 'string' ? parseFloat(item.totalPrice) : (item.totalPrice || 0);
  return !isChef
    ? `<div class="item-row"><span class="item-name">${name}</span><span class="item-qty">x${qty}</span><span class="item-price">${unitPrice.toFixed(2)}</span></div>`
    : `<div class="item-row"><span class="item-name">${name}</span><span class="item-qty">x${qty}</span></div>`;
}).join('')}

<div class="border-dashed"></div>

${isChef && order.customerMessage ? `
<div class="note-box">
  <div class="bold red">PREPARATION NOTE:</div>
  <div class="bold">${escapeHtml(order.customerMessage)}</div>
</div>
` : ''}

${!isChef ? `
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
` : `
<div class="center mt">
  <div class="bold">--- PREPARE ASAP ---</div>
</div>
`}

</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();

    // Small delay to ensure DOM is rendered before print dialog
    setTimeout(() => {
      try {
        printWindow.print();
      } catch (e) {
        console.error('Print failed:', e);
      }
    }, 300);
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => handlePrint('chef')}
        className="p-1.5 rounded-lg bg-black text-white hover:bg-gray-800 transition"
        title="Print Chef Bill (Kitchen Copy)"
      >
        <Printer className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => handlePrint('customer')}
        className="p-1.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition"
        title="Print Customer Bill"
      >
        <Printer className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
