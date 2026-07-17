# Roll's & Co. — Full Context for AI Agents

> **Project**: Roll's & Co. Restaurant Ordering System  
> **Type**: Full-stack monorepo (React SPA + Fastify API + PostgreSQL)  
> **Architecture**: Single-page application (SPA) with lazy-loaded admin dashboard  
> **Business**: Pickup-only restaurant ordering with Razorpay payments, GST invoicing, SMS receipts, and multi-store admin dashboard.

---

## 1. Business Requirements (Non-Negotiable)

### Customer Flow
1. Landing page shows hero images + taglines + store selector.
2. **Menu appears only after store selection**. Changing store clears the cart.
3. Categories: Roll, Burgers, Beverages, Extras, Combos.
4. User navigates categories in parallel and adds items to cart.
5. **Cart is client-side persistent** (localStorage) scoped to `cart:<storeId>`.
6. **Checkout**: collects phone (required), name (optional), preparation note (optional). No address needed (pickup only).
7. Payment via Razorpay (UPI/Card). **Prices are computed server-side only**. Client sends only `itemId + quantity`. Any tampering fails because Razorpay order amount is recalculated on the server.
8. On success: navigates to `/` (store selector), clears selected store, order saved to customer cache (1 day), bill auto-downloaded as HTML, green success banner shown with order number and "Download Bill" button. SMS sent via MSG91.
9. On payment failure/dismiss: user sees message "Payment was not completed. If money was deducted, it will be refunded within 5-7 business days." Stock is restored.
10. **Orders cannot be cancelled** by customer after placement.

### Admin Flow
1. Login at `/admin/login` with email/password. JWT token (7-day expiry).
2. Multi-admin with role-based access: `SUPER_ADMIN` sees all stores; `MANAGER` sees only assigned stores via `AdminStore` junction table.
3. Dashboard tabs: **Orders**, **Stock**, **Menu**, **Reports**, **Staff** (Super Admin only).
4. **Orders**: view active orders, filter by status, change status (CREATED → PROCESSING → DELIVERED). **No instant server push** — changes are buffered locally and pushed via a **Sync** button or **auto-sync interval** (1/3/5 min options). After push, server returns new/updated orders since `lastSync`.
5. **Stock**: edit quantity per item. Admin can set `stock = 0` to mark out-of-stock.
6. **Menu**: add/edit/delete items (Super Admin). Toggle availability. Items are scoped to store and category. **Combos are just items in the "Combos" category** — no special combo table or component logic.
7. **Reports**: daily sales Excel export (`.xlsx`) with order-level CGST/SGST/Grand Total breakdown. Bestseller ranking (top 10 items by quantity sold) with date range: Today / Last 7 Days / Last 30 Days / All Time.
8. **Staff**: Super Admin can create/remove other admins with role (Super Admin / Manager) and assign stores.

### Security & Reliability
- **Price tampering protection**: Client never sends `price` or `total`. Server fetches live DB prices, calculates GST (CGST + SGST), and creates Razorpay order for exact server-computed amount.
- **Duplicate payment protection**: `razorpayOrderId` is unique. Webhook handler checks `if (paymentStatus === 'PAID') return 200;` immediately — safe for duplicates.
- **Stock race condition protection**: Prisma transaction with `Serializable` isolation. Stock is decremented **before** Razorpay order is created. If Razorpay fails, stock is restored via compensating `failOrder()`.
- **Cart persistence**: `localStorage` key `quickbite-cart`. Scoped to store. Cleared on successful payment or store change.
- **Order auto-expiry**: Pending orders older than 15 minutes should be auto-cancelled and stock restored (cron job / background worker — implemented as `expireOldPendingOrders()` in service layer, needs scheduled trigger).
- **Webhook reliability**: Razorpay webhook handler returns `200` even on errors to avoid infinite retries, but logs errors. Client-side `/verify` endpoint serves as fallback for localhost.
- **Store closed protection**: Orders rejected if `store.isOpen === false` or `store.acceptingOrders === false`.

---

## 2. Technology Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| State | Zustand (with `persist` middleware for cart & store selection) |
| Routing | React Router DOM v6 |
| Icons | Lucide React |
| Backend | Fastify 4 + TypeScript + tsx (dev runtime) |
| ORM | Prisma 5 + PostgreSQL |
| Payments | Razorpay (Orders API + Webhooks + Client-side verification fallback) |
| SMS | MSG91 Flow API |
| Export | ExcelJS (server-side `.xlsx` generation) |
| PWA | `vite-plugin-pwa` with Workbox caching for fonts + API menu/stores |

