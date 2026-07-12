# Rolls & Co. — In-depth Code Review

**Scope:** Static review of the current repository (server, client, Prisma schema, PWA configuration, and package metadata), including the current working-tree dashboard-filter and role-visibility changes.

**Validation performed**

- `npm ci && npm run build` — **passed** for server and client.
- There are **no automated test or lint scripts** in the package manifests.
- `npm audit --omit=dev` reports **9 production dependency findings: 1 critical, 5 high, 3 moderate**. The critical finding is in the `fast-jwt` dependency pulled by `@fastify/jwt`.

> This is a source review, not a penetration test or payment-provider integration test. It identifies the issues visible from the code and does not prove the absence of other issues.

---

## Executive summary

The application has a sound start in several areas: prices are recalculated on the server, item availability is checked in the order service, role/store assignment exists, and Razorpay client signatures are checked server-side.

However, it is **not production-ready for payments or customer PII** yet. The most urgent issues are: insecure fallback secrets, publicly enumerable receipts containing customer data, non-revocable super-admin tokens, payment/inventory state races, no rate limits or pending-order expiry job, and a webhook implementation that verifies a reconstructed—not raw—request body.

### Release recommendation

**Do not launch publicly until all P0 items below are resolved.** At minimum, fix secret handling, receipt authorization, active-admin verification, order-state transitions/inventory reconciliation, rate limiting/expiry, raw webhook verification, and database migration discipline.

---

## Findings by severity

### Critical

| ID | Finding | Evidence | Risk and recommended fix |
|---|---|---|---|
| C-01 | **Production can silently run with a known JWT secret and default admin credentials.** | `server/src/config.ts:3,7,11-12` falls back to `dev-secret-change-me` and `admin123`. | If an environment variable is absent or deployment configuration is wrong, an attacker can forge admin JWTs or log in with a known password. Validate all production secrets at startup; fail closed when `NODE_ENV=production`; remove credential defaults entirely; require a long random `JWT_SECRET`. |
| C-02 | **Public, predictable receipt endpoint leaks customer PII.** | `GET /api/orders/receipt/:orderNo` in `server/src/routes/order.ts:71-83` returns customer phone, name, message, item list and total. `generateOrderNumber()` builds predictable `R-YYMMDD-NNN` values in `server/src/utils/orderNumber.ts`. | Anyone can enumerate order numbers for a date and retrieve other customers’ phone numbers and orders. Replace this with a high-entropy, per-order receipt token or authenticated/OTP-protected access. Return the minimum data required. Do not use the sequential order number as an authorization secret. |
| C-03 | **Deleted or demoted super-admin sessions remain super-admin sessions for up to seven days.** | `server/src/plugins/auth.ts:14-26` trusts `role` from JWT and only reloads store links. `enforceStoreAccess()` bypasses all store checks when that stale role is `SUPER_ADMIN` (`adminDashboard.ts:82-88`). | Deleting an admin removes their store links, but a previously issued super-admin token still bypasses access checks. Reload the `AdminUser` row on each authenticated request (or use a token version/session table), reject missing/disabled users, and use the current DB role—not the token claim—for authorization. |
| C-04 | **A failed/expired order can later be marked paid after stock was restored.** | `failOrder()` restores inventory and changes `PENDING → FAILED` (`orderService.ts:224-245`). `markOrderPaid()` changes *any non-PAID* order, including `FAILED`, to `PAID` without re-reserving stock (`orderService.ts:205-220`). | A payment received after the 15-minute expiration (or after a failed event race) can create a paid order while stock has already been returned, producing overselling and financial/inventory inconsistency. Enforce one atomic state transition `PENDING → PAID`; reject/flag payment after `FAILED`; reconcile/refund through an explicit workflow. |
| C-05 | **Inventory can be trivially denied through unpaid pending orders.** | Public `/api/orders/create` reserves stock before payment (`order.ts:23-54`, `orderService.ts:139-175`). There is no rate limit, and `expireOldPendingOrders()` is never scheduled (`orderService.ts:248+`; README explicitly notes this). | An attacker can submit many carts with arbitrary 10-digit numbers, reserve all stock, and abandon payment. Pending orders may reserve stock indefinitely. Add IP/phone/device rate limits, CAPTCHA or abuse controls, idempotency, a reliable scheduled expiry worker, monitoring, and a short, well-defined payment reservation policy. |
| C-06 | **Razorpay webhook signature verification is likely unreliable because it uses a re-serialized body.** | `server/src/routes/webhook.ts:8-17` calculates `JSON.stringify(request.body)` before HMAC verification. Razorpay signs the exact raw request payload. | Whitespace, escaping, or parser differences change bytes and make valid webhooks fail verification. Configure Fastify to preserve the raw body for this route and verify the raw bytes using `crypto.timingSafeEqual`. Validate the event schema after verification. |

