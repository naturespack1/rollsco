# Rolls & Co. — Tagline Integration Guide

All 5 taglines are now live across the website, mapped to psychology + placement.

### The Taglines (Locked)

| Tagline | Role | Verdict |
|---|---|---|
| **No Empty Bites. Only Loaded Rolls.** | PRIMARY BRAND TAGLINE | ✅ LOCK - Hero, SEO, receipts |
| **We Don't Roll Small** | SECONDARY / BRAND VOICE | 🔥 Confident, youth - Header, bios, footers |
| **Rolls So Big, You Need Two Hands** | LAUNCH / VIRAL CAMPAIGN | 🎬 Reels, blackboard, UGC hook |
| **Warning: Extremely Loaded** | PACKAGING / STICKER / REEL HOOK | ⚡ Edgy Gen-Z, cups, bags |
| **Wrap. Bite. Repeat.** | LOYALTY / HABIT TAGLINE | 🔄 Stamp cards, checkout, receipt |

---

### 1. Landing / StoreSelector (`/` before store selection)
**File:** `client/src/pages/StoreSelector.tsx`

- **Top:** `BrandMarquee` infinite ticker: ⚡ WARNING + 🙌 TWO HANDS + 🔥 WE DON'T ROLL SMALL + 🔄 WRAP BITE REPEAT + ❌ NO EMPTY BITES (loop)
- **Hero (black card):** Primary locked as H1: 
  ```
  No Empty Bites.
  Only Loaded Rolls. [brand-500]
  ```
  Badge: `We Don't Roll Small • SECONDARY TAGLINE`
  Sub-copy: Solves a real street-food doubt...
  Social proof pills: 4.8 rating + Warning: Extremely Loaded

- **3 Image Cards:** Re-written from generic to tagline-driven:
  - Rolls.jpg = No Empty Bites / Only Loaded Rolls
  - Burgers.jpg = Warning: Extremely Loaded
  - Combos.jpg = Two Hands Needed (Viral)

- **Viral Strip:** Full dedicated section for `Rolls So Big, You Need Two Hands 🎬` with hashtags #TwoHandsNeeded #ExtremelyLoaded #NoEmptyBites

- **Store list header:** `Select Store` + `We Don't Roll Small → Only Loaded Locations`
- **Store cards:** Added micro-copy `⚡ Warning: Extremely Loaded in this store`

- **Trust grid (2 col):** 
  - Left: Packaging / Sticker → Warning: Extremely Loaded
  - Right: Loyalty / Habit → Wrap. Bite. Repeat.

- **Footer:** `BrandFooter.tsx` → Ac-cent strip Wrap. Bite. Repeat. + Main footer No Empty Bites... + pills We Don't Roll Small / Extremely Loaded / Two Hands Needed

### 2. Menu Page (`/` after store selection)
**File:** `client/src/pages/MenuPage.tsx`

- **Sticky black strip under header:** LEFT = ⚡ Extremely Loaded + No Empty Bites. Only Loaded Rolls.  RIGHT = WRAP. BITE. REPEAT.
- **Campaign banner:** Yellow card: `Rolls So Big, You Need Two Hands 🙌`
- **MenuItemCard.tsx:** If category contains 'roll', overlay badge `⚡ Extremely Loaded`

### 3. Header (Global)
**File:** `client/src/components/Header.tsx`

- Desktop: Under ROLLS & CO. logo → `No Empty Bites. Only Loaded Rolls.` in 8.5px brand color
- Bold 900 font for logo to match tagline energy

### 4. Cart (Desktop + Mobile)
**Files:** `CartDrawer.tsx`, `MobileCart.tsx`

- Desktop: Header shows `We Don't Roll Small` + badge `Extremely Loaded`. Inside: black card `No Empty Bites. Only Loaded Rolls.` + CTA button `Wrap. Bite. Repeat. →` + footer note `Rolls So Big, You Need Two Hands`
- Mobile: Top mini ticker `No Empty Bites. Only Loaded Rolls. • Extremely Loaded` + item count `We Don't Roll Small` + total footer `Wrap. Bite. Repeat.`

