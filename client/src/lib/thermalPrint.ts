import type { Order } from '@/types';

function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function openChefBillPrint(order: Order, storeName: string, storeAddress: string) {
  const items = order.items || [];
  const printWindow = window.open('', '_blank', 'width=320,height=600');
  if (!printWindow) {
    alert('Please allow popups to enable auto thermal printing');
    return;
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Chef Copy - ${order.orderNo}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
    body{width:302px;font-family:'Courier New',monospace;font-size:13px;line-height:1.35;color:#000;background:#fff;margin:0 auto;padding:4px 8px}
    .center{text-align:center}.bold{font-weight:bold}.large{font-size:16px}.xlarge{font-size:22px}.small{font-size:11px}.tiny{font-size:10px}
    .border-dashed{border-top:1px dashed #000;margin:6px 0}.border-double{border-top:2px solid #000;margin:6px 0}
    .flex{display:flex;justify-content:space-between}.mt{margin-top:6px}.mb{margin-bottom:6px}
    .chef-mark{background:#000;color:#fff;padding:3px 10px;font-weight:bold;font-size:14px;display:inline-block;letter-spacing:1px}
    .item-row{display:flex;justify-content:space-between;margin:2px 0}
    .item-name{flex:1;padding-right:4px;word-break:break-word;font-size:13px;font-weight:bold}
    .item-qty{width:40px;text-align:right;font-weight:bold;font-size:14px}
    .note-box{border:2px dashed #000;padding:6px;margin:8px 0;background:#fff0001a}
    .store-name{font-size:12px;font-weight:bold}
    @media print{body{width:100%;padding:0;margin:0}}
  </style>
</head>
<body>
<div class="center mb">
  <span class="chef-mark">CHEF COPY - KITCHEN</span>
  <div style="margin-top:6px" class="small bold">${escapeHtml(storeName)}</div>
  <div class="tiny">${escapeHtml(storeAddress)}</div>
</div>
<div class="border-dashed"></div>
<div class="flex"><span>Order No</span><span class="bold xlarge">${order.orderNo}</span></div>
<div class="mt tiny">${new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</div>
${order.customerPhone ? `<div class="tiny">Ph: ${order.customerPhone}</div>` : ''}
${order.customerName ? `<div class="tiny">Name: ${escapeHtml(order.customerName)}</div>` : ''}
${order.paymentMethod ? `<div class="tiny">Pay: ${order.paymentMethod === 'INSTORE' ? 'INSTORE' : 'ONLINE'} • ${order.paymentStatus}</div>` : ''}
<div class="border-dashed"></div>
${items.map(item => {
  const qty = item.quantity;
  const name = escapeHtml(item.itemName);
  return `<div class="item-row"><span class="item-name">${name}</span><span class="item-qty">x${qty}</span></div>`;
}).join('')}
<div class="border-dashed"></div>
${order.customerMessage ? `
<div class="note-box">
  <div class="bold" style="font-size:12px">⚠ PREP NOTE:</div>
  <div class="bold" style="font-size:13px;margin-top:2px">${escapeHtml(order.customerMessage)}</div>
</div>` : ''}
<div class="center mt"><div class="bold large">--- PREPARE ASAP ---</div><div class="tiny" style="margin-top:4px">5-10 mins • ${order.orderNo}</div></div>
<div class="border-dashed"></div>
<div class="center tiny">No Empty Bites. Only Loaded Rolls.</div>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    try {
      printWindow.print();
      // Auto-close after print dialog (works in many browsers)
      printWindow.onafterprint = () => printWindow.close();
      setTimeout(() => { try { printWindow.close(); } catch {} }, 1000);
    } catch (e) { console.error('Chef print failed', e); }
  }, 350);
}

export function openMultipleChefBillPrint(orders: Order[], storeName: string, storeAddress: string) {
  if (orders.length === 0) return;
  if (orders.length === 1) return openChefBillPrint(orders[0], storeName, storeAddress);

  const printWindow = window.open('', '_blank', 'width=320,height=600');
  if (!printWindow) {
    alert('Please allow popups to enable auto thermal printing - trying to print ' + orders.length + ' new orders');
    return;
  }

  const orderBlocks = orders.map((order, idx) => {
    const items = order.items || [];
    const isLast = idx === orders.length - 1;
    return `
<div class="order-block">
<div class="center mb">
  <span class="chef-mark">CHEF COPY - KITCHEN #${idx + 1}/${orders.length}</span>
  <div style="margin-top:6px" class="small bold">${escapeHtml(storeName)}</div>
  <div class="tiny">${escapeHtml(storeAddress)}</div>
</div>
<div class="border-dashed"></div>
<div class="flex"><span>Order No</span><span class="bold xlarge">${order.orderNo}</span></div>
<div class="mt tiny">${new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</div>
${order.customerPhone ? `<div class="tiny">Ph: ${order.customerPhone}</div>` : ''}
${order.customerName ? `<div class="tiny">Name: ${escapeHtml(order.customerName)}</div>` : ''}
${order.paymentMethod ? `<div class="tiny">Pay: ${order.paymentMethod === 'INSTORE' ? 'INSTORE' : 'ONLINE'} • ${order.paymentStatus}</div>` : ''}
<div class="border-dashed"></div>
${items.map((item: any) => {
  const qty = item.quantity;
  const name = escapeHtml(item.itemName);
  return `<div class="item-row"><span class="item-name">${name}</span><span class="item-qty">x${qty}</span></div>`;
}).join('')}
<div class="border-dashed"></div>
${order.customerMessage ? `
<div class="note-box">
  <div class="bold" style="font-size:12px">⚠ PREP NOTE:</div>
  <div class="bold" style="font-size:13px;margin-top:2px">${escapeHtml(order.customerMessage)}</div>
</div>` : ''}
<div class="center mt"><div class="bold large">--- PREPARE ASAP ---</div><div class="tiny" style="margin-top:4px">5-10 mins • ${order.orderNo}</div></div>
${!isLast ? `<div class="cut-line">✂ - - - CUT HERE - - - ✂</div>` : ''}
</div>
${!isLast ? `<div class="page-break"></div>` : ''}`;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Chef Copies - ${orders.length} Orders</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
    body{width:302px;font-family:'Courier New',monospace;font-size:13px;line-height:1.35;color:#000;background:#fff;margin:0 auto;padding:4px 8px}
    .center{text-align:center}.bold{font-weight:bold}.large{font-size:16px}.xlarge{font-size:22px}.small{font-size:11px}.tiny{font-size:10px}
    .border-dashed{border-top:1px dashed #000;margin:6px 0}
    .flex{display:flex;justify-content:space-between}.mt{margin-top:6px}.mb{margin-bottom:6px}
    .chef-mark{background:#000;color:#fff;padding:3px 10px;font-weight:bold;font-size:14px;display:inline-block;letter-spacing:1px}
    .item-row{display:flex;justify-content:space-between;margin:2px 0}
    .item-name{flex:1;padding-right:4px;word-break:break-word;font-size:13px;font-weight:bold}
    .item-qty{width:40px;text-align:right;font-weight:bold;font-size:14px}
    .note-box{border:2px dashed #000;padding:6px;margin:8px 0;background:#fff0001a}
    .cut-line{text-align:center;margin:12px 0;padding:8px 0;border-top:2px dashed #000;border-bottom:2px dashed #000;font-weight:bold;font-size:12px;letter-spacing:2px}
    .page-break{page-break-after:always;height:1px}
    @media print{
      body{width:100%;padding:0;margin:0}
      .page-break{page-break-after:always}
      .cut-line{break-after:page}
    }
  </style>
</head>
<body>
<div class="center mb" style="margin-bottom:10px">
  <div class="bold large">🧾 ${orders.length} NEW ORDER${orders.length>1?'S':''} - ${new Date().toLocaleTimeString('en-IN')}</div>
  <div class="tiny">Auto-printed • Thermal</div>
  <div class="border-dashed"></div>
</div>
${orderBlocks}
<div class="border-dashed" style="margin-top:12px"></div>
<div class="center tiny">Total ${orders.length} chef copies printed • No Empty Bites. Only Loaded Rolls.</div>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    try {
      printWindow.print();
      printWindow.onafterprint = () => printWindow.close();
      setTimeout(() => { try { printWindow.close(); } catch {} }, 1500);
    } catch (e) { console.error('Multi chef print failed', e); }
  }, 400);
}

export function openCustomerBillPrint(order: Order, storeName: string, storeAddress: string) {
  const items = order.items || [];
  const totalNum = typeof order.total === 'string' ? parseFloat(order.total) : (order.total || 0);
  const cgstNum = typeof order.cgstAmount === 'string' ? parseFloat(order.cgstAmount) : (order.cgstAmount || 0);
  const sgstNum = typeof order.sgstAmount === 'string' ? parseFloat(order.sgstAmount) : (order.sgstAmount || 0);
  const subtotal = totalNum - cgstNum - sgstNum;

  const printWindow = window.open('', '_blank', 'width=320,height=600');
  if (!printWindow) {
    alert('Please allow popups to enable auto thermal printing');
    return;
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Bill - ${order.orderNo}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
    body{width:302px;font-family:'Courier New',monospace;font-size:13px;line-height:1.4;color:#000;background:#fff;margin:0 auto;padding:4px 8px}
    .center{text-align:center}.bold{font-weight:bold}.large{font-size:16px}.xlarge{font-size:22px}.small{font-size:11px}.tiny{font-size:10px}
    .border-dashed{border-top:1px dashed #000;margin:6px 0}.border-double{border-top:2px solid #000;margin:6px 0}
    .flex{display:flex;justify-content:space-between}.mt{margin-top:6px}.mb{margin-bottom:6px}
    .item-row{display:flex;justify-content:space-between;margin:1px 0}
    .item-name{flex:1;padding-right:4px;word-break:break-word}
    .item-qty{width:28px;text-align:right;font-weight:bold}
    .item-price{width:56px;text-align:right}
    .gst-row{display:flex;justify-content:space-between;font-size:11px}
    .footer{text-align:center;margin-top:8px;font-size:11px}
    .store-name{font-size:18px;font-weight:bold;letter-spacing:1px}
    @media print{body{width:100%;padding:0;margin:0}}
  </style>
</head>
<body>
<div class="center mb">
  <div class="store-name">ROLL'S & CO.</div>
  <div class="small bold">${escapeHtml(storeName)}</div>
  <div class="tiny">${escapeHtml(storeAddress)}</div>
  <div class="tiny">GST INVOICE - CUSTOMER COPY</div>
</div>
<div class="border-dashed"></div>
<div class="flex"><span>Order No</span><span class="bold xlarge">${order.orderNo}</span></div>
<div class="mt tiny">${new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</div>
${order.customerPhone ? `<div class="tiny">Ph: ${order.customerPhone}</div>` : ''}
${order.customerName ? `<div class="tiny">Name: ${escapeHtml(order.customerName)}</div>` : ''}
${order.paymentMethod ? `<div class="tiny">Payment: ${order.paymentMethod === 'INSTORE' ? 'Instore (Paid)' : 'Online'} - ${order.paymentStatus || 'PAID'}</div>` : ''}
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
<div class="border-dashed"></div>
<div class="center tiny">Estimated: 5-10 mins. Please collect at counter.</div>
<div class="footer"><div class="tiny">No Empty Bites. Only Loaded Rolls.</div><div class="tiny" style="margin-top:2px">Wrap. Bite. Repeat. - Thank you!</div></div>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    try {
      printWindow.print();
      printWindow.onafterprint = () => printWindow.close();
      setTimeout(() => { try { printWindow.close(); } catch {} }, 1000);
    } catch (e) { console.error('Customer print failed', e); }
  }, 350);
}

export function downloadBillHtml(order: Order, storeName: string, storeAddress: string) {
  const items = order.items || [];
  const totalNum = typeof order.total === 'string' ? parseFloat(order.total) : (order.total || 0);
  const cgstNum = typeof order.cgstAmount === 'string' ? parseFloat(order.cgstAmount) : (order.cgstAmount || 0);
  const sgstNum = typeof order.sgstAmount === 'string' ? parseFloat(order.sgstAmount) : (order.sgstAmount || 0);
  const subtotal = totalNum - cgstNum - sgstNum;

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Bill - ${order.orderNo}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{width:302px;font-family:'Courier New',monospace;font-size:13px;line-height:1.4;color:#000;background:#fff;margin:20px auto;padding:4px 8px;border:1px solid #ddd}
.center{text-align:center}.bold{font-weight:bold}.large{font-size:16px}.xlarge{font-size:22px}.small{font-size:11px}.tiny{font-size:10px}.border-dashed{border-top:1px dashed #000;margin:6px 0}.border-double{border-top:2px solid #000;margin:6px 0}.flex{display:flex;justify-content:space-between}.mt{margin-top:6px}.mb{margin-bottom:6px}.item-row{display:flex;justify-content:space-between;margin:1px 0}.item-name{flex:1;padding-right:4px;word-break:break-word}.item-qty{width:28px;text-align:right;font-weight:bold}.item-price{width:56px;text-align:right}.gst-row{display:flex;justify-content:space-between;font-size:11px}.footer{text-align:center;margin-top:8px;font-size:11px}.store-name{font-size:18px;font-weight:bold;letter-spacing:1px}</style></head>
<body><div class="center mb"><div class="store-name">ROLL'S & CO.</div><div class="small bold">${escapeHtml(storeName)}</div><div class="tiny">${escapeHtml(storeAddress)}</div><div class="tiny">GST INVOICE</div></div>
<div class="border-dashed"></div><div class="flex"><span>Order No</span><span class="bold xlarge">${order.orderNo}</span></div>
<div class="mt tiny">${new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</div>
${order.customerPhone ? `<div class="tiny">Ph: ${order.customerPhone}</div>` : ''}${order.customerName ? `<div class="tiny">Name: ${escapeHtml(order.customerName)}</div>` : ''}
<div class="border-dashed"></div>
${items.map(item => { const qty = item.quantity; const name = escapeHtml(item.itemName); const unitPrice = typeof item.unitPrice === 'string' ? parseFloat(item.unitPrice) : (item.unitPrice || 0); return `<div class="item-row"><span class="item-name">${name}</span><span class="item-qty">x${qty}</span><span class="item-price">${unitPrice.toFixed(2)}</span></div>`; }).join('')}
<div class="border-dashed"></div><div class="gst-row"><span>Subtotal (excl. tax)</span><span>${subtotal.toFixed(2)}</span></div><div class="gst-row"><span>CGST</span><span>${cgstNum.toFixed(2)}</span></div><div class="gst-row"><span>SGST</span><span>${sgstNum.toFixed(2)}</span></div><div class="border-double"></div><div class="flex bold large"><span>TOTAL (incl. GST)</span><span>${totalNum.toFixed(2)}</span></div><div class="footer"><div class="tiny">No Empty Bites. Only Loaded Rolls.</div><div class="tiny">Wrap. Bite. Repeat.</div></div></body></html>`;

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
