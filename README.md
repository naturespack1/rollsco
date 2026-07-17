# Roll's & Co. — Restaurant Ordering System

A **mobile-first PWA** for pickup-only restaurant ordering. Built with React + Fastify + PostgreSQL + Prisma + Razorpay + MSG91.

---

## Features

### Customer
- **Store selector** with hero banner and availability badges
- **Category-based menu** (Rolls, Burgers, Beverages, Extras, Combos)
- **Low-stock badges** ("Only 2 left!") and **Bestseller** tags
- **Persistent cart** (localStorage, scoped to selected store)
- **Server-side price validation** — client sends IDs only, server computes GST + total
- **Razorpay checkout** (UPI / Card) with duplicate-payment protection
- **GST-compliant receipt** with CGST / SGST split
- **SMS confirmation** via MSG91 (India)
- **No cancellation** — pickup only, orders are final

### Admin Dashboard
- **JWT login** with role-based access (Super Admin / Manager)
- **Multi-store support** — managers see only assigned stores
- **Active orders** with status pipeline: `Created → Processing → Delivered`
- **Offline-first sync** — status changes buffered locally, pushed via **Fetch button** or **auto-sync** (1/3/5 min)
- **Stock management** — update quantities per item in real time
- **Daily sales export** — Excel (`.xlsx`) download with tax breakdown
- **Bestseller ranking** — top 10 items sold in last 30 days

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, Zustand, React Router |
| Backend | Fastify 4, TypeScript, tsx (dev runtime) |
| Database | PostgreSQL |
| ORM | Prisma 5 |
| Payments | Razorpay (Orders API + Webhooks) |
| SMS | MSG91 Flow API |
| Export | ExcelJS |
| PWA | `vite-plugin-pwa` with Workbox caching |

---

## Prerequisites

- **Node.js** 18+ (with `npm` or `yarn`)
- **PostgreSQL** 14+ (local instance or Docker)
- **Razorpay Account** (Test mode keys for development)
- **MSG91 Account** (optional — SMS will log to console if skipped)

---

## Quick Start (Local Development)

### 1. Clone & Install

```bash
git clone <repo-url>
cd restaurant-app
npm install
```

This installs root workspace dependencies plus both `server` and `client` packages.

### 2. Configure Environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env` with your credentials:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/rollsandco?schema=public"
RAZORPAY_KEY_ID="rzp_test_xxxxxxxx"
RAZORPAY_KEY_SECRET="xxxxxxxx"
RAZORPAY_WEBHOOK_SECRET="whsec_xxxxxxxx"
JWT_SECRET="any-strong-random-string"
MSG91_AUTHKEY=""                          # optional for dev
MSG91_SENDERID="ROLLCO"
MSG91_TEMPLATE_ID="order_confirmation"
ADMIN_DEFAULT_EMAIL="admin@rollsandco.com"
ADMIN_DEFAULT_PASSWORD="admin123"
PORT=3000
```

> **Razorpay Test Keys**: Get them from [Razorpay Dashboard](https://dashboard.razorpay.com/) → Settings → API Keys.

> **Razorpay Webhook Secret**: For local dev, use a tunnel like `ngrok` or set a dummy value. Webhooks are only needed for production-style payment flow testing.

### 3. Setup Database

Make sure PostgreSQL is running and the `rollsandco` database exists.

```bash
# Push Prisma schema to database
npm run db:push

