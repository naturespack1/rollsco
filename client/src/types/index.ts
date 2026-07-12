export interface Store {
  id: string;
  name: string;
  address: string;
  isOpen: boolean;
  acceptingOrders: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  imageUrl?: string;
  isBestseller: boolean;
  gstRate: number;
  hsnCode?: string;
  category: string;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
  imageUrl?: string;
  gstRate: number;
}

export interface OrderItem {
  itemName: string;
  quantity: number;
  unitPrice: number;    // GST-inclusive price per unit (menu price at order time)
  totalPrice: number;   // GST-inclusive total = unitPrice × quantity
  basePrice?: number;  // Base price per unit (excl. tax, for records)
  baseTotal?: number;  // Base total = basePrice × quantity
  gstRate?: number;    // GST rate % at order time
}

export interface Order {
  id: string;
  orderNo: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: 'ONLINE' | 'INSTORE';
  total: number;
  customerPhone: string;
  customerName?: string;
  customerMessage?: string;
  createdAt: string;
  items: OrderItem[];
  store: { name: string; address: string };
  cgstAmount?: number;
  sgstAmount?: number;
  subtotal?: number;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'MANAGER';
  storeIds: string[];
}

export interface AdminState {
  token: string | null;
  admin: AdminUser | null;
  setAuth: (token: string, admin: AdminUser) => void;
  logout: () => void;
}