---

## 3. Project Structure

```
restaurant-app/
├── package.json                 # workspace root (npm workspaces: server, client)
├── client/
│   ├── index.html
│   ├── vite.config.ts           # PWA plugin, proxy /api → localhost:3000, manualChunks for admin
│   ├── public/
│   │   ├── manifest.json        # "Roll's & Co.", standalone, theme_color: #f97316
│   │   ├── icons/               # 192x192, 512x512
│   │   └── images/              # rolls.jpg, burgers.jpg, beverages.jpg, extras.jpg, combos.jpg
│   └── src/
│       ├── main.tsx             # React root, BrowserRouter
│       ├── App.tsx              # Routes: /, /checkout, /success/:orderId, /admin/login, /admin/*
│       ├── index.css            # Tailwind directives, brand color extensions
│       ├── types/index.ts       # Store, MenuItem, CartItem, Order, AdminUser interfaces
│       ├── lib/
│       │   ├── api.ts           # Axios instance, auto-attaches Bearer token, 401 → redirect to /admin/login
│       │   ├── utils.ts         # cn() (clsx + tailwind-merge), formatPrice(₹), formatPhone(10 digits)
│       │   └── razorpay.ts      # loadRazorpayScript(), openRazorpayCheckout()
│       ├── store/
│       │   ├── useCartStore.ts             # Zustand + persist: items[], add/remove/update, getTotals(), getItemCount()
│       │   ├── useStoreStore.ts            # Zustand + persist: selectedStore, clearStore
│       │   ├── useAdminStore.ts            # Zustand + persist: token, admin, logout
│       │   ├── useAdminCacheStore.ts       # Zustand + persist: dashboard cache (orders, menu, bestsellers, pending updates, sync settings). Reduces server calls.
│       │   └── useCustomerOrdersStore.ts   # Zustand + persist: completed customer orders (1-day expiry). Drives post-payment success banner on StoreSelector.
│       ├── components/
│       │   ├── Header.tsx       # Sticky top nav. Shows store name (clickable to change), cart icon, count
│       │   ├── ProtectedRoute.tsx # Redirects to /admin/login if no token
│       │   ├── CategoryNav.tsx   # Horizontal pill tabs (flex-wrap), sticky below header
│       │   ├── MenuItemCard.tsx  # Image, bestseller flame badge, low-stock badge, +/- or Add button
│       │   ├── CartDrawer.tsx    # Desktop sidebar (lg:block). Lists items, GST split, checkout button
│       │   ├── MobileCart.tsx   # Fixed bottom bar on mobile. Item count, names, total, checkout
│       │   └── BillPrint.tsx    # Opens 80mm thermal print window. Chef bill (no prices) + Customer bill (full GST invoice)
│       └── pages/
│           ├── StoreSelector.tsx  # Hero 3-image banner + store cards (Open/Closed badge). Post-payment success banner with order number + Download Bill button.
│           ├── MenuPage.tsx       # CategoryNav + MenuItemCard grid + CartDrawer + MobileCart
│           ├── CheckoutPage.tsx   # Order summary (read-only), customer details, Razorpay checkout
│           ├── OrderSuccess.tsx   # Receipt page by orderId. Shows items, GST, store, pickup instructions
│           └── admin/
│               ├── AdminLogin.tsx   # Dark themed login, email/password, JWT stored in localStorage
│               ├── AdminDashboard.tsx # Sidebar layout (desktop) / mobile overlay nav. Store picker. Tab router.
│               ├── AdminOrders.tsx    # Order list, status dropdown, expand details, sync button, auto-sync interval
│               ├── AdminStock.tsx     # Item list with editable stock input + save button
│               ├── AdminMenu.tsx      # Add/edit/delete items. Toggle availability. Category filter.
│               ├── AdminReports.tsx   # Daily export date picker + Excel download. Bestseller with date range.
│               └── AdminStaff.tsx     # Add/remove admin users. Role + store assignment. Super Admin only.
└── server/
    ├── package.json
    ├── tsconfig.json
    ├── .env.example
    ├── prisma/
    │   ├── schema.prisma          # Simplified: Store, Category, Item, Order, OrderItem, AdminUser, AdminStore
    │   └── seed.ts               # 2 stores, 15 items (3 combos as items), 1 super admin, realistic data
    └── src/
        ├── index.ts               # Fastify bootstrap: CORS, JWT, plugins, routes, health check
        ├── config.ts              # Central env reader (PORT, DATABASE_URL, RAZORPAY_*, JWT_SECRET, MSG91_*)
        ├── prismaClient.ts         # Singleton PrismaClient with query logging in dev
        ├── plugins/
        │   ├── errorHandler.ts     # Prisma error codes (P2002, P2025) → proper HTTP status
        │   └── auth.ts             # `authenticate` exported function. Verifies JWT, attaches request.admin
        ├── utils/
        │   ├── gstCalc.ts          # calculateGst(): returns { subtotal, cgstAmount, sgstAmount, total }
        │   └── orderNumber.ts      # generateOrderNumber(): format R-YYMMDD-### (daily sequence)
        ├── routes/
        │   ├── store.ts            # GET /api/stores — public list
        │   ├── menu.ts             # GET /api/menu/:storeId — public. Returns items grouped by category. No combo logic.
        │   ├── order.ts            # POST /api/orders/create (cartSchema Zod), GET /api/orders/status/:orderId, GET /api/orders/receipt/:orderNo, POST /api/orders/verify
        │   ├── webhook.ts          # POST /api/webhooks/razorpay — signature verification, idempotent payment handling
        │   ├── adminAuth.ts        # POST /api/admin/auth/login, GET /api/admin/auth/me
        │   └── adminDashboard.ts   # GET /orders, POST /orders/sync, GET /orders/new, POST /stock, GET /menu/:storeId, POST /items, PUT /items, DELETE /items/:id, GET /categories, GET /admins, POST /admins, DELETE /admins/:id, GET /bestsellers, GET /export/daily
        └── services/
            ├── paymentService.ts   # Razorpay order creation, webhook signature verification, fetch/refund payment (lazy init)
            ├── orderService.ts     # Core transaction: createPendingOrder (validate, lock stock, create order), markOrderPaid (idempotent), failOrder (restore stock), expireOldPendingOrders
            ├── smsService.ts       # MSG91 Flow API POST. No-op if MSG91_AUTHKEY missing.
            └── exportService.ts    # ExcelJS daily sales report: orderNo, time, itemName, qty, unitPrice, totalPrice, CGST, SGST, grandTotal
```