### High

| ID | Finding | Evidence | Risk and recommended fix |
|---|---|---|---|
| H-01 | **Menu/Reports are only hidden in the UI; server authorization still permits manager access to sensitive actions.** | The dashboard hides tabs for managers, but `PUT /api/admin/items` and `DELETE /api/admin/items/:id` only call store access checks (`adminDashboard.ts:298-320`). Report endpoints only check store access (`:389-465`). | A manager can call APIs directly to change price, GST, availability, or delete menu items for an assigned store and can retrieve report/export data. Enforce `SUPER_ADMIN` server-side on every endpoint matching the policy. Keep a separate read-only menu endpoint for the in-store ordering page if managers need it. |
| H-02 | **Order numbers are generated with a non-atomic daily count.** | `generateOrderNumber()` counts orders, then returns `count + 1` (`server/src/utils/orderNumber.ts:3-17`), and it uses the global Prisma client while another transaction is open. | Concurrent orders can receive the same `orderNo`, cause a unique constraint failure, and fail checkout. Use a database sequence, a per-day counter table updated atomically, or make the public number include a random suffix. Use one transaction/connection. |
| H-03 | **No real idempotency exists for order creation.** | `idempotencyKey` is generated server-side from order number/time (`orderService.ts:106`), but `/orders/create` accepts no client idempotency key and never checks/replays one. | Browser retries, double submits, load balancer retries, or payment re-entry can create multiple pending payment orders and reserve stock multiple times. Accept a validated `Idempotency-Key`, store a request fingerprint and response, and make creation/replay atomic. |
| H-04 | **Stock updates are lost under concurrent operations.** | Order placement reads stock then decrements (`orderService.ts:53-80`); admin stock editing writes an absolute number (`adminDashboard.ts:227-237`); the client uses optimistic absolute writes (`AdminStock.tsx:108-126`). | A manager may overwrite a concurrent sale’s decrement, or a concurrent sale may make displayed stock incorrect. Use conditional SQL updates (`stock >= quantity`), an inventory ledger, row versioning/optimistic concurrency, and explicit adjustment transactions. Retry serialization failures safely. |
| H-05 | **Login and public order endpoints have no rate limiting or abuse defense.** | Server registration in `server/src/index.ts:16-31` has no rate-limit plugin; login and checkout routes are public. | Enables credential stuffing, password guessing, order/inventory DoS, receipt enumeration, and report/export load. Add `@fastify/rate-limit`, route-specific limits, progressive delays, structured security logs, and ideally CAPTCHA/device controls on public checkout creation. |
| H-06 | **Admin JWT is stored in `localStorage`.** | `client/src/lib/api.ts:14`, `AdminLogin.tsx:27`, and `useAdminStore.ts`. | Any XSS can steal a seven-day bearer token. Prefer short-lived access tokens with refresh tokens in Secure, HttpOnly, SameSite cookies, add CSP, and minimize token lifetime. If bearer tokens remain, use strict CSP and strong XSS hygiene. |
| H-07 | **Database migration approach is inconsistent and unsafe for production.** | The repo uses `prisma db push`, has no baseline migration, yet contains only `20260712000000_rename_cash_payment_method_to_instore/migration.sql`, which assumes an existing `PaymentMethod.CASH` enum. | `migrate deploy` on a fresh DB fails because the enum does not exist; `db push` does not apply migration files. This causes schema drift such as the observed missing `paymentMethod` column. Create an initial migration from the full schema, use `prisma migrate deploy` in CI/production, and reserve `db push` for local development only. |
| H-08 | **Destructive seed script can erase production data.** | `server/prisma/seed.ts:7-13` deletes all orders, items, categories, admins, and stores before inserting sample data; it also creates `admin123` (`:22-28`). | One accidental seed command against production destroys operational and financial data. Split demo seed from production bootstrap, require an explicit non-production guard/confirmation, and never ship a known production password. |
| H-09 | **Current production dependency tree has known vulnerabilities.** | `npm audit --omit=dev`: 1 critical (`fast-jwt` via `@fastify/jwt`), 5 high (Fastify/`fast-uri` chain), 3 moderate (including `exceljs`/`uuid`). | Upgrade dependencies deliberately—especially `@fastify/jwt` and Fastify—to supported versions, review their breaking changes, update lockfiles, and run integration tests. Do not blindly use `npm audit fix --force` without testing. |
| H-10 | **The webhook intentionally suppresses retries on internal failure.** | `webhook.ts:49-52` returns HTTP 200 with an internal warning after a processing error. | A temporary DB outage or processing bug can permanently lose payment reconciliation because Razorpay will not retry. Return a retryable 5xx for transient failures; use an idempotent event ledger and a reconciliation job. Do not include raw error messages in webhook responses. |

