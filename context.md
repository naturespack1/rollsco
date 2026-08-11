# Roll's & Co. — Agent Context (Feature / Component Wise)

> **Repository:** `naturespack1/rollsco`  
> **Project type:** Full-stack restaurant ordering monorepo  
> **Frontend:** React 18 + Vite + TypeScript + Tailwind + Zustand  
> **Backend:** Fastify 4 + TypeScript + Prisma + PostgreSQL  
> **Business:** Pickup-only Roll's & Co. ordering app with online Razorpay checkout, in-store paid order creation, GST bills, SMS notifications, thermal printing, stock/menu/admin management, reporting, Google Maps rating and customer feedback.

This file is intended as the first file an AI/code agent should read before changing the code. It documents the **current codebase**, including implementation details that may differ from older README notes. **Last Updated: 2026-08-11 — includes adminlog rename, feedback without FK, store review URLs.**

---

## 1. Quick Mental Model

### Customer side
1. `/` shows `StoreSelector` unless a store is already selected in Zustand persistence.
2. Selecting an open store stores it in `quickbite-store`, sets cart `storeId`, then `/` renders `MenuPage`.
3. `MenuPage` fetches `/api/menu/:storeId`, validates the store is still open and accepting orders, builds fixed category ordering, adds virtual **Most loved** category from bestseller items, and shows cart UI.
4. Cart is persisted under `quickbite-cart`. It is scoped to the selected store and clears when store changes.
5. Checkout sends only IDs + quantities to backend. Server recalculates all prices/GST and creates Razorpay order.
6. Client uses an `Idempotency-Key` stored in cart state to avoid duplicate checkout orders on retry.
7. Success stores full paid order locally under `rolls-customer-orders`, clears cart and selected store, returns user to StoreSelector with a success banner, and auto-downloads HTML bill.
8. Receipts require both `orderId` and `customerAccessToken`: `/success/:orderId?token=...`.
9. **24h Order History:** `StoreSelector` shows "Your Orders (Last 24 Hours)" from `useCustomerOrdersStore`. Each order card is clickable and now exposes 2 actions: **Rate on Google Maps** (opens store's `googleReviewUrl`) and **Give Feedback** (1-5 stars + comment, stored in new `Feedback` table without FK to Order for easy cleanup). After feedback, button shows "Feedback Given" and duplicate submission is blocked.

### Admin side
1. `/adminlog/login` authenticates email/password and persists JWT + admin data in `rolls-admin`. **Note: URL changed from `/admin` to `/adminlog` on 2026-08-11.** Legacy `/admin/*` redirects to `/adminlog/*` via React Router.
2. `/adminlog/*` is wrapped by `ProtectedRoute` and lazy-loads `AdminDashboard`. `Header` hides cart UI when path starts with `/adminlog` (also checks `/admin` legacy).
3. `AdminDashboard` loads stores from public `/api/stores` (now includes `googleReviewUrl`, `googleMapsUrl`), filters by admin role/store assignments, and exposes tabs:
   - **Manager tabs:** New Order, Orders, Stock, **Feedbacks**
   - **Super Admin extra tabs:** Menu, Reports, Staff
4. Dashboard includes `StoreStatusControls` (open/closed and accepting/paused) plus **Google Review Settings** (Super Admin only) to edit `googleReviewUrl`/`googleMapsUrl` per store via `PATCH /api/admin/stores/:storeId/review-url`. The component now syncs via `useEffect` on `store.id` change to fix previous bug where URLs didn't change on store switch.
5. Admin orders use local buffered status updates and manual/auto sync. Orders fetch now also merges feedback rating via separate query (no FK).
6. Admin can create **instore orders** that are immediately `PAID` with `paymentMethod=INSTORE` and do not open Razorpay.
7. **Feedbacks tab:** `AdminFeedbacks` loads feedbacks per selected store via `/api/admin/feedbacks`, shows average, distribution, insights, filters (rating, days), pagination. Changing store clears old list and refetches – fixed previous caching bug.

---

## 2. Important Business Rules

- **Pickup only.** No delivery address. No customer cancellation flow.
- **Store must be open and accepting orders** for customer checkout.
- **Menu prices are GST-inclusive.** The displayed price is the final customer price.
- **Client is not trusted for price or tax.** Client sends only `{ id, quantity }`; backend loads item prices/GST and computes all totals.
- **Combos are normal `Item` rows** in category `Combos`. There is no `Combo` table or combo-specific frontend logic.
- **Stock is deducted when order is created**, before payment is completed. If payment fails/expires, stock is restored.
- **Online order success requires payment becoming `PAID`.** This happens via Razorpay webhook or client-side verify fallback.
- **Order status pipeline:** `CREATED -> PROCESSING -> DELIVERED`. Admin can set status with dropdown; updates are buffered locally until sync.
- **Payment methods:** `ONLINE` for Razorpay, `INSTORE` for admin-created counter orders.
- **Receipt privacy:** customer-visible order status/receipt route requires UUID order id plus secret `customerAccessToken`.
- **Feedback:** one feedback per order, 1-5 rating, optional comment. No foreign key to Order table (plain `orderId` + `orderNo` + `orderTotal` stored) to allow easy order table cleanup. After feedback, same order cannot submit again (unique `orderId` + 409 guard).
- **Google Review:** per-store `googleReviewUrl` (direct writereview link) and `googleMapsUrl` (fallback). Customer taps "Rate on Google" in 24h history to open review page.

---

## 3. Monorepo Structure

```txt
rollsco/
├── package.json                  # npm workspaces: server, client
├── README.md
├── context.md                    # this agent context file
├── client/
│   ├── package.json
│   ├── vite.config.ts            # Vite, PWA plugin, /api proxy, alias @ -> src
│   ├── public/
│   │   ├── manifest.json
│   │   └── images/               # rolls.jpg, burgers.jpg, beverages.jpg, extras.jpg, combos.jpg
│   └── src/
│       ├── App.tsx               # route switch and selected-store guard (now /adminlog)
│       ├── main.tsx              # BrowserRouter + React root
│       ├── index.css             # Tailwind base/components/utilities
│       ├── components/           # reusable customer/admin UI and print components
│       │   ├── OrderFeedbackModal.tsx # NEW: Google rate + feedback modal
│       │   └── StoreStatusControls.tsx # now includes Google Review Settings + useEffect sync fix
│       ├── lib/                  # api client, razorpay loader, print helpers, utils
│       ├── pages/                # customer pages + admin pages
│       │   └── admin/AdminFeedbacks.tsx # NEW: feedback listing tab
│       ├── store/                # Zustand persisted stores
│       └── types/index.ts        # shared frontend interfaces (Store now has googleReviewUrl)
└── server/
    ├── package.json
    ├── prisma/
    │   ├── schema.prisma         # DB schema (now includes Feedback without Order FK)
    │   ├── seed.ts               # Patna demo stores/menu/default admin + googleReviewUrl placeholders
    │   └── migrations/
    └── src/
        ├── index.ts              # Fastify bootstrap + maintenance timer (now registers feedbackRoutes)
        ├── config.ts             # env reader/production validation
        ├── prismaClient.ts       # Prisma singleton
        ├── plugins/              # auth, error handler, checkout abuse guard
        ├── routes/               # public and admin route modules
        │   ├── feedback.ts       # NEW: public feedback submit + fetch
        │   ├── store.ts          # now selects googleReviewUrl/mapsUrl
        │   ├── order.ts          # status now fetches feedback separately (no FK)
        │   ├── adminDashboard.ts # now includes /feedbacks, /feedbacks/stats, /stores/:id/review-url + orders with feedback map
        │   └── ...
        ├── services/             # order/payment/sms/export/reconciliation logic
        └── utils/                # GST calculation, order number generation
```

---

## 4. Commands

Run from repo root unless noted.

```bash
npm install                         # install workspace deps
npm run dev:server                  # server on :3000
npm run dev:client                  # client on :5173, proxies /api -> :3000
npm run build                       # build server then client
npm run test                        # server vitest tests
npm run db:push                     # Prisma db push through server workspace
npm run db:seed                     # seed demo stores/items/admin
```

Server package scripts:

```bash
cd server
npm run dev                         # tsx watch src/index.ts
npm run build                       # prisma generate && tsc
npm run db:generate                 # prisma generate
npm run test                        # vitest run
```

---

## 5. Environment Variables

### Server (`server/.env.example`)

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/quickbite?schema=public"
RAZORPAY_KEY_ID="rzp_test_xxxxxxxx"
RAZORPAY_KEY_SECRET="xxxxxxxx"
RAZORPAY_WEBHOOK_SECRET="whsec_xxxxxxxx"
JWT_SECRET="use-a-random-secret-of-at-least-32-characters"
FRONTEND_ORIGIN="https://your-frontend.example.com"
MSG91_AUTHKEY="xxxxxxxx"
MSG91_SENDERID="ROLLCO"
MSG91_TEMPLATE_ID="order_confirmation"
ADMIN_DEFAULT_EMAIL="admin@rollsandco.com"
ADMIN_DEFAULT_PASSWORD="admin123"
PORT=3000
```

`server/src/config.ts` behavior:
- `NODE_ENV` defaults to `development`.
- In production, missing required values throw at startup.
- Production JWT secret must be at least 32 chars.
- `FRONTEND_ORIGIN` is comma-separated, optional at startup; in production CORS allows only listed origins.
- Defaults still reference `quickbite` DB and `QUICKB` sender in code; seed/default UI is Roll's & Co.

### Client (`client/.env.example`)

```env
# Local dev can leave it as /api via Vite proxy.
VITE_API_URL=https://rollsco-server.vercel.app/api
```

`client/src/lib/api.ts` defaults to `/api` when `VITE_API_URL` is not set.

---

## 6. Database Schema (Current Prisma)

### Core models
- `Store`
  - `id`, `name`, `address`, `googleReviewUrl String?`, `googleMapsUrl String?`, `isOpen`, `acceptingOrders`, `createdAt`
  - Relations: `items`, `orders`, `feedbacks`, `adminStores`
- `Category`
  - `id`, `name` unique, `sort`
- `Item`
  - `id`, `storeId`, `categoryId`, `name`, `description`, `price`, `gstRate`, `hsnCode`, `stock`, `imageUrl`, `isBestseller`, `isAvailable`
  - Index: `[storeId, categoryId]`
- `Order`
  - `id`, `orderNo`, `storeId`, `customerPhone`, `customerName`, `customerMessage`
  - `customerAccessToken` unique secret for receipt/status access
  - `createdByAdminId` optional for instore orders
  - `status`: `CREATED | PROCESSING | DELIVERED`
  - `paymentStatus`: `PENDING | PAID | FAILED | REFUNDED`
  - `paymentMethod`: `ONLINE | INSTORE`
  - Razorpay fields: `razorpayOrderId` unique nullable, `razorpayPaymentId`
  - `idempotencyKey` unique nullable for online checkout retry safety
  - Monetary fields: `subtotal`, `cgstAmount`, `sgstAmount`, `total`
  - Indexes: `[storeId,status,createdAt]`, `[storeId,paymentStatus,createdAt]`, `[paymentStatus,createdAt]`
  - **No relation to Feedback** – intentional to allow order cleanup
- `Feedback` **NEW – no FK to Order for easy cleanup**
  - `id`, `orderId String @unique` (plain reference, no @relation), `orderNo String` (denormalized for display after order deletion), `storeId`, `rating Int 1..5`, `comment String? @db.Text`, `customerPhone`, `customerName`, `orderTotal Decimal?`, `createdAt`, `updatedAt`
  - Relation only to `Store` with `onDelete: Cascade`
  - Indexes: `[storeId,createdAt]`, `[rating]`, `[createdAt]`, `[orderNo]`
- `OrderItem`
  - Snapshot fields: `itemName`, `quantity`, `unitPrice`, `totalPrice`, `basePrice`, `baseTotal`, `gstRate`
  - `unitPrice` and `totalPrice` are GST-inclusive.
- `AdminUser`
  - `id`, `email`, `name`, `passwordHash`, `role`, relation to assigned stores and created instore orders
- `AdminStore`
  - Join table with `@@unique([adminId, storeId])`
- `DailyOrderSequence`
  - `dateKey`, `nextValue`; used by atomic order number generator
- `PaymentEvent`
  - Records Razorpay webhooks and client verification events with `dedupeKey` unique, raw JSON payload, status, processedAt

### Seed data (`server/prisma/seed.ts`)
- Deletes `feedback` first, then orders/items/categories/admins/stores before reseeding.
- Stores:
  - `Roll's & Co. Boring Road`, address `Boring Road, Patna`, `googleReviewUrl=https://search.google.com/local/writereview?placeid=ChIJ_example_boring_road`, `googleMapsUrl=https://maps.google.com/?q=Rolls+%26+Co+Boring+Road+Patna`
  - `Roll's & Co. Kankarbagh`, address `Kankarbagh, Patna`, `googleReviewUrl=https://search.google.com/local/writereview?placeid=ChIJ_example_kankarbagh`, `googleMapsUrl=https://maps.google.com/?q=Rolls+%26+Co+Kankarbagh+Patna`
- Default admin:
  - email `admin@rollsandco.com`
  - password `admin123`
  - role `SUPER_ADMIN`
- Categories: `Roll`, `Burgers`, `Beverages`, `Extras`, `Combos`
- 15 sample items for store 1, replicated to store 2.

---

## 7. Backend Bootstrap and Cross-Cutting Concerns

### `server/src/index.ts`
- Creates Fastify with logging and `trustProxy: true`.
- Registers:
  - Helmet with strict base CSP directives
  - CORS with allowed origins from `FRONTEND_ORIGIN`; non-browser calls allowed
  - `fastify-raw-body` only for routes that need raw body (`config.rawBody: true`)
  - JWT plugin
  - error handler and auth plugin
- Route prefixes:
  - `/api/stores` -> `store.ts`
  - `/api/menu` -> `menu.ts`
  - `/api/orders` -> `order.ts`
  - `/api/feedback` -> `feedback.ts` **NEW**
  - `/api/webhooks` -> `webhook.ts`
  - `/api/admin/auth` -> `adminAuth.ts`
  - `/api/admin` -> `adminDashboard.ts`
- Health: `GET /health -> { status: 'ok' }`
- Starts maintenance interval every 5 minutes:
  - If Razorpay keys exist, calls `reconcilePendingPayments()` first, then `expireOldPendingOrders()`.
  - Otherwise only expires old pending orders.
  - Also runs once on startup.

### `plugins/auth.ts`
- `authenticate` reads `Authorization: Bearer <jwt>`, verifies JWT, loads assigned store IDs from DB, and attaches `request.admin = { id, email, role, storeIds }`.
- Routes import `authenticate` directly.

### `plugins/abuseProtection.ts`
- In-memory checkout guard for public checkout/verify.
- Limits per 60 seconds:
  - IP: 20
  - phone: 6
  - device: 12
- Uses hashed keys and `X-Device-Id` header.
- Production multi-instance deployments should replace this with Redis/shared rate limiter.

### `plugins/errorHandler.ts`
- Handles Prisma known errors (notably unique/not-found) and general errors. Check this file before changing error response shapes.

---

## 8. API Contract (Current)

All successful route handlers generally return `{ success: true, data: ... }` except health and file downloads.

### Public APIs
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/stores` | List stores, sorted with open+accepting stores first. Now includes `googleReviewUrl`, `googleMapsUrl`. |
| GET | `/api/menu/:storeId` | Public menu for one store, available items only, grouped categories plus virtual `Most loved`. Returns store too (now with review URLs). |
| POST | `/api/orders/create` | Online checkout. Requires `Idempotency-Key` UUID header and body with store/customer/items. Creates pending order + Razorpay order. |
| GET | `/api/orders/status/:orderId?token=<customerAccessToken>` | Customer-visible order/receipt status. Requires token. Includes store (with review URLs) and item snapshots + feedback (fetched separately, no FK). |
| POST | `/api/orders/verify` | Client-side Razorpay signature verification fallback. Requires checkout abuse guard. |
| POST | `/api/feedback` | **NEW** Submit feedback. Body `{ orderId, token, rating 1..5, comment? }`. Validates token, PAID only, 409 if already exists. Stores `orderNo` + `orderTotal` for later display after order deletion. No FK to Order. |
| GET | `/api/feedback/order/:orderId?token=...` | **NEW** Get existing feedback for an order to check if already given. |
| POST | `/api/webhooks/razorpay` | Razorpay webhook with raw body signature verification and payment event dedupe. |

### Admin auth APIs
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/admin/auth/login` | `{ email, password }` -> `{ token, admin }` with 7-day JWT. |
| GET | `/api/admin/auth/me` | Current authenticated admin from token + store IDs. |

### Admin dashboard APIs (Bearer JWT)
| Method | Path | Role/access | Purpose |
|---|---|---|---|
| PATCH | `/api/admin/stores/:storeId/status` | assigned store | Update `isOpen` and/or `acceptingOrders`. Now returns google URLs too. |
| PATCH | `/api/admin/stores/:storeId/review-url` | **NEW**, SUPER_ADMIN only | Update `googleReviewUrl` and/or `googleMapsUrl`. Body `{ googleReviewUrl?, googleMapsUrl? }`. |
| POST | `/api/admin/orders/instore` | assigned store | Create paid in-store order (`PAID`, `INSTORE`) without Razorpay. |
| GET | `/api/admin/orders?storeId=&status=&statuses=&page=&limit=` | assigned store | Paginated order list. `statuses` supports comma-separated statuses. Now merges feedback rating via separate query (no FK). |
| POST | `/api/admin/orders/sync?storeId=` | assigned store | Apply buffered status updates and return updated orders since optional `lastSync`. Now includes feedback map. |
| GET | `/api/admin/orders/new?storeId=&after=` | assigned store | Orders created after timestamp or last 5 minutes. |
| POST | `/api/admin/stock` | assigned store of item | Update stock by `{ itemId, stock }`. |
| GET | `/api/admin/menu/:storeId` | assigned store | Full admin menu, flattened `categoryName`, numeric prices/GST. |
| POST | `/api/admin/items` | SUPER_ADMIN | Create menu item. |
| PUT | `/api/admin/items` | SUPER_ADMIN | Update menu item fields. Category change is not included in update schema. |
| DELETE | `/api/admin/items/:itemId` | SUPER_ADMIN | Delete menu item. |
| GET | `/api/admin/categories` | SUPER_ADMIN | List categories. |
| GET | `/api/admin/admins` | SUPER_ADMIN | List staff/admin users with assigned stores. |
| POST | `/api/admin/admins` | SUPER_ADMIN | Create admin/staff with role and store assignments. |
| DELETE | `/api/admin/admins/:adminId` | SUPER_ADMIN | Delete admin; cannot delete self. |
| GET | `/api/admin/bestsellers?storeId=&days=` | SUPER_ADMIN | Top 10 sold items; `days=0` means all time. |
| GET | `/api/admin/payment-summary?storeId=&days=` | SUPER_ADMIN | Paid totals grouped by `ONLINE` vs `INSTORE`. |
| GET | `/api/admin/export/daily?storeId=&date=` | SUPER_ADMIN | Downloads Excel `.xlsx` daily sales report. |
| GET | `/api/admin/feedbacks?storeId=&page=&limit=&rating=&from=&to=` | **NEW**, assigned store (Manager + Super Admin) | Paginated feedbacks for selected store, average + distribution. No FK to Order – easy cleanup. Filter by rating, date range. |
| GET | `/api/admin/feedbacks/stats?storeId=&days=` | **NEW**, assigned store | Stats: avg rating, total, distribution, recent 5 feedbacks. Used by dashboard. |

### Store access enforcement
- `SUPER_ADMIN` can access all stores.
- `MANAGER` can access only stores in `request.admin.storeIds`.
- Store access is enforced per route in `adminDashboard.ts`.

---

## 9. Backend Services and Algorithms

### GST calculation — `server/src/utils/gstCalc.ts`
Function: `calculateGstFromInclusive(items)`
- Input: `[{ inclusivePrice, quantity, gstRate }]`
- For each line:
  - `lineTotal = inclusivePrice * quantity`
  - `lineBase = lineTotal / (1 + gstRate / 100)`
  - `lineGst = lineTotal - lineBase`
  - CGST = `lineGst / 2`, SGST = `lineGst / 2`
- Returns rounded `{ subtotal, cgstAmount, sgstAmount, total }`.
- Frontend cart totals duplicate this logic in `useCartStore.getTotals()`. Keep both aligned.

### Order number — `server/src/utils/orderNumber.ts`
- Time zone: `Asia/Kolkata`.
- Format: `R-YYMMDD-XXXX-XXXX`
  - First 4 digits random.
  - Last 4 digits are atomic daily sequence from `DailyOrderSequence.nextValue`.
- Throws if daily sequence exceeds 9999.

### Online order creation — `server/src/services/orderService.ts`
Main function: `createPendingOrder(storeId, phone, name, message, cartItems, idempotencyKey)`
1. Calls internal `createOrderWithStock` inside Prisma transaction with `Serializable` isolation.
2. Normalizes duplicate item IDs by summing quantity.
3. Enforces max distinct items = 30 and quantity 1..20 per line from route schema.
4. Loads items for the selected store; rejects missing, unavailable, wrong-store, out-of-stock, or insufficient stock.
5. Decrements stock using conditional `updateMany` (`stock >= quantity`) to protect from races.
6. Calculates GST-inclusive totals.
7. Generates order number.
8. Creates `Order` with `paymentStatus=PENDING`, `paymentMethod=ONLINE`, `idempotencyKey`, line item snapshots.
9. Commits DB transaction.
10. Creates Razorpay order outside DB transaction.
11. If Razorpay order creation fails, calls `failOrder(order.id)` to restore stock and mark FAILED.
12. Updates order with `razorpayOrderId`.

### In-store order creation — `createInstoreOrder(...)`
- Uses same stock validation/deduction path as online orders.
- Creates order with `paymentStatus=PAID`, `paymentMethod=INSTORE`, `createdByAdminId`.
- No Razorpay call.
- Sends SMS if configured.
- Returns full order for admin print/use.

### Mark paid — `markOrderPaid(razorpayOrderId, razorpayPaymentId)`
- Transactional and idempotent.
- If order already `PAID`, returns current paid order.
- Uses guarded update from `PENDING` -> `PAID` to avoid duplicate webhook/client races.
- Saves `razorpayPaymentId` and includes store/items.
- Sends MSG91 SMS after payment is marked paid.

### Fail/expire order — `failOrder(orderIdOrRazorpayId)` and `expireOldPendingOrders()`
- `failOrder` finds a pending order by internal order ID or Razorpay order ID.
- Marks `FAILED` only if current status is `PENDING`.
- Restores stock for every order item.
- `expireOldPendingOrders` finds online pending orders older than 15 minutes and fails/restores them.

### Feedback Service — logic inside `feedback.ts` route (no separate service file yet)
- `POST /api/feedback` validates order + token, PAID only, checks existing feedback via `findUnique(orderId)`, creates feedback with `orderNo`, `orderTotal`, phone/name denormalized.
- No foreign key to Order means orders can be deleted without violating FK; feedback remains with `orderNo` for admin reporting.
- `GET /api/feedback/order/:orderId` validates token then returns feedback or null.

### Payment service — `paymentService.ts`
- Lazy initializes Razorpay client using env keys.
- Creates Razorpay orders in paise.
- Verifies webhook signatures using raw body and `RAZORPAY_WEBHOOK_SECRET`.
- Creates dedupe keys from raw body SHA256.
- Records payment events in `PaymentEvent` with unique `dedupeKey`; duplicates are treated as already received.
- Supports fetch order payments/payment/refund methods used by reconciliation.

### Reconciliation — `paymentReconciliation.ts`
- Finds old pending orders with Razorpay order IDs.
- Fetches Razorpay order payments.
- If a captured payment exists, calls `markOrderPaid`.
- Idempotent due to `markOrderPaid` safeguards.

### SMS — `smsService.ts`
- Uses MSG91 Flow API when `MSG91_AUTHKEY` exists.
- If auth key is missing, logs/skips rather than failing order flow.

### Export — `exportService.ts`
- Generates Excel workbook with daily sales data for paid orders by store/date.
- Includes order number, time, item, quantity, prices, CGST, SGST, total.

---

## 10. Frontend Routing

Defined in `client/src/App.tsx`:

| Route | Component | Notes |
|---|---|---|
| `/` | `StoreSelector` or `MenuPage` | If `selectedStore` exists, show menu; otherwise store selector. |
| `/checkout` | `CheckoutPage` | Requires selected store and non-empty cart; else redirects `/`. |
| `/success/:orderId` | `OrderSuccess` | Requires `?token=<customerAccessToken>`. |
| `/adminlog/login` | `AdminLogin` | **NEW**: changed from `/admin/login` to `/adminlog/login` on 2026-08-11. Public admin login. |
| `/adminlog/*` | `ProtectedRoute` -> lazy `AdminDashboard` | **NEW**: changed from `/admin/*` to `/adminlog/*`. Requires JWT token in admin store. Includes legacy redirects from `/admin/*` -> `/adminlog`. |
| `/admin/login` | Redirect -> `/adminlog/login` | Legacy redirect. |
| `/admin/*` | Redirect -> `/adminlog` | Legacy redirect. |
| `*` | redirect `/` | Catch-all. |

`Header` is always rendered but checks `pathname.startsWith('/adminlog') || startsWith('/admin')` to hide cart/store UI for admin routes.

---

## 11. Frontend State Stores

### `useStoreStore.ts`
- Persist key: `quickbite-store`.
- State: `selectedStore` (now includes `googleReviewUrl`, `googleMapsUrl` optional).
- Actions: `setSelectedStore`, `clearStore`.

### `useCartStore.ts`
- Persist key: `quickbite-cart`.
- State:
  - `storeId`
  - `items`
  - `checkoutIdempotencyKey`
- Important behavior:
  - `setStoreId(id)` clears cart and checkout idempotency key if the store changes.
  - `addItem/updateQuantity` cap item quantity to `min(maxStock, 20)`.
  - Any cart mutation clears `checkoutIdempotencyKey` so a changed cart gets a new idempotent checkout.
  - `getOrCreateCheckoutIdempotencyKey()` generates UUID and persists it until cart changes/clears.
  - `getTotals()` reverse-calculates base/tax from GST-inclusive item prices.

### `useAdminStore.ts`
- Persist key: check file before changing (admin JWT/admin profile persistence).
- Stores JWT token and admin profile.
- `api.ts` reads token from here and adds `Authorization` header.
- `logout()` clears auth and is called automatically on admin 401 responses (now redirects to `/adminlog/login`).

### `useAdminCacheStore.ts`
- Persist key: `rolls-admin-cache`, version 2.
- Caches:
  - `ordersCache` in runtime state but **not persisted** because it contains customer PII/payment/order info.
  - `menuCache` persisted.
  - `bestsellersCache` persisted.
  - `autoSyncInterval`, `lastSync`, `pendingOrderUpdates` persisted.
- Hard cache expiry: 6 hours.
- Typical soft staleness thresholds in components:
  - Orders: 5 min
  - Menu/Stock: 10 min
  - Reports: 5 min
- Has helpers for optimistic stock/menu/availability edits and pending order status updates.

### `useCustomerOrdersStore.ts`
- Persist key: `rolls-customer-orders`.
- Holds completed customer orders locally for 24h.
- Drives green success banner and "Your Orders (Last 24 Hours)" on `StoreSelector`.
- Stores `customerAccessToken` with each order so receipt link works from local history.
- Purges stale orders when adding a new order.
- New: `StoreSelector` now also fetches feedback status per order via `/api/feedback/order/:id?token=` and displays badge.

---

## 12. Frontend Libraries and Helpers

### `lib/api.ts`
- Axios instance base URL: `VITE_API_URL || '/api'`.
- Adds admin bearer token if available.
- Adds generated `X-Device-Id` stored in localStorage key `rolls-device-id`.
- On 401 for `/admin...` URLs (backend paths `/api/admin/...`), logs out and redirects to `/adminlog/login` (changed from `/admin/login`).

### `lib/razorpay.ts`
- Dynamically loads `https://checkout.razorpay.com/v1/checkout.js` with id `razorpay-script`.
- `openRazorpayCheckout` opens Razorpay with Roll's & Co. branding.
- `modal.ondismiss` triggers caller's failure/polling path.

### `lib/utils.ts`
- `cn()` combines `clsx` and `tailwind-merge`.
- `formatPrice()` renders INR currency.
- `formatPhone()` strips non-digits and takes the last 10 digits.

### `lib/thermalPrint.ts`
- Generates popup print windows with inline HTML/CSS for thermal printer sizes.
- Functions:
  - `openChefBillPrint(order, storeName, storeAddress)` — kitchen copy, no prices.
  - `openMultipleChefBillPrint(orders, storeName, storeAddress)` — batch print new chef copies to avoid popup blockers.
  - `openCustomerBillPrint(order, storeName, storeAddress)` — customer GST bill.
  - `downloadBillHtml(order, storeName, storeAddress)` — downloadable HTML bill.

### `components/CustomerBill.tsx`
- Also exports `openCustomerBillPrint` and `downloadBillHtml` used by checkout/store selector/success page.
- Generates customer-facing GST invoice and supports auto-print.

### `components/OrderFeedbackModal.tsx` **NEW**
- Props: `order`, `isOpen`, `onClose`, `stores` list, `onFeedbackSubmitted`
- Shows order summary + 2 cards:
  - **Rate on Google Maps:** resolves `order.store.googleReviewUrl` || store list `googleReviewUrl` || `googleMapsUrl` || fallback Google search URL, opens new tab.
  - **Feedback:** If existing feedback, shows stars, comment, timestamp, blocking message. If not, shows "Give Feedback" -> star selector 1-5 + hover, comment textarea max 1000, submit via `POST /api/feedback` with token, handles 409 duplicate.
- Fetches existing feedback via `GET /api/feedback/order/:orderId?token=` on open if not already in order.

---

## 13. Customer Feature / Component Details

### `StoreSelector.tsx`
- Fetches `/api/stores` (now includes `googleReviewUrl`).
- Sorts open+accepting stores first.
- Shows brand hero cards with images and taglines.
- Disables closed/paused stores.
- On selection:
  - `setSelectedStore(store)`
  - `useCartStore.setStoreId(store.id)`
  - navigates `/` (which then renders `MenuPage`)
- Shows order success banner for the last order added to `useCustomerOrdersStore`.
- Shows "Your Orders (Last 24 Hours)" list:
  - Now clickable card (group hover) with orderNo, paymentStatus, feedback badge if exists, date, store, first 3 items.
  - Fresh order (15 min) shows prep time banner.
  - Buttons: Bill, Receipt (stopPropagation), **NEW: Rate on Google** (blue, opens review URL), **Give Feedback** (amber, or green disabled "Feedback Given" if already submitted).
  - Click card or Feedback button opens `OrderFeedbackModal`.
  - Fetches feedback status per recent order via `GET /api/feedback/order/:id?token=` and stores in `feedbackStatusMap`.
  - Manages `selectedOrder` + `showFeedbackModal` state.

### `MenuPage.tsx`
- On selected store:
  - calls `setStoreId(selectedStore.id)` to scope cart.
  - fetches `/api/menu/:storeId`.
  - if returned store is closed/not accepting, clears cart + store and returns to StoreSelector.
- Category ordering priority:
  1. Most loved
  2. Roll
  3. Burger
  4. Combo
  5. Beverage
  6. Extra
  7. other
- It removes server-provided "Most loved" category then rebuilds it from `isBestseller` items to avoid duplication.
- Uses `IntersectionObserver` to highlight active category.
- Uses `CategoryNav`, `MenuItemCard`, `CartDrawer`, `MobileCart`.

### `MenuItemCard.tsx`
- Shows item image, name, description, price, bestseller/low-stock/out-of-stock state.
- Uses cart store to add/update quantity.
- Cannot add beyond current stock known by menu item.

### `CategoryNav.tsx`
- Sticky horizontal/flex category pill navigation.
- Works with click-to-scroll from parent.

### `CartDrawer.tsx`
- Desktop cart sidebar.
- Shows line items, quantity controls, totals (subtotal excl tax, CGST, SGST, total), and checkout button.
- Quantity increase capped at `min(maxStock, 20)`.

### `MobileCart.tsx`
- Fixed mobile bottom cart summary.
- Shows count/item summary/total and navigates to checkout.

### `CheckoutPage.tsx`
- Requires cart and selected store.
- Collects:
  - phone required, 10 digits
  - name optional
  - preparation note optional, UI max 200 chars (server allows 500)
- Calls `POST /orders/create` with `Idempotency-Key` header.
- If response says `PAID` from retry, fetches status and completes without Razorpay.
- Otherwise opens Razorpay.
- Success flow:
  1. Polls `/orders/status/:orderId?token=...`.
  2. If not paid, posts `/orders/verify` with Razorpay signature.
  3. Fetches status again.
  4. On `PAID`: clears cart, caches order, downloads bill, clears selected store, navigates `/`.
- Dismiss/failure flow:
  - Waits 3s, polls status; if still not paid, shows refund assurance error.

### `OrderSuccess.tsx`
- Uses `orderId` route param and `token` query param.
- Fetches `/orders/status/:orderId?token=...` (now includes feedback).
- Auto-prints customer bill after 1.5s when order loads.
- Shows order number, 5–10 min prep estimate, item/GST breakdown, pickup/store info, preparation note, print/download actions.

### `Header.tsx`
- Checks `location.pathname.startsWith('/adminlog') || startsWith('/admin')` to detect admin routes (updated for rename).
- Hidden cart UI on admin routes.
- Shows brand, selected store, cart icon/count.
- Store name can be clicked to change store; this clears selected store and cart.

---

## 14. Admin Feature / Component Details

### `AdminLogin.tsx`
- Dark login UI.
- Calls `/api/admin/auth/login`.
- Saves `token` and `admin` into `useAdminStore`.
- Redirects to `/adminlog` after login (changed from `/admin`). Reads `from` state or defaults to `/adminlog`.

### `ProtectedRoute.tsx`
- If no token, redirects to `/adminlog/login` (changed from `/admin/login`) and preserves location state.

### `AdminDashboard.tsx`
- Shell layout with desktop sidebar and mobile overlay nav.
- Loads all stores via `/api/stores`, then filters store select by role.
- Tabs:
  - `instoreOrder` -> `AdminCreateOrder`
  - `orders` -> `AdminOrders`
  - `stock` -> `AdminStock`
  - `feedbacks` -> `AdminFeedbacks` **NEW** – available to Manager and Super Admin
  - `menu` -> `AdminMenu` (Super Admin only)
  - `reports` -> `AdminReports` (Super Admin only)
  - `staff` -> lazy `AdminStaff` (Super Admin only)
- Always displays `StoreStatusControls` for current selected store.
- Clear Cache button calls `useAdminCacheStore.invalidateAll()` and reloads.
- Logout navigates to `/adminlog/login`.
- Fixed: store list includes google URLs.

### `StoreStatusControls.tsx`
- Calls `PATCH /api/admin/stores/:storeId/status`.
- Can toggle `isOpen` (store open/closed) and `acceptingOrders` (pause/accept new customer orders).
- Shows current customer availability status.
- **NEW: Google Review Settings** (Super Admin only):
  - Inputs for `googleReviewUrl` (direct review link) and `googleMapsUrl` (fallback)
  - Save via `PATCH /api/admin/stores/:storeId/review-url`
  - Shows success message.
  - **Fix:** `useEffect` syncs `reviewUrl`/`mapsUrl` state when `store.id` or google URLs change – fixes bug where switching store didn't update inputs.
- Error and warning banners included.

### `AdminCreateOrder.tsx`
- Admin/counter order entry tab.
- Fetches `/admin/menu/:storeId`, filters available items.
- Client-side cart with category scroll navigation and stock caps.
- Requires 10-digit phone and non-empty cart.
- Posts `/admin/orders/instore`.
- Server creates a paid instore order, decrements stock, sends SMS if configured.
- On success:
  - invalidates orders/menu/bestsellers cache
  - locally decrements displayed stock
  - optionally auto-prints customer copy using thermal print
  - clears cart/customer form
- Auto-print setting key: `rolls-auto-print-customer` (default true).

### `AdminOrders.tsx`
- Loads orders cache-first, then server.
- Filter supports multiple statuses via `statuses=CREATED,PROCESSING`.
- Status changes are optimistic and stored in local `pendingUpdates` plus persisted `pendingOrderUpdates`.
- Sync button:
  - POSTs `/admin/orders/sync` with pending updates and optional `lastSync`.
  - Clears pending updates after successful push.
  - Fetches full orders afterwards (now includes feedback rating via map).
- Auto-sync intervals: manual / 1 min / 3 min / 5 min. Setting persists.
- Offline behavior: if fetch fails and cache exists, shows cached orders and offline badge.
- Chef thermal auto-print: tracks seen order IDs after first load, new paid orders auto-print.
- Each order row includes `BillPrint` controls and expandable item details/prep note.
- **Future:** could show feedback badge per order (rating already fetched via feedback map).

### `BillPrint.tsx`
- Admin-side print button/component.
- Opens thermal print windows for chef/customer copies as implemented in component.
- Used inside `AdminOrders` order rows.

### `AdminStock.tsx`
- Cache-first loads admin menu and maps to stock rows.
- Shows low stock badge when stock <= 5.
- Allows stock input per item and save.
- On save optimistically updates UI and menuCache, POSTs `/admin/stock`.

### `AdminMenu.tsx`
- Super Admin only.
- Cache-first loads `/admin/menu/:storeId` and `/admin/categories`.
- Supports filters: All, Available, Hidden, and by category.
- Add/edit/delete items as before.

### `AdminReports.tsx`
- Super Admin only.
- Date picker downloads Excel from `/admin/export/daily`.
- Range selector controls bestsellers and payment collection.

### `AdminStaff.tsx`
- Super Admin only.
- Loads `/admin/admins` and `/stores`.
- Can create staff/admin with name, email, password, role, and assigned stores.
- Can delete admins except self.

### `AdminFeedbacks.tsx` **NEW**
- Available to Manager + Super Admin (store access enforced).
- Props: `storeId`.
- State: feedbacks list, loading, total, average, distribution, page, ratingFilter, daysFilter, `currentStoreId` for sync verification.
- **Fix:** `useEffect` tracks `storeId !== currentStoreId` -> resets page, clears feedbacks, sets loading true, forces reload. Also page reset on filter change and explicit reload on storeId change.
- Loads via `GET /api/admin/feedbacks?storeId=&page=&limit=&rating=` and `/api/admin/feedbacks/stats?storeId=&days=`.
- UI:
  - Header with "Customer Feedbacks" + sync badge + storeId short
  - Filters: days (All Time/24h/7d/30d) + rating (1-5)
  - Stats cards: Average Rating with stars, Distribution bars 5..1, Insights (positive/critical/total)
  - List: orderNo (or orderId short), rating stars, timestamp, comment (or "No comment"), customer name/phone, total, date, store name, badge Positive/Neutral/Critical, ID short with "no FK" hint.
  - Pagination Prev/Next.
  - Empty state explicitly says "No feedbacks found for this store" and hints to switch store selector.

---

## 15. Printing and Billing

### Chef copy
- No prices.
- Shows store, order number, date/time, phone/name, payment method/status, item names/quantities, prep note, prep instruction.
- Used for kitchen thermal printer.

### Customer bill
- Shows GST invoice style details.
- Uses order snapshot line fields.
- Downloaded as `.html`.

### Auto-print behavior
- Customer success page auto-prints after 1.5s.
- Admin new paid orders can auto-print chef copy.
- Admin instore orders can auto-print customer copy.
- Print functions rely on `window.open`; popup blockers can affect printing.

---

## 16. Payment Flow Details

Same as before, plus feedback only allowed for PAID orders (checked in `/api/feedback` POST).

---

## 17. Security and Reliability Notes

- Server-side pricing, serializable stock transaction, conditional stock update, Razorpay call outside transaction, idempotency-key, customerAccessToken, PaymentEvent dedupe, JWT 7-day expiry, role/store auth, checkout abuse guard, maintenance timer.
- **Feedback security:** requires `orderId + customerAccessToken` to prove ownership, PAID only, one per order (unique constraint + 409).
- **No FK to Order:** feedbacks independent of orders, easy cleanup, order deletion doesn't fail. Order total/phone/name denormalized into feedback at creation.
- **Admin login URL rename:** frontend now uses `/adminlog/*`, backend API still `/api/admin/*`. Legacy frontend `/admin/*` redirects to `/adminlog` to avoid 404.

---

## 18. Known Gaps / Watchouts

- In-memory abuse guard is not shared across instances – use Redis in prod.
- Admin stock/menu offline optimistic but not queued except order status pending updates.
- `AdminReports` payment summary not cached; bestsellers cached.
- `AdminMenu` edit cannot change category.
- Public menu creates virtual Most loved on server and client rebuilds it.
- `server/.env.example` and `config.ts` still use some `quickbite` defaults; branding otherwise Roll's & Co.
- Orders cache not persisted for PII.
- `OrderSuccess.tsx` print helpers from `CustomerBill` vs thermal helpers in `lib/thermalPrint.ts`.
- **Fixed 2026-08-11:** StoreStatusControls now syncs review URLs on store switch (was bug). AdminFeedbacks now clears and refetches on storeId change (was bug where old store's feedbacks remained).

---

## 19. Testing Checklist for Agents

### Checkout/order/payment
- [ ] Cart changes reset checkoutIdempotencyKey.
- [ ] Re-click retry checkout reuses idempotency key.
- [ ] Client sends no price/total to `/orders/create`.
- [ ] Server rejects closed/paused stores.
- [ ] Server rejects out-of-stock/unavailable/wrong-store items.
- [ ] Stock decrements on pending order creation, restores on fail/expiry.
- [ ] Webhook and `/orders/verify` idempotent.
- [ ] `/orders/status/:orderId` fails without correct token and now includes feedback field (fetched separately).

### Feedback / Google Rating (NEW)
- [ ] After paid order, order appears in "Your Orders (Last 24 Hours)" on home.
- [ ] Tap order card opens OrderFeedbackModal with Rate on Google + Feedback.
- [ ] Rate on Google opens `googleReviewUrl` if set, else `googleMapsUrl`, else Google search for store name.
- [ ] Feedback: select 1-5 stars, optional comment, submit -> success, then modal shows "Feedback Given" and blocks resubmit.
- [ ] Duplicate feedback POST returns 409, UI shows already submitted.
- [ ] `GET /api/feedback/order/:orderId?token=` returns existing feedback or null.
- [ ] Admin Feedbacks tab per store shows average, distribution, list, filters.
- [ ] Switching store in admin dashboard updates review URL inputs and feedback list (fix verified).
- [ ] Feedback table has no FK to Order, order deletion doesn't fail, feedback retains orderNo.

### Admin URL Rename (NEW)
- [ ] `/adminlog/login` loads AdminLogin, `/adminlog/*` loads dashboard with ProtectedRoute.
- [ ] Old `/admin/login` redirects to `/adminlog/login`, `/admin/*` redirects to `/adminlog`.
- [ ] Header detects `/adminlog` as admin route.
- [ ] ProtectedRoute redirects to `/adminlog/login` on no token.
- [ ] `api.ts` 401 for `/admin` backend paths redirects to `/adminlog/login`.
- [ ] AdminLogin default `from` is `/adminlog`, logout navigates to `/adminlog/login`.

### GST/billing, Admin, UI/cache/offline
- Same as before plus:
- [ ] StoreStatusControls edit review URLs saves via PATCH `/admin/stores/:id/review-url` and updates UI.
- [ ] Admin orders API now merges feedback map, doesn't rely on Order->Feedback relation.
- [ ] Feedbacks visible to Manager and Super Admin with store access enforcement.

---

## 20. Brand / UX Constants

- Brand name: **Roll's & Co.**
- Tagline: **No Empty Bites. Only Loaded Rolls.**
- Footer phrase: **Wrap. Bite. Repeat.**
- Primary color: `#E63946` (`brand-500`)
- Accent color: `#FFC300` (`accent-500`)
- Default admin credentials from seed: `admin@rollsandco.com` / `admin123`
- Seed stores: Boring Road and Kankarbagh, Patna, now with `googleReviewUrl` placeholders
- Prep estimate: 5–10 minutes
- SMS sender: `ROLLCO`
- Admin login URL: **`/adminlog/login`** (changed from `/admin/login` on 2026-08-11)
- Admin dashboard URL: **`/adminlog/*`**
- Feedback UX: 1-5 stars, comment max 1000 chars, one per order, stored without FK to Order