# Seed with placeholder data (stores, menu items, combos, admin user)
npm run db:seed
```

This creates:
- 2 stores: **Roll's & Co. Koramangala**, **Roll's & Co. HSR Layout**
- 12 items + 2 combos across 5 categories
- 1 admin user: `admin@rollsandco.com` / `admin123` (Super Admin)

### 4. Run Development Servers

**Option A: Run both (recommended)**

Open **two terminal tabs** from the root `restaurant-app/` folder:

```bash
# Terminal 1 — Backend (port 3000)
npm run dev:server
```

```bash
# Terminal 2 — Frontend (port 5173)
npm run dev:client
```

**Option B: Run individually**

```bash
cd server
npm run dev          # http://localhost:3000
```

```bash
cd client
npm run dev          # http://localhost:5173
```

The Vite dev server proxies `/api/*` requests to `http://localhost:3000` automatically (see `client/vite.config.ts`).

### 5. Access the App

| URL | Purpose |
|-----|---------|
| `http://localhost:5173` | Customer ordering app |
| `http://localhost:5173/admin/login` | Admin dashboard login |
| `http://localhost:3000/health` | API health check |

**Default Admin Login**
- Email: `admin@rollsandco.com`
- Password: `admin123`

---

## Production Build

```bash
# Build both frontend and backend
npm run build
```

The client builds into `client/dist/`. The server builds into `server/dist/` (though for production you typically run the server with `tsx` or a compiled bundle).

### Production Deployment Notes

1. **Serve the PWA**: The Fastify server should serve the `client/dist/` static files, or deploy the frontend to a CDN (Vercel/Netlify) and point API calls to your backend.

2. **Razorpay Webhooks**: In production, set your Razorpay webhook URL to:
   ```
   https://your-domain.com/api/webhooks/razorpay
   ```
   Enable events: `payment.captured`, `payment.failed`, `order.paid`.

3. **Database**: Use a managed PostgreSQL service (Supabase, AWS RDS, Railway, etc.).

4. **Environment**: Ensure `RAZORPAY_WEBHOOK_SECRET` is set to the value shown in Razorpay Dashboard.

5. **Cron Jobs** (critical for production):
   - **Order expiry**: Call `expireOldPendingOrders()` every 5 minutes to release stock from abandoned carts.
   - **Webhook reconciliation**: Poll Razorpay for `PENDING` orders older than 5 minutes to catch missed webhooks.

6. **Rate Limiting**: Install `@fastify/rate-limit` on checkout and login routes before going live.

---

## Project Structure

```
restaurant-app/
├── package.json              # Workspace root
├── README.md
├── context.md                # Full agent context / architecture reference
├── server/
│   ├── src/
│   │   ├── index.ts          # Fastify app bootstrap
│   │   ├── config.ts         # Env variable loader
│   │   ├── prismaClient.ts   # Prisma singleton
│   │   ├── routes/           # API route handlers
│   │   ├── services/         # Business logic (orders, payments, SMS, exports)
│   │   ├── plugins/          # Fastify plugins (auth, error handler)
│   │   └── utils/            # Helpers (GST calc, order number generator)
│   ├── prisma/
│   │   ├── schema.prisma     # Database schema
│   │   └── seed.ts           # Seed script with demo data
│   └── .env.example
└── client/
    ├── index.html            # App shell (PWA manifest, theme-color, font preconnect)
    ├── vite.config.ts        # Vite + PWA plugin + proxy config
    ├── public/
    │   ├── manifest.json     # PWA manifest
    │   ├── icons/            # PWA icons
    │   └── images/           # Category/menu images
    └── src/
        ├── App.tsx           # Route definitions
        ├── main.tsx          # React root
        ├── pages/            # Customer + Admin pages
        ├── components/       # Reusable UI components
        ├── store/            # Zustand stores (cart, store, admin)
        ├── lib/              # API client, utilities, Razorpay loader
        └── types/            # TypeScript type definitions
```

---

## Important Security Behaviors

| Feature | How it works |
|---------|--------------|
| **Price tampering** | Client never sends `price`. Server fetches DB prices, computes total + GST, and creates a Razorpay order for that exact amount. |
| **Duplicate payments** | `razorpayOrderId` is unique on `Order`. Webhook handler returns `200` immediately if `paymentStatus === 'PAID'`. |
| **Stock race condition** | Prisma transaction with `Serializable` isolation. Stock is deducted **before** Razorpay order is created. Restored on failure. |
| **Cart persistence** | Stored in `localStorage` under key `quickbite-cart`. Scoped to store. Cleared on payment success or store change. |
| **Admin access** | JWT tokens with 7-day expiry. Managers can only access assigned stores via `AdminStore` junction table. |

---

## Troubleshooting

### "Failed to load Razorpay" during checkout
- Ensure `RAZORPAY_KEY_ID` is set in `.env` and valid.
- Check browser console for network errors loading `checkout.razorpay.com`.

### Orders stuck in "PENDING"
- In development, webhooks may not arrive if Razorpay cannot reach your localhost. Use `ngrok` to expose your local server, or manually poll `/api/orders/status/:orderId` after payment.
- The `expireOldPendingOrders()` function exists but is **not automatically scheduled** in dev. Call it manually or add a cron job.

### Admin login fails with 401
- Ensure `server/.env` has `ADMIN_DEFAULT_EMAIL` and `ADMIN_DEFAULT_PASSWORD` matching the seeded values.
- If you changed `.env` after seeding, re-run `npm run db:seed` (⚠️ this wipes orders/data).

### Database connection errors
- Verify `DATABASE_URL` in `server/.env`.
- Ensure PostgreSQL is running and the database exists.
- Run `npx prisma db push` from the `server/` directory if schema changes were made.

### `Unknown field 'basePrice' for select statement on model 'OrderItem'`
This happens when the Prisma Client was generated before the `OrderItem` schema had `basePrice`, `baseTotal`, and `gstRate` fields. Fix it by regenerating the client and pushing schema changes to the database:

```bash
cd server
npx prisma db push
npx prisma generate
```
Then restart the server.

---

## License

Private — for Roll's & Co. internal use.


# Reset database with new schema
npx prisma db push --force-reset
npx prisma db seed

# Start servers
npm run dev