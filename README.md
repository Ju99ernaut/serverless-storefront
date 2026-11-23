# The Store (`serverless-store`)

> **Status: Testing Phase** — This project is currently in its testing phase. Features, workflows, payment provider integrations, and data schemas are actively being tested and refined before production launch.

A serverless apparel storefront built with Next.js App Router, Payload CMS, Neon Postgres, Neon Managed Better Auth, the Vercel Workflow SDK, Cloudflare R2 media storage, ComposeIt on-demand PDF/HTML templates, and Resend transactional emails.

## Features

- **Integer Cents Pricing & Calculations**: All product prices (`price`, `compareAtPrice`, `priceOverride`), line items, 8% tax, `$12.00` courier delivery (`1200` cents), and order totals are calculated and stored in integer cents, then formatted to dollars (`$XX.XX`) across the UI and ComposeIt template payloads.
- **Durable Checkout & Fulfillment Workflows** (`src/workflows/`):
  - **`pay_and_delivery` & `pay_then_collect`**: Reserve stock upfront and wait for payment within a configurable timeout (`WORKFLOW_PAYMENT_WAIT_TIMEOUT`, default `30m`), releasing stock on failure or timeout. Once paid, send the invoice/receipt email and wait on admin/fulfillment hooks (`READY_FOR_COLLECTION`, `OUT_FOR_DELIVERY`, `COMPLETED`, `CANCELLED`).
  - **`pay_on_collection`**: Reserves stock for a configurable window (`WORKFLOW_PAY_ON_COLLECTION_TIMEOUT`, default `8h`) until collected (commits stock & marks paid) or cancelled/expired (releases stock).
  - **`pay_on_delivery`**: Reserves stock for a configurable window (`WORKFLOW_PAY_ON_DELIVERY_TIMEOUT`, default `24h`) until delivered (commits stock & marks paid) or delivery failure / expiry (releases stock).
- **Double-Allocation Prevention**: Serializes concurrent inventory reservations via a keyed FIFO async mutex in `src/lib/payload-server.ts` alongside a `StockReservations` `beforeChange` hook using transaction-scoped Postgres advisory locks (`pg_advisory_xact_lock`).
- **Clear Server vs. Client Data Boundaries**:
  - Server routes and workflow steps use Payload's Local API (`getPayload({ config })`) in [src/lib/payload-server.ts](src/lib/payload-server.ts).
  - Client components and React Query hooks use `@payloadcms/sdk` in [src/lib/payload-sdk.ts](src/lib/payload-sdk.ts).
- **Session & Ownership Enforcement**:
  - `POST /api/checkout` and `PATCH /api/storefront/orders` verify the Neon Auth server session (`getServerNeonUser()`) and ownership (`canUserAccessOrder()`).
  - Order payment confirmation (`action: "payment"`) is restricted to an authorized admin/staff session.
  - Fulfillment advancement (`PROCESSING`, `READY_FOR_COLLECTION`, `OUT_FOR_DELIVERY`, `COMPLETED`, `deliveryFailed`) is restricted to Payload CMS admins or authorized Neon Auth roles (`admin`, `staff`, `fulfillment`); customers can only self-cancel their own pre-dispatch orders.
  - Payload collections enforce `ownerByNeonUserIdAccess`, `ordersAccess`, `reviewsAccess`, `usersAccess`, and admin write guards via [src/lib/access.ts](src/lib/access.ts).
- **On-Demand Invoices & Receipts**:
  - Orders keep only metadata history (`documentHistory` for `INVOICE` and `RECEIPT` generations) with no PDF or email history storage.
  - Invoices and receipts are generated on demand via ComposeIt (`PATCH /api/storefront/orders` with `action: "generate_document"`).

## Tech Stack