### Medium

| ID | Finding | Evidence | Risk and recommended fix |
|---|---|---|---|
| M-01 | **Malformed client input often becomes a 500 rather than a clear 400.** | Routes call Zod `.parse()`, but `errorHandler.ts` has no `ZodError` branch. | Normal invalid input may be logged as internal failure and receive 500. Add a `ZodError` handler returning a generic 400 with structured field errors; never expose stack/internal messages. |
| M-02 | **Customer input is insufficiently bounded/validated.** | Customer `customerName` has no max length (`order.ts:9-19`); phone accepts any 10–15 characters; carts have no maximum number of distinct items. | Enables oversized payloads, poor SMS quality, transaction pressure, and possible data-quality issues. Use strict trim/max constraints, country-aware phone validation, a cart line count limit, a total amount limit, and a body-size limit. |
| M-03 | **Stale PWA store caching undermines open/close and order acceptance controls.** | Stores/menu use `StaleWhileRevalidate` for five minutes (`client/vite.config.ts:21-26`). Selected store state persists locally; menu loading does not re-check availability (`MenuPage.tsx`). | A closed store may appear open or a customer may browse/add items after status changes, only failing at checkout. Do not cache availability-sensitive store status this way; revalidate before menu/checkout and show a clear closed/paused state. |
| M-04 | **“Offline stock/menu save” is misleading; failed writes are not queued or replayed.** | `AdminStock.tsx:112-123` updates local cache then says it “will sync when online”, but no pending stock mutation queue exists. `AdminMenu.tsx` makes a similar claim. | Staff can believe stock/menu changes were saved when the server never receives them. Either implement a durable mutation outbox with conflict handling or revert optimistic state and clearly say the update failed. |
| M-05 | **Order status transitions are unconstrained and unaudited.** | `/orders/sync` accepts any enum status for any order (`adminDashboard.ts:181-211`); no transition rules or actor/timestamp history exist. | Orders can move backwards (Delivered → Created), and there is no accountability. Model allowed transitions, write an order-status history/audit table, record actor and time, and make updates idempotent. |
| M-06 | **Reports/export use server timezone and have misleading line-level totals.** | `generateDailySalesExcel()` uses server-local date bounds and repeats each order’s CGST/SGST/grand total for every line item (`exportService.ts`). | “Today” differs from store/business timezone; summing exported rows overstates tax and revenue. Store an IANA timezone per store, calculate boundaries in that timezone, and create separate order-summary and item-detail worksheets or allocate tax per line. |
| M-07 | **Report query input and export date are weakly validated.** | `bestsellers` uses unclamped `parseInt`; export uses `new Date(dateStr)` without validating the date (`adminDashboard.ts:389-465`). | `NaN`, negative days, unexpected all-time queries, or invalid dates can generate incorrect/expensive reports or server errors. Validate with Zod and strict ISO date parsing; cap report windows and pagination. |
| M-08 | **The receipt/print HTML has a formula-injection-adjacent export risk and duplicated rendering logic.** | Excel writes item names directly (`exportService.ts`); `CustomerBill.tsx` and `BillPrint.tsx` duplicate long HTML templates. | Spreadsheet cells beginning `=`, `+`, `-`, or `@` can be interpreted as formulas when opened. Prefix untrusted text with `'`. Consolidate bill rendering into one tested template to prevent divergent tax/payment output. |
| M-09 | **Item deletion is a poor fit for historical orders.** | `DELETE /admin/items/:itemId` hard-deletes a referenced item (`adminDashboard.ts:312-319`); `OrderItem.item` is a required relation in the schema. | Existing order-item records usually block deletion (P2003), and even if behavior changes it compromises historical traceability. Soft-archive items (`isAvailable`/`archivedAt`) rather than delete sold products. |
| M-10 | **Production source maps are publicly built.** | `client/vite.config.ts:40-43` sets `sourcemap: true`. | It exposes implementation details and makes client-side endpoint/logic discovery easier. Disable public production maps or upload them privately to error monitoring. |
| M-11 | **CORS and proxy trust are overly broad.** | `cors({ origin: true, credentials: true })` and `trustProxy: true` in `server/index.ts:16-22`. | Any origin is accepted; future cookie auth becomes vulnerable, and arbitrary forwarded headers can be trusted when not behind a known proxy. Use an explicit production origin allowlist and trusted-proxy configuration. |
| M-12 | **Security headers are absent.** | No Helmet/security-header registration in server setup; client also loads third-party scripts/fonts. | Missing CSP, HSTS, clickjacking, MIME-sniffing, and referrer controls increase XSS/clickjacking exposure. Add `@fastify/helmet`, a restrictive CSP (including Razorpay and required font sources), HSTS on HTTPS, and `Referrer-Policy`. |
| M-13 | **Payment state lacks durable reconciliation and audit data.** | `fetchPayment()` is unused; cash orders record no cashier/admin ID; payment events are not stored. | Payment provider disputes and cash discrepancies cannot be reliably investigated. Add `PaymentAttempt`/webhook-event and cash-drawer/audit models; reconcile Razorpay against pending/failed orders on a schedule. |
| M-14 | **Order data and admin cache containing PII persist in browser storage.** | Admin/customer Zustand stores persist orders and tokens (`useAdminCacheStore.ts`, `useCustomerOrdersStore.ts`, `useAdminStore.ts`). | Shared or compromised devices retain phone numbers, order details, and tokens. Minimize stored data, enforce expiry/purge on rehydration, clear it on logout, avoid storing sensitive fields where possible, and consider device/session policy. |

