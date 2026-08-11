# New Feature: 24h Order History with Google Rating & Feedback

Implemented as per requirements.

## Customer Flow

1. **After completing order**, order is saved locally in `rolls-customer-orders` Zustand store (24h expiry). This already existed.
2. **Home Screen `/` (StoreSelector)** shows "Your Orders (Last 24 Hours)" section.
   - Each order card is now **clickable** and shows:
     - Bill, Receipt (existing)
     - **Rate on Google** – opens store's Google review URL
     - **Give Feedback** – opens feedback modal
   - Shows feedback status badge if already given (e.g., 5/5).
   - Tap card → opens detailed modal with 2 options.

3. **OrderFeedbackModal** (`client/src/components/OrderFeedbackModal.tsx`)
   - Shows order summary (items, total)
   - **Card 1: Rate us on Google Maps**
     - Uses `store.googleReviewUrl` if set, else `googleMapsUrl`, else Google Maps search for store name.
     - Opens in new tab `_blank`.
   - **Card 2: Share your feedback**
     - If feedback already exists: shows rating stars + comment + "can't submit again" message.
     - If not: click "Give Feedback" → rating 1-5 stars with hover effect + optional comment (max 1000 chars) → POST to `/api/feedback`
     - Prevents duplicate per order (409 if exists).
   - Fetches existing feedback via `GET /api/feedback/order/:orderId?token=...`

## Backend Changes

### Prisma Schema (`server/prisma/schema.prisma`)
- **Store** added:
  - `googleReviewUrl String?` – direct Google review link (e.g., `https://search.google.com/local/writereview?placeid=...`)
  - `googleMapsUrl String?` – fallback Maps URL
  - `feedbacks Feedback[]` relation
- **Order** added:
  - `feedback Feedback?` one-to-one
- **New Model `Feedback`**:
  ```prisma
  model Feedback {
    id            String   @id @default(uuid())
    orderId       String   @unique
    storeId       String
    rating        Int  // 1..5
    comment       String? @db.Text
    customerPhone String?
    customerName  String?
    createdAt     DateTime @default(now())
    updatedAt     DateTime @updatedAt
    order         Order @relation(...)
    store         Store @relation(...)
  }
  ```

### Routes
- **Public Feedback Routes** (`server/src/routes/feedback.ts`, prefix `/api/feedback`):
  - `POST /api/feedback` body `{orderId, token, rating, comment?}`
    - Validates order ownership via `customerAccessToken`
    - Allows only PAID orders
    - Returns 409 if feedback already exists
  - `GET /api/feedback/order/:orderId?token=...` → returns existing feedback or null

- **Admin Feedback Routes** added to `adminDashboard.ts`:
  - `GET /api/admin/feedbacks?storeId=&page=&limit=&rating=&from=&to=` – list with pagination, average, distribution
  - `GET /api/admin/feedbacks/stats?storeId=&days=` – stats for dashboard
  - `PATCH /api/admin/stores/:storeId/review-url` – Super Admin can set googleReviewUrl / googleMapsUrl

- **Store routes** (`store.ts`): now return `googleReviewUrl` and `googleMapsUrl`
- **Order status route**: now includes `feedback` and `store.googleReviewUrl`

### Seed
- Updated `server/prisma/seed.ts` to include placeholder Google review URLs
- Clean up order: deletes `feedback` first

## Admin Dashboard

- **New Tab "Feedbacks"** (`client/src/pages/admin/AdminFeedbacks.tsx`)
  - Available to **both Manager and Super Admin** (scoped to assigned stores)
  - Stats:
    - Average rating
    - Distribution bar (1-5 stars)
    - Insights (positive vs critical)
  - Filters: All Time / 24h / 7d / 30d, plus rating filter
  - List shows:
    - Order No, rating stars, payment method, date
    - Comment (if any)
    - Customer name/phone, total, ordered date
    - Store name
    - Badge: Positive (>=4), Neutral (3), Critical (<3)
  - Pagination (20 per page)

- **StoreStatusControls** (`client/src/components/StoreStatusControls.tsx`):
  - Super Admin sees Google Review Settings section to edit URLs
  - PATCH endpoint called, updates store state optimistically

## Frontend Types (`client/src/types/index.ts`)
- `Store` now has `googleReviewUrl?`, `googleMapsUrl?`
- Added `Feedback` interface
- `Order` now has `store.googleReviewUrl?`, `feedback?`

## Client Updates
- `StoreSelector.tsx`:
  - Added fetching of feedback status per recent order via `/feedback/order/:id`
  - Added `OrderFeedbackModal` state handling
  - Recent order cards clickable + new 2-button grid (Rate Google / Feedback)
  - Feedback button disabled with green badge if already given

## How to Test Locally

1. **Apply DB changes**:
   ```bash
   cd server
   npx prisma db push
   # or if you want clean seed
   npx prisma db push --force-reset
   npm run db:seed
   ```
2. **Set Review URLs** (Super Admin):
   - Login as admin `/admin/login`
   - Select store → under Store controls → edit Google Review URLs and save
   - Example review URL: `https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4` (or your actual Place ID)
   - To get Place ID: Google Maps → Share → Place ID finder https://developers.google.com/maps/documentation/places/web-service/place-id

3. **Customer flow**:
   - Create an order via checkout (or via Admin → New Order for instore)
   - After payment, you'll be redirected to home with "Order Placed!" banner
   - Below store list, see "Your Orders (Last 24 Hours)"
   - Tap any order → modal with Rate on Google + Feedback
   - Rate → opens new tab
   - Feedback → select stars, add comment, submit
   - After submit, try again → shows "Feedback Given" and blocks second submission

4. **Admin view**:
   - `/admin/login` → Feedbacks tab
   - See stats, filter, and list

## Preventing Duplicate Feedback
- DB constraint: `@unique` on `orderId` in Feedback
- API guard: check `order.feedback` before create → 409
- UI guard: feedback button disabled + modal shows existing feedback + message "You can't submit feedback again"

## Future Improvements
- Add average rating to Store model and update on feedback create
- Show feedbacks in AdminOrders tab as icon
- Allow admin to reply to feedback
- Send email/SMS after feedback with thank you + coupon

## Files Changed
- `server/prisma/schema.prisma`
- `server/prisma/seed.ts`
- `server/src/routes/store.ts`
- `server/src/routes/order.ts`
- `server/src/routes/feedback.ts` (new)
- `server/src/routes/adminDashboard.ts`
- `server/src/index.ts`
- `client/src/types/index.ts`
- `client/src/components/OrderFeedbackModal.tsx` (new)
- `client/src/components/StoreStatusControls.tsx`
- `client/src/pages/StoreSelector.tsx`
- `client/src/pages/admin/AdminDashboard.tsx`
- `client/src/pages/admin/AdminFeedbacks.tsx` (new)

Build verified: `npm run build -w server` and `npm run build -w client` both pass.