- **Framework**: Next.js `16.4.6` (App Router) & React `19.2.9`
- **CMS & Database**: Payload CMS `3.93.0`, `@payloadcms/db-vercel-postgres` (Neon Postgres + Drizzle), `@payloadcms/sdk`, `@payloadcms/richtext-lexical`
- **Authentication**: `@neon/auth` (Neon Managed Better Auth)
- **Durable Workflows**: `workflow` `^5.5.0`
- **Client State & Forms**: `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`, `zod`
- **Media & UI**: Cloudflare R2 (`@payloadcms/storage-s3`), `@imagekit/next`, Tailwind CSS v4, Base UI (`@base-ui/react`), Lucide Icons, Swiper
- **Documents & Email**: ComposeIt API (`axios`) + `resend`
- **Testing**: `vitest` (jsdom integration suite) and `@playwright/test`

## Payload Collections

Configured in [src/payload.config.ts](src/payload.config.ts):

- `users` — Payload admin authentication
- `billing-details` — Customer phone & shipping address keyed by `neonUserId`
- `carts` — Persisted user shopping bags keyed by `neonUserId`
- `wishlists` — Persisted loved items keyed by `neonUserId`
- `products` — Catalog items, garment metadata, and SKU-level variants (`stock`, `reservedStock`, `lowStockThreshold`, optional `priceOverride` in cents)
- `categories` & `banners` — Navigation filters and storefront hero banners
- `media` — Uploaded assets stored via S3/Cloudflare R2 when configured
- `reviews` — Product reviews with automatic aggregate rating sync
- `orders` — Order records, totals (cents), fulfillment status timeline, and `documentHistory`
- `stock-reservations` — Reservation ledger (`RESERVED`, `COMMITTED`, `RELEASED`, `EXPIRED`) with TTL expiry and transactional double-allocation protection

## Getting Started

### 1. Prerequisites

- **Node.js**: `^22.23.5 || ^24.22.3 || >=26.13.1` (see `package.json` `engines`)
- **pnpm**: `^9 || ^10 || ^11`
- A **Neon Postgres** database and **Neon Auth** project (plus optional Cloudflare R2, ComposeIt, Resend, and ImageKit credentials)

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Environment variables defined in `.env.example`:

- **Database & Server**: `DATABASE_URL`, `DB_SECRET`, `NEXT_PUBLIC_SERVER_URL` (default `http://localhost:3000`)
- **Neon Auth**: `NEON_AUTH_BASE_URL`
- **Cloudflare R2 (optional media storage)**: `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_PUBLIC_URL`
- **ImageKit (optional CDN)**: `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT`
- **ComposeIt & Resend**: `COMPOSEIT_API_URL`, `COMPOSEIT_API_KEY`, `INVOICE_PDF_TEMPLATE_ID`, `RECEIPT_PDF_TEMPLATE_ID`, `RECEIPT_EMAIL_TEMPLATE_ID`, `RESEND_API_KEY`, `RESEND_FROM`
- **Paynow Express Mobile Payments**: `PAYNOW_INTEGRATION_ID`, `PAYNOW_INTEGRATION_KEY` (EcoCash & InnBucks mobile checkout, `POST /api/gateways/paynow/update` result webhook, and `POST /api/gateways/paynow/status` polling)
- **ZIMRA FDMS Fiscalization (optional)**: `ZIMRA_FDMS_ENVIRONMENT` (`test` or `production`), `ZIMRA_FDMS_DEVICE_ID`, `ZIMRA_FDMS_SERIAL_NUMBER`, `ZIMRA_FDMS_CERTIFICATE_PEM`, `ZIMRA_FDMS_PRIVATE_KEY_PEM`, `ZIMRA_FDMS_MODEL_NAME`, `ZIMRA_FDMS_MODEL_VERSION`, `ZIMRA_FDMS_CURRENCY` (default `USD`), and optional `ZIMRA_FDMS_TAX_ID` / `ZIMRA_FDMS_TAX_PERCENT`
- **Optional Workflow Timeout Overrides**: `WORKFLOW_PAYMENT_WAIT_TIMEOUT` (default `30m`), `WORKFLOW_PAY_ON_COLLECTION_TIMEOUT` (default `8h`), `WORKFLOW_PAY_ON_DELIVERY_TIMEOUT` (default `24h`)

