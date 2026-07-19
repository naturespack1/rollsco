import qz from 'qz-tray';
import type { Order } from '@/types';

const MODE_KEY = 'rolls-print-mode';
const PRINTER_KEY = 'rolls-qz-printer';
const LINE_WIDTH = 42; // 80-mm printer in the usual Font A mode

export function isQzPrintingEnabled() {
  return typeof window !== 'undefined' && localStorage.getItem(MODE_KEY) === 'qz-escpos';
}

export function getQzPrinterName() {
  return typeof window !== 'undefined' ? localStorage.getItem(PRINTER_KEY) || '' : '';
}

export function setQzPrinting(enabled: boolean, printerName: string) {
  localStorage.setItem(MODE_KEY, enabled ? 'qz-escpos' : 'browser');
  localStorage.setItem(PRINTER_KEY, printerName.trim());
}

export async function getQzPrinters(): Promise<string[]> {
  await ensureConnected();
  return qz.printers.find();
}

async function ensureConnected() {
  if (!qz.websocket.isActive()) await qz.websocket.connect();
}

function text(value: unknown) {
  return String(value ?? '').replace(/[\x00-\x1F\x7F-\x9F]/g, ' ').trim();
}

function divider(char = '-') { return char.repeat(LINE_WIDTH); }
function center(value: string) {
  const pad = Math.max(0, Math.floor((LINE_WIDTH - value.length) / 2));
  return ' '.repeat(pad) + value;
}
function wrap(value: string, width = LINE_WIDTH) {
  const words = text(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (!line) line = word;
    else if (line.length + word.length + 1 <= width) line += ` ${word}`;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}
function twoColumns(left: string, right: string) {
  const spaces = Math.max(1, LINE_WIDTH - left.length - right.length);
  return left + ' '.repeat(spaces) + right;
}
function money(value: unknown) { return Number(value || 0).toFixed(2); }

function chefReceipt(order: Order, storeName: string, storeAddress: string) {
  const lines: string[] = [center('CHEF COPY - KITCHEN'), center(text(storeName)), ...wrap(storeAddress).map(center), divider()];
  lines.push(twoColumns('Order No', text(order.orderNo)));
  lines.push(new Date(order.createdAt).toLocaleString('en-IN'));
  if (order.customerName) lines.push(`Name: ${text(order.customerName)}`);
  if (order.customerPhone) lines.push(`Ph: ${text(order.customerPhone)}`);
  lines.push(divider());
  for (const item of order.items || []) {
    const itemLines = wrap(text(item.itemName), LINE_WIDTH - 6);
    itemLines.forEach((line, index) => lines.push(`${line}${index === itemLines.length - 1 ? ` x${item.quantity}` : ''}`));
  }
  if (order.customerMessage) lines.push(divider(), 'PREP NOTE:', ...wrap(order.customerMessage));
  lines.push(divider(), center('--- PREPARE ASAP ---'), center(`5-10 mins • ${text(order.orderNo)}`), divider(), center('No Empty Bites. Only Loaded Rolls.'));
  return lines;
}

function customerReceipt(order: Order, storeName: string, storeAddress: string) {
  const total = Number(order.total || 0);
  const cgst = Number(order.cgstAmount || 0);
  const sgst = Number(order.sgstAmount || 0);
  const lines: string[] = [center("ROLL'S & CO."), center(text(storeName)), ...wrap(storeAddress).map(center), center('GST INVOICE - CUSTOMER COPY'), divider()];
  lines.push(twoColumns('Order No', text(order.orderNo)), new Date(order.createdAt).toLocaleString('en-IN'));
  if (order.customerName) lines.push(`Name: ${text(order.customerName)}`);
  if (order.customerPhone) lines.push(`Ph: ${text(order.customerPhone)}`);
  lines.push(divider());
  for (const item of order.items || []) {
    const label = `${text(item.itemName)} x${item.quantity}`;
    lines.push(twoColumns(label.slice(0, 32), money(item.unitPrice)));
    for (const continuation of wrap(label.slice(32), 32)) if (continuation) lines.push(continuation);
  }
  lines.push(divider(), twoColumns('Subtotal (excl. tax)', money(total - cgst - sgst)), twoColumns('CGST', money(cgst)), twoColumns('SGST', money(sgst)), divider('='), twoColumns('TOTAL (incl. GST)', money(total)), divider(), center('Estimated: 5-10 mins. Collect at counter.'), center('No Empty Bites. Only Loaded Rolls.'));
  return lines;
}

async function rawPrint(lines: string[]) {
  const printer = getQzPrinterName();
  if (!printer) throw new Error('Choose a QZ Tray printer before enabling ESC/POS printing.');
  await ensureConnected();
  // ESC @ initialize, ESC a 1 center header is handled as text spacing, GS V 0 is a full cut.
  const data = `\x1B\x40${lines.join('\n')}\n\n\n\x1D\x56\x00`;
  const config = qz.configs.create(printer, { encoding: 'UTF-8' });
  await qz.print(config, [{ type: 'raw', format: 'plain', data }]);
}

export async function printChefEscPos(order: Order, storeName: string, storeAddress: string) {
  await rawPrint(chefReceipt(order, storeName, storeAddress));
}
export async function printManyChefEscPos(orders: Order[], storeName: string, storeAddress: string) {
  // One raw job per order deliberately gives every order its own physical cut.
  for (const order of orders) await printChefEscPos(order, storeName, storeAddress);
}
export async function printCustomerEscPos(order: Order, storeName: string, storeAddress: string) {
  await rawPrint(customerReceipt(order, storeName, storeAddress));
}

export async function testEscPosCut() {
  await rawPrint([center("ROLL'S & CO."), center('ESC/POS TEST'), divider(), center('Paper should cut below.')]);
}