---

## 4. Database Schema (Prisma)

### Models
- **Store**: id, name, address, isOpen, acceptingOrders, items[], orders[], adminStores[]
- **Category**: id, name (unique), sort, items[]
- **Item**: id, storeId, categoryId, name, description, price (Decimal), gstRate (Decimal, default 5), hsnCode, stock, imageUrl, isBestseller, isAvailable, orderItems[]
- **Order**: id, orderNo (unique, format R-YYMMDD-###), storeId, customerPhone, customerName, customerMessage, status (CREATED/PROCESSING/DELIVERED), paymentStatus (PENDING/PAID/FAILED/REFUNDED), razorpayOrderId (unique), razorpayPaymentId, idempotencyKey (unique), subtotal, cgstAmount, sgstAmount, total, items[], createdAt, updatedAt
- **OrderItem**: id, orderId, itemId, itemName (snapshot), quantity, unitPrice (inclusive/menu price), totalPrice (inclusive line total), basePrice (excl. tax), baseTotal (excl. tax total), gstRate
- **AdminUser**: id, email (unique), name, passwordHash, role (SUPER_ADMIN/MANAGER), stores[]
- **AdminStore**: id, adminId, storeId, admin, store. @@unique([adminId, storeId])

### No Combo Table
Combos are **just items** in the "Combos" category. They have their own independent stock, price, and GST rate. No component-level tracking.

### Indexes
- `@@index([storeId, categoryId])` on Item
- `@@index([storeId, status, createdAt])` on Order
- `@@index([paymentStatus, createdAt])` on Order

---

## 5. API Contract Summary

### Public Routes (No Auth)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/stores` | List all stores with open/close status |
| GET | `/api/menu/:storeId` | Full menu grouped by category. All items are flat — combos are just items in "Combos" category. |
| POST | `/api/orders/create` | Body: `{ storeId, customerPhone, customerName?, customerMessage?, items: [{id, quantity}] }`. Returns `{ orderId, orderNo, razorpayOrderId, amount, keyId, currency }`. |
| GET | `/api/orders/status/:orderId` | Poll payment status after Razorpay attempt. |
| GET | `/api/orders/receipt/:orderNo` | Full receipt with store info. |
| POST | `/api/orders/verify` | Body: `{ orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature }`. Client-side verification fallback. |
| POST | `/api/webhooks/razorpay` | Razorpay webhook. Verifies `x-razorpay-signature`. Idempotent. |

### Admin Routes (Bearer JWT + Store Access Check)
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/admin/auth/login` | `{ email, password }` → `{ token, admin }` |
| GET | `/api/admin/auth/me` | Returns current admin + storeIds |
| GET | `/api/admin/orders?storeId=&status=&page=&limit=` | Paginated orders. Enforces store access. |
| POST | `/api/admin/orders/sync?storeId=` | Body: `{ updates: [{orderId, status}], lastSync? }`. Pushes buffered status changes, returns orders updated since `lastSync`. |
| GET | `/api/admin/orders/new?storeId=&after=` | Returns orders created/updated after timestamp (default: last 5 min). |
| POST | `/api/admin/stock` | Body: `{ itemId, stock }`. Updates item stock. Enforces store access. |
| GET | `/api/admin/menu/:storeId` | Returns all items with `categoryName` flattened, `categoryId`, `storeId`, and price/stock as plain numbers. |
| POST | `/api/admin/items` | Create new item. Super Admin only. |
| PUT | `/api/admin/items` | Update any field of an item. |
| DELETE | `/api/admin/items/:id` | Delete item. |
| GET | `/api/admin/categories` | List all categories. |
| GET | `/api/admin/admins` | List all staff. Super Admin only. |
| POST | `/api/admin/admins` | Create new admin. Super Admin only. |
| DELETE | `/api/admin/admins/:id` | Remove admin. Super Admin only. |
| GET | `/api/admin/bestsellers?storeId=&days=` | Top 10 items sold. `days=0` = all time, `days=1` = today, etc. |
| GET | `/api/admin/export/daily?storeId=&date=` | Downloads `.xlsx` file with daily sales breakdown. |

---

## 6. Critical Business Logic Details

### GST Calculation (Prices are GST-Inclusive)
- **Menu prices are always GST-inclusive** (what the customer pays).
- Base price is reverse-calculated: `basePrice = inclusivePrice / (1 + gstRate/100)`
- GST amount = `inclusivePrice - basePrice`
- CGST = GST / 2, SGST = GST / 2
- Total = sum of inclusive prices (what customer actually pays)
- Example: ₹120 at 5% GST → base ₹114.29, CGST ₹2.86, SGST ₹2.86, total ₹120
- Server recalculates from scratch on checkout. Client preview uses same math for UX.

### Order Creation Transaction Flow
1. Start Prisma transaction (`Serializable`, 5s maxWait, 10s timeout).
2. Validate all items exist and belong to the selected store.
3. **Check stock**: `item.stock >= qty` for each item.
4. **Deduct stock** immediately for each item.
5. Compute GST, generate order number.
6. Create `Order` (status CREATED, paymentStatus PENDING) + `OrderItem` rows.
7. **Commit transaction**.
8. Create Razorpay order (outside DB tx to avoid holding locks).
9. If Razorpay creation fails: call `failOrder()` → restore stock, mark FAILED.
10. Update `Order` with `razorpayOrderId`.

### Payment Failure / Dismissal
- If user closes Razorpay modal: client polls `/api/orders/status/:orderId` after 3s.
- If still PENDING: show failure message with refund assurance.
- If webhook receives `payment.failed` or order expires (>15 min): `failOrder()` restores stock and marks FAILED.

### Admin Sync Pattern
- Admin UI keeps `pendingUpdates` map locally (`{ orderId: newStatus }`).
- Optimistic UI updates the order list immediately.
- **Sync button** sends all pending updates to `POST /api/admin/orders/sync`.
- Server applies updates, then returns all orders with `updatedAt > lastSync`.
- Client merges: keeps local pending updates, adds new orders, updates non-conflicting rows.
- Auto-sync interval runs same logic every 1/3/5 minutes if selected.

### Combos as Items
- The "Combos" category is just a regular category in the `Category` table.
- Combo items have their own price, stock, and GST rate managed independently.
- No component-level tracking. A "Classic Combo" is just one item with `stock = 30`.
- When ordered, stock is decremented like any other item.
- This simplifies the entire codebase — no `Combo` table, no `ComboItem` junction table, no special frontend logic.

---

## 7. Environment Variables (`.env.example`)

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/rollsandco?schema=public"
RAZORPAY_KEY_ID="rzp_test_xxxxxxxx"
RAZORPAY_KEY_SECRET="xxxxxxxx"
RAZORPAY_WEBHOOK_SECRET="whsec_xxxxxxxx"
JWT_SECRET="super-secret-jwt-change-me"
MSG91_AUTHKEY="xxxxxxxx"
MSG91_SENDERID="ROLLCO"
MSG91_TEMPLATE_ID="order_confirmation"
ADMIN_DEFAULT_EMAIL="admin@rollsandco.com"
ADMIN_DEFAULT_PASSWORD="admin123"
PORT=3000
```

---

## 8. Known Gaps / Future Enhancements
- **Order expiry cron**: `expireOldPendingOrders()` exists in `orderService.ts` but is **not yet scheduled**. Add a `node-cron` or `bullmq` job to call it every 5 minutes.
- **Webhook reconciliation cron**: Should periodically query Razorpay for `PENDING` orders older than 5 minutes to handle missed webhooks.
- **Customer Name field**: Optional in checkout but currently only used in DB. Could be shown on receipt/SMS.
- **Pickup token / queue position**: Not yet implemented. Could add `pickupToken` (4-digit) to `Order` model and show in success page/SMS.
- **Store toggle**: Admin cannot yet toggle `isOpen` / `acceptingOrders` from dashboard. Need admin API + UI.
- **Admin activity log**: Not implemented. Useful for multi-manager accountability.
- **WhatsApp notifications**: Schema supports extension. MSG91 also supports WhatsApp via same Flow API.
- **Rate limiting**: No rate limiting middleware installed yet. Recommend `@fastify/rate-limit` on checkout and login.
- **Image optimization**: Currently using generated JPGs. In production, use WebP with fallback, CDN, or at least responsive `srcset`.

---

## 8.5 Admin Dashboard Caching & Offline Mode

The admin dashboard uses a dedicated Zustand store (`useAdminCacheStore.ts`) with `persist` middleware to cache data locally and support offline operation.

### Cached Data Structures
- **`ordersCache`**: Stores paginated orders per store+filter key with a timestamp. Staleness threshold: 5 minutes for background refresh, **hard expiry: 6 hours**. Loaded immediately on mount; background refresh if stale.
- **`menuCache`**: Stores full menu items list per store with timestamp. Staleness threshold: 10 minutes for background refresh, **hard expiry: 6 hours**. Allows instant menu editing without waiting for server round-trip.
- **`bestsellersCache`**: Stores top-10 bestsellers per store+days filter. Staleness threshold: 5 minutes for background refresh, **hard expiry: 6 hours**.
- **`autoSyncInterval`**: Admin's selected auto-sync interval (1/3/5 min or 0 for manual). Persisted across page refreshes via localStorage.
- **`lastSync`**: Timestamp of the last successful server sync. Persisted so incremental fetches continue correctly after refresh.
- **`pendingOrderUpdates`**: Buffered status changes (`{ orderId: newStatus }`) that survive page reloads. Pushed to server via sync button or auto-sync interval.

### Customer Orders Cache (`useCustomerOrdersStore.ts`)
- Stores completed customer orders with **1-day (1440 min) hard expiry**.
- On payment success, the full order data is saved locally so the customer can review it without a server round-trip.
- `lastCompletedOrderId` + `lastCompletedOrderShown` flag drives the **green success notification banner** on the Store Selector page.
- `getRecentOrders()` returns all non-stale orders sorted by createdAt desc — shown in a **"Your Orders (Last 24 Hours)"** section at the bottom of the Store Selector page.
- Each order card shows: order number, payment status badge, store name, item list (first 3 + "+N more"), total, Download Bill and View Receipt buttons.
- Stale entries are auto-purged on every new order addition.
- Auto-downloads the GST bill HTML immediately after payment confirmation.

### Load Strategy
1. **Cache-first**: Render cached data immediately if available. If data is older than 6 hours, it is treated as missing and a fresh fetch is triggered.
2. **Background fetch**: If cache is within 6 hours but past the per-type soft staleness threshold (5–10 min), fetch in background and re-render.
3. **Offline indicator**: `navigator.onLine` listeners toggle an `isOffline` flag. When offline, cached data up to 6 hours old is shown with a yellow "Offline Mode" badge.
4. **Optimistic updates**: Stock changes, availability toggles, and menu edits update the cache immediately before the server confirms, reverting only on error.
5. **Persisted sync settings**: `autoSyncInterval` and `lastSync` are saved to the same localStorage cache store, so the admin's chosen sync interval and sync timestamp survive page refreshes.

### Sync Pattern
- Admin buffers status changes locally. The UI reflects them immediately (optimistic).
- **Manual sync**: "Sync Now" button pushes all pending updates to `POST /api/admin/orders/sync`.
- **Auto-sync**: Configurable interval (1 / 3 / 5 minutes) runs the same push + fetch cycle.
- After successful sync, server returns all orders with `updatedAt > lastSync`. Client merges these without overwriting any new pending updates that may have been created during the network call.
- **Conflict resolution**: Last-write-wins for status. If server has a newer status, it overrides local pending for that order.

### Cache Invalidation
- **Force Refresh**: Each tab (Orders, Stock, Menu, Reports) has a refresh button that bypasses cache and fetches fresh data.
- **Clear All Cache**: Sidebar footer contains a "Clear Cache" button that wipes all cached stores, triggers a full reload, and resets pending updates.
- **Logout**: Cache is intentionally preserved across logout/login for the same admin device, but `pendingOrderUpdates` is cleared after successful sync to prevent stale data for the next session.

### Offline Mode UX
- All admin tabs remain functional with cached data.
- Edits (stock, availability, menu items) are queued and applied optimistically. A toast/indicator shows "Changes saved locally — will sync when online".
- Network restoration triggers an automatic background sync if auto-sync is enabled.

---

## 9. Testing Checklist for Agents

When modifying code, verify:
- [ ] Cart store clears on `setStoreId` change (different store).
- [ ] `useCartStore.getTotals()` matches server-side `calculateGst()` exactly.
- [ ] `orderService.ts` `createPendingOrder` uses `Serializable` isolation and never holds Razorpay call inside the DB transaction.
- [ ] `markOrderPaid` is idempotent (checks `paymentStatus === 'PAID'` early return).
- [ ] `webhook.ts` returns HTTP 200 even on errors to avoid Razorpay infinite retries.
- [ ] Admin `enforceStoreAccess` blocks managers from accessing unassigned stores.
- [ ] Admin sync merges server data without overwriting local pending updates.
- [ ] `formatPhone` strips non-digits and takes last 10 characters.
- [ ] All items are flat — no `Combo` / `ComboItem` / `type` distinction anywhere.
- [ ] `AdminMenu` can add, edit, and delete items. Combos are just items in the "Combos" category.
- [ ] `AdminStaff` is only visible to Super Admin. Managers don't see it.
- [ ] `bestsellers` query works with `days=0` for all-time data.
- [ ] BillPrint uses `unitPrice` (inclusive) and `totalPrice` (inclusive) for customer bill line items. Chef bill has no prices.
- [ ] OrderItem stores `unitPrice` (inclusive), `totalPrice` (inclusive), `basePrice`, `baseTotal`, `gstRate` for correct billing.
- [ ] CustomerBill component auto-prints bill on OrderSuccess page after 1.5s delay. Also provides Print & Download buttons.
- [ ] `/status/:orderId` includes `store` relation so success page can auto-print with store header.
- [ ] `AdminOrders` fetches store name/address for bill header.

---

## 10. Brand Identity

- **Name**: Roll's & Co.
- **Default Admin**: `admin@rollsandco.com` / `admin123`
- **Stores**: "Roll's & Co. Koramangala", "Roll's & Co. HSR Layout"
- **Primary Color**: `#E63946` (Tailwind `brand-500` / red)
- **Accent Color**: `#FFC300` (Tailwind `accent-500` / yellow)
- **Theme Color**: `#E63946`
- **SMS Sender ID**: `ROLLCO`
- **App Display**: Standalone PWA, portrait orientation