### 5. Checkout Page (`/checkout`)
**File:** `CheckoutPage.tsx`

- **Hero black card:** Brand promise → No Empty Bites / Only Loaded Rolls + We Don't Roll Small
- **CTA button:** `Pay ₹XXX • Wrap. Bite. Repeat.`
- **Loyalty footer:** Yellow card `Wrap. Bite. Repeat. 🔄` + `Rolls So Big... We Don't Roll Small`
- **Micro footer:** `⚡ Warning: Extremely Loaded • No Empty Bites...`

### 6. Order Success (`/success/:id`)
**File:** `OrderSuccess.tsx`

- Top badge: `⚡ Warning: Extremely Loaded • PAID`
- Title: `Order Placed! 🔥` + sub `No Empty Bites. Only Loaded Rolls.`
- SMS line: `Wrap. Bite. Repeat. 🔄`
- Order number card: subtitle `We Don't Roll Small` + `Rolls So Big, You Need Two Hands 🙌`
- Yellow loyalty card: `Wrap. Bite. Repeat.`
- Bottom: Order More = `Order More • We Don't Roll Small` + micro tagline

### 7. Receipt / Bill (Print + Download)
**File:** `CustomerBill.tsx`

- Added footer on thermal receipt:
```
NO EMPTY BITES. ONLY LOADED ROLLS.
We Don't Roll Small • ⚡ WARNING: EXTREMELY LOADED
WRAP. BITE. REPEAT. 🔄
Thank you! Visit again. Rolls So Big, You Need Two Hands 🙌
```
Works for both print window + HTML download. Great for packaging recall.

### 8. Global Footer (All pages except StoreSelector/Admin)
**File:** `App.tsx` → `GlobalTaglineFooter`

- Minimal white footer: Left = No Empty Bites. Only Loaded Rolls. + We Don't Roll Small. Right = Extremely Loaded • Two Hands Needed • Wrap. Bite. Repeat.

### 9. SEO / PWA
**Files:** `index.html`, `manifest.json`

- Title: `Rolls & Co. — No Empty Bites. Only Loaded Rolls. | We Don't Roll Small`
- Meta description: All 5 taglines + pickup keyword
- OG title/desc for WhatsApp share virality
- Keywords: loaded rolls, No Empty Bites, We Don't Roll Small, Extremely Loaded, Wrap Bite Repeat
- Manifest name: `Rolls & Co. — No Empty Bites. Only Loaded Rolls.`

---

## Why This Works for Reach & Appeal (Brand Psych)

1. **Primary locked everywhere:** Hero + Header + Bill + Footer = 7+ impressions per order flow. Solves doubt instantly.
2. **Secondary as attitude:** We Don't Roll Small = youth confident voice. Used in bios, store subtitle, cart, receipts.
3. **Viral campaign:** Two Hands Needed = visual, tactile, UGC magnet. Perfect for reels. Added yellow campaign card + hashtag pills #TwoHandsNeeded
4. **Packaging Hook:** Warning: Extremely Loaded = snackable, Gen-Z, sticker-ready. Used as black badges, marquee, store micro-copy.
5. **Loyalty loop:** Wrap. Bite. Repeat. = rhythmic 3-word habit. Used only at checkout / success / footer — builds habit loop, not noise.
6. **Marquee = retention:** Infinite ticker at top keeps brand energy high, looks like street brand not boring restaurant.

## Next Ideas (Optional)

- T-shirt: Front = We Don't Roll Small, Back = No Empty Bites...
- Bag sticker: ⚡ WARNING: EXTREMELY LOADED
- Reels overlay: Rolls So Big, You Need Two Hands 🙌 + two-hands challenge
- Stamp card: Collect 8 stamps → 9th free. Footer = Wrap. Bite. Repeat.
- WhatsApp status templates: Use Wrap. Bite. Repeat. daily

All integrated, build passing (`vite build` ✅).

