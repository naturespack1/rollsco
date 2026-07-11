import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number | string | null | undefined) {
  const num = typeof amount === 'string' ? parseFloat(amount) : typeof amount === 'number' ? amount : 0;
  if (isNaN(num)) return '₹0.00';
  return `₹${num.toFixed(2)}`;
}

export function formatPhone(phone: string) {
  return phone.replace(/[^0-9]/g, '').slice(-10);
}
