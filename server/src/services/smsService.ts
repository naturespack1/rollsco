import axios from 'axios';
import { env } from '../config';

export async function sendOrderSms(phone: string, orderNo: string, storeName: string, total: number) {
  if (!env.MSG91_AUTHKEY) {
    console.log('SMS skipped: MSG91_AUTHKEY not configured');
    return;
  }
  try {
    const formattedPhone = phone.replace(/[^0-9]/g, '');
    await axios.post(
      'https://control.msg91.com/api/v5/flow/',
      {
        template_id: env.MSG91_TEMPLATE_ID,
        sender: env.MSG91_SENDERID,
        short_url: '0',
        recipients: [
          {
            mobiles: `91${formattedPhone}`,
            VAR1: orderNo,
            VAR2: storeName,
            VAR3: `₹${total.toFixed(2)}`,
          },
        ],
      },
      {
        headers: {
          authkey: env.MSG91_AUTHKEY,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (err: any) {
    console.error('SMS send failed:', err?.response?.data || err.message);
  }
}