### Low / quality / UX issues

| ID | Finding | Evidence and recommendation |
|---|---|---|
| L-01 | The checkout displays `Subtotal` twice, both as the pre-tax amount. | `CheckoutPage.tsx:145-153`. Remove the duplicate or label one correctly. |
| L-02 | Cart drawer can increment quantity beyond current stock. | `CartDrawer.tsx:30-42` uses `updateQuantity` without a stock cap; the Zustand store does not enforce one. The server correctly rejects it, but the UI allows an invalid cart. Pass stock to the cart controls and cap quantity client-side as a usability improvement. |
| L-03 | Dashboard store fetch lacks an error path. | `AdminDashboard.tsx` only has `.then()` for `/stores`; a failure can leave an infinite spinner. Add `catch`, retry, and an error state. |
| L-04 | Staff/menu fetch failures are swallowed. | `AdminStaff.tsx` ignores errors; `AdminMenu`/`AdminStock` report “offline” even for authorization/server failures. Show actionable errors and distinguish offline from 401/403/5xx. |
| L-05 | Store availability UX is stale after a store is selected. | Persistent selected store plus cached store list can lead to menu browsing for a paused store. Re-fetch on entry and before checkout. |
| L-06 | `index.html` disables pinch zoom and references Vite’s default favicon. | `maximum-scale=1.0, user-scalable=no` harms accessibility; `/vite.svg` is not a product favicon. Allow zoom and use the supplied app icon. |
| L-07 | Multiple `any` types and duplicated strings reduce safety. | Admin dashboard/routes/cache use `any`; client `Order` assumes numeric fields while Prisma may serialize Decimal values differently. Add shared API DTOs, typed query schemas, and strict TypeScript on the server. |
| L-08 | There is no root `.gitignore`. | Git previously tracked `client/node_modules`; `git check-ignore` shows `.env` is not ignored. Add rules for `node_modules/`, `dist/`, `.env*` except examples, logs, coverage, and local Prisma artifacts. |
| L-09 | No tests/lint/CI guardrails exist. | Package scripts contain no test/lint commands. Add unit tests for GST/state transitions, Fastify route/integration tests, webhook signature fixtures, authorization tests, migration smoke tests, Playwright/Cypress critical flows, ESLint, and CI. |
| L-10 | “Today” semantics differ across features. | Bestsellers/payment summary use rolling 24-hour windows, export uses server calendar date. Define one business timezone and consistent inclusive/exclusive date rules. |

