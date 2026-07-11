import ExcelJS from 'exceljs';
import { prisma } from '../prismaClient';

export async function generateDailySalesExcel(storeId: string, date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: {
      storeId,
      paymentStatus: 'PAID',
      createdAt: { gte: start, lt: end },
    },
    include: { items: true },
  });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sales');

  worksheet.columns = [
    { header: 'Order No', key: 'orderNo', width: 15 },
    { header: 'Time', key: 'time', width: 20 },
    { header: 'Item Name', key: 'itemName', width: 25 },
    { header: 'Qty', key: 'quantity', width: 8 },
    { header: 'Unit Price (incl. GST)', key: 'unitPrice', width: 15 },
    { header: 'Total (incl. GST)', key: 'totalPrice', width: 15 },
    { header: 'Base Price (excl. GST)', key: 'basePrice', width: 18 },
    { header: 'Base Total (excl. GST)', key: 'baseTotal', width: 18 },
    { header: 'CGST', key: 'cgst', width: 10 },
    { header: 'SGST', key: 'sgst', width: 10 },
    { header: 'Grand Total', key: 'grandTotal', width: 12 },
    { header: 'Payment', key: 'payment', width: 10 },
  ];

  for (const order of orders) {
    for (const item of order.items) {
      worksheet.addRow({
        orderNo: order.orderNo,
        time: order.createdAt.toISOString(),
        itemName: item.itemName,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toNumber(),
        totalPrice: item.totalPrice.toNumber(),
        basePrice: item.basePrice.toNumber(),
        baseTotal: item.baseTotal.toNumber(),
        cgst: order.cgstAmount.toNumber(),
        sgst: order.sgstAmount.toNumber(),
        grandTotal: order.total.toNumber(),
        payment: 'PAID',
      });
    }
  }

  // Add summary row
  worksheet.addRow({});
  worksheet.addRow({ itemName: 'TOTAL', grandTotal: orders.reduce((sum, o) => sum + o.total.toNumber(), 0) });

  return await workbook.xlsx.writeBuffer();
}