### Optional: ZIMRA FDMS Fiscal Receipts & QR Code

ZIMRA FDMS fiscalization (`src/lib/zimra-fdms.ts`) is **completely optional**. When the required environment variables are not set, checkout and receipt generation run normally without calling FDMS.

When configured:

1. **One-Time Device Registration**: Register your virtual fiscal device on the ZIMRA FDMS portal (test or production) to obtain your `deviceId`, `serialNumber`, and `activationKey`, then run a one-time registration script using `registerDevice` from `zimra-fdms`:

   ```ts
   import { registerDevice } from 'zimra-fdms'

   const { keys, certificatePem } = await registerDevice(
     { deviceId: 12345, serialNumber: 'MYPOS001', modelName: 'Server', modelVersion: 'v1' },
     'ACTIVKEY',
     { environment: 'test' },
   )
   ```

   Store `certificatePem` and `keys.privateKeyPem` securely in `ZIMRA_FDMS_CERTIFICATE_PEM` and `ZIMRA_FDMS_PRIVATE_KEY_PEM` (with `\n` escaped for single-line `.env` entries).

2. **Environment Configuration**:
   - Set `ZIMRA_FDMS_DEVICE_ID`, `ZIMRA_FDMS_SERIAL_NUMBER`, `ZIMRA_FDMS_CERTIFICATE_PEM`, and `ZIMRA_FDMS_PRIVATE_KEY_PEM` in `.env`.
   - Set `ZIMRA_FDMS_ENVIRONMENT=test` for ZIMRA sandbox testing or `production` for production.
   - **Serverless Persistence**: Device fiscal day state, receipt counters, pending-submit crash markers, and the receipt hash chain are persisted atomically in Neon Postgres (`zimra_fdms_state` table, created automatically) and serialized across concurrent serverless instances via Postgres advisory locks (`pg_advisory_xact_lock`), with `device.reconcile()` run on every invocation. No local filesystem directory is required.
   - Optionally set `ZIMRA_FDMS_TAX_ID` and `ZIMRA_FDMS_TAX_PERCENT` to override the tax automatically selected from `device.getConfig().applicableTaxes`.

3. **Receipt QR Code Output**:
   - For paid orders, `createOrderAndDocumentsStep` submits the receipt to ZIMRA FDMS (automatically opening the fiscal day if closed) and attaches a `fiscal` object to the ComposeIt receipt PDF/email template payload and `order.fiscalReceipt`:
     - `fiscal.qrData` — raw ZIMRA FDMS QR verification string
     - `fiscal.deviceId`, `fiscal.fiscalDayNo`, `fiscal.receiptGlobalNo`, `fiscal.receiptCounter`, `fiscal.submittedAt`
   - End-of-day closure can be triggered using `closeZimraFiscalDay()` from `src/lib/zimra-fdms.ts`.

### 4. Run Locally

```bash
pnpm dev
```

Open `http://localhost:3000` for the storefront and `http://localhost:3000/admin` for the Payload CMS admin panel.

> **Admin Pricing Note**: All prices in the Payload CMS admin panel (`price`, `compareAtPrice`, and variant `priceOverride`) must be entered in **integer cents** (e.g. enter `8900` for `$89.00`, `1200` for `$12.00`).

## Useful Scripts

- `pnpm dev` — Start the Next.js development server
- `pnpm build` — Build the production bundle (`next build --webpack`)
- `pnpm start` — Start the production server
- `pnpm run generate:types` — Regenerate `src/payload-types.ts`
- `npx next typegen` — Compile workflows (`src/app/.well-known/workflow/`) and Next.js route types
- `pnpm run test:int` — Run the Vitest integration suite (`tests/int/api.int.spec.ts`)
- `pnpm run test:e2e` — Run Playwright end-to-end tests (`playwright.config.ts`)