---

## Positive observations

- The server calculates prices and GST from database item values instead of trusting client prices.
- Duplicate item IDs are normalized in the order service, and per-item quantity is capped.
- Store access is checked for many admin actions.
- Passwords are hashed with bcrypt rather than stored as plaintext.
- Razorpay checkout response signatures are verified server-side before the client verification path marks an order paid.
- The new payment-method summary groups only `PAID` orders and uses Prisma `groupBy`, not unsafe string-concatenated SQL.
- The raw SQL in the bestseller route uses Prisma’s tagged-template parameter binding, so its `storeId` and date interpolation is not SQL injection.

These strengths should be retained while the issues above are fixed.

---

## Prioritized remediation plan

### P0 — before public/payment launch

1. Require production environment variables; remove fallback JWT/admin credentials; rotate any existing secrets.
2. Protect receipts/order status with a high-entropy receipt token or authenticated/OTP access; remove public PII enumeration.
3. Fix authentication revocation: load current admin state/role, add disabled/token-version/session revocation, shorten access-token lifetime.
4. Rebuild payment state handling as an explicit state machine. Never transition `FAILED` to `PAID` without re-reserving inventory/reconciliation.
5. Add rate limits, idempotency keys, cart caps, a pending-order expiration worker, and monitoring.
6. Capture/verify the raw Razorpay webhook body; persist idempotent webhook events and return retryable errors for transient failures.
7. Enforce Super Admin authorization on the server for menu mutations and report/export endpoints.
8. Establish a real Prisma migration baseline and production `migrate deploy` process; do not use `db push` in production.
9. Update vulnerable dependencies and regression-test the Fastify/JWT major-version upgrade.

### P1 — next iteration

1. Implement inventory ledger/conditional stock updates plus a cash-order audit (who, terminal, shift, payment evidence).
2. Make report/export dates timezone-aware and correct the per-line spreadsheet totals.
3. Fix the order-number sequence atomically.
4. Add strict Zod error responses, query/date validation, body limits, and safe error mapping.
5. Replace misleading offline writes with a durable outbox or immediate rollback.
6. Add CSP/security headers, CORS allowlist, explicit proxy trust, and disable public source maps.
7. Add soft deletion/archiving for menu items.

### P2 — quality and maintainability

1. Consolidate print/bill generation and introduce shared typed API contracts.
2. Remove duplicate checkout subtotal, improve closed-store flow, and enforce cart quantity in all UI controls.
3. Add `.gitignore`, linting, formatting, unit/integration/E2E tests, dependency update automation, and CI.
4. Add health/readiness checks, structured audit logs, reconciliation alerts, backups, and retention policies for customer data.

---

## Commands run

```bash
npm ci
npm run build
npm audit --omit=dev
```

The build passed. The audit output should be treated as a dependency-upgrade work item, not fixed by an unreviewed forced upgrade.
