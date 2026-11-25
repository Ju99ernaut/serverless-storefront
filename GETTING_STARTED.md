# Getting Started

This storefront is a fully serverless e-commerce template built with **Payload CMS**, **Neon Postgres**, **Neon Managed Better Auth**, and durable **Workflows**. It is tailored for stores—particularly small businesses in Zimbabwe—with out-of-the-box admin management for products, banners, and orders, mobile money integration, and customizable fulfillment steps.

![Storefront Overview Screenshot](./docs/screenshots/storefront-overview.png)

---

## Table of Contents

1. [Architecture Highlights](#architecture-highlights)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Environment Variables](#environment-variables)
   - [Database & Authentication (Neon)](#1-database--authentication-neon)
   - [Media Storage & Image Optimization](#2-media-storage--image-optimization)
   - [Invoices, Receipts & Emails (ComposeIt + Resend)](#3-invoices-receipts--emails-composeit--resend)
   - [Payments (Paynow)](#4-payments-paynow)
   - [Checkout, Tax & Delivery](#5-checkout-tax--delivery)
   - [Store & Collection Locations](#6-store--collection-locations)
5. [ZIMRA FDMS Fiscalization](#zimra-fdms-fiscalization)
6. [Managing Orders in Admin](#managing-orders-in-admin)
7. [Data Protection & Compliance Disclaimer](#data-protection--compliance-disclaimer)

---

## Architecture Highlights

- **Payload CMS Admin UI:** Manage products, variants, banners, reviews, and orders out of the box.
- **Durable Workflows:** Checkout, payment confirmation, stock reservation, and order fulfillment run on workflows—making it easy to add, remove, or customize steps (including hooking in new payment providers).
- **Serverless Stack:** Powered by Neon Postgres and S3-compatible object storage.

---

## Prerequisites

- **Node.js**: `^22.23.5 || ^24.22.3 || >=26.13.1` (see `package.json` `engines`)
- **pnpm**: `^9 || ^10 || ^11`
- A **Neon** account (standalone or via the Vercel integration — _recommended_)
- An **S3-compatible storage** bucket (AWS S3, Cloudflare R2, or Vercel Blob/Object Storage)
- Optional accounts for **ImageKit**, **ComposeIt**, **Resend**, and **Paynow**

---

## Quick Start

1. **Clone the repository**

   ```bash
   git clone https://github.com/Ju99ernaut/serverless-storefront.git
   cd serverless-storefront
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Configure environment variables**

   Copy `.env.example` to `.env` and fill in the variables detailed below.

   ```bash
   cp .env.example .env
   ```

4. **Start the development server**

   ```bash
   pnpm dev
   ```

   Open `http://localhost:3000` for the storefront and `http://localhost:3000/admin` to create your first Payload admin user.

---

## Environment Variables

### 1. Database & Authentication (Neon)

The project uses Neon Postgres alongside Neon's managed Better Auth service.

```env
# Neon Postgres connection string (from Neon console or Vercel integration)
DATABASE_URL=postgresql://user:password@ep-example.us-east-2.aws.neon.tech/neondb?sslmode=require

# Random secret string (minimum 32 characters) used by Payload & auth
DB_SECRET=replace-with-a-random-32-character-minimum-secret

# Base URL from your Neon database Auth settings
NEON_AUTH_BASE_URL=[https://ep-example.neonauth.us-east-2.aws.neon.tech/neondb/auth](https://ep-example.neonauth.us-east-2.aws.neon.tech/neondb/auth)

# Public base URL of your deployed or local storefront
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

### 2. Media Storage & Image Optimization

E-commerce storefronts are image-heavy. Configure any S3-compatible object storage for media uploads, and optionally connect **ImageKit** so image transformations do not exhaust Vercel Image Optimization quotas.

```env
# S3-Compatible Storage (AWS S3, Cloudflare R2, Vercel Object Storage, etc.)
STORAGE_BUCKET=your-bucket-name
STORAGE_ACCESS_KEY_ID=your-access-key-id
STORAGE_SECRET_ACCESS_KEY=your-secret-access-key
STORAGE_ENDPOINT=[https://your-account-id.r2.cloudflarestorage.com](https://your-account-id.r2.cloudflarestorage.com)
STORAGE_PUBLIC_URL=[https://pub-your-bucket-domain.r2.dev](https://pub-your-bucket-domain.r2.dev)

# Optional: ImageKit endpoint for offloaded image optimization
NEXT_PUBLIC_IMAGEKIT_URL=[https://ik.imagekit.io/your_imagekit_id](https://ik.imagekit.io/your_imagekit_id)
```

---

### 3. Invoices, Receipts & Emails (ComposeIt + Resend)

Invoices and receipts are mission-critical for order fulfillment. The store generates PDF and HTML documents via **ComposeIt** (`POST` with `{ templateId, formats: ["pdf"] | ["html"], data }` and `x-api-key` header) and dispatches emails with PDF attachments via **Resend** (`path: pdf.url`).

> **Customizing Providers:** If you prefer another document or email provider, implement a custom adapter based on `src/lib/utils/document-email-service`.

```env
# ComposeIt API Configuration
COMPOSEIT_API_KEY=
INVOICE_PDF_TEMPLATE_ID=tpl_invoice_pdf_v1
RECEIPT_PDF_TEMPLATE_ID=tpl_receipt_pdf_v1
RECEIPT_EMAIL_TEMPLATE_ID=tpl_order_receipt_email_v1

# Outbound Email Configuration (Resend)
RESEND_API_KEY=
RESEND_FROM="Storefront Orders <onboarding@resend.dev>"

# Admin email address to receive new order notifications
ADMIN_EMAIL=admin@example.com
```

![Sample Invoice Template Screenshot](./docs/screenshots/composeit-receipt-preview.png)

![Sample Receipt Template Screenshot](./docs/screenshots/storefront-overview.png)

![Sample Email Template Screenshot](./docs/screenshots/storefront-overview.png)

---

### 4. Payments (Paynow)

The store integrates **Paynow Express Mobile Payments** (EcoCash & InnBucks), with local and international card payments coming soon.

- **No Paynow keys yet?** The store still works out of the box with **Pay on Delivery** and **Pay on Collection**, using manual payment confirmation inside the Payload Admin UI (or automated via workflow hooks).
- **Adding payment gateways:** Because checkout runs on workflows, you can easily plug in additional payment providers.

```env
# Paynow Express Checkout Credentials
PAYNOW_INTEGRATION_ID=
PAYNOW_INTEGRATION_KEY=
```

![Checkout Payment Options Screenshot](./docs/screenshots/checkout-payment-options.png)

---

### 5. Checkout, Tax & Delivery

All monetary values for delivery rates and thresholds are configured in **cents** to avoid floating-point rounding issues.

- **Delivery fee formula:** `max(MIN_DELIVERY_FEE, DELIVERY_RATE * distanceKm)`, or `0` when `subTotal >= FREE_DELIVERY_THRESHOLD`.

```env
# Sum of all applicable tax rates (e.g., 0.08 for 8%, or 0.15 for 15% VAT)
NEXT_PUBLIC_TAX_RATE=0.08

# Delivery rate in cents per kilometer (Rate * Distance in km)
NEXT_PUBLIC_DELIVERY_RATE=0

# Orders with a subtotal above this amount (in cents) qualify for free delivery
NEXT_PUBLIC_FREE_DELIVERY_THRESHOLD=

# Minimum delivery charge in cents
NEXT_PUBLIC_MIN_DELIVERY_FEE=

# Store origin coordinates used to calculate delivery distance
NEXT_PUBLIC_STORE_LAT=-17.8252
NEXT_PUBLIC_STORE_LNG=31.0335
```

---

### 6. Store & Collection Locations

Because location names and addresses frequently contain commas (e.g., `"Avondale Branch, Harare"`), avoid plain comma-separated strings. Instead, use a **pipe-delimited (`|`)** or **JSON** format that pairs each pickup location name with its coordinates:

```env
# Format: Name@lat,lng | Name@lat,lng
NEXT_PUBLIC_COLLECTION_LOCATIONS="Samora Machel Flagship@-17.8292,31.0522|Avondale Pickup Point@-17.8015,31.0378|Borrowdale Branch@-17.7568,31.0842"
```

_(Alternatively, if your parser reads JSON: `NEXT_PUBLIC_COLLECTION_LOCATIONS='[{"name":"Samora Machel Flagship","lat":-17.8292,"lng":31.0522}]'`)_

![Checkout Delivery and Pickup Selector Screenshot](./docs/screenshots/checkout-location-picker.png)

---

## ZIMRA FDMS Fiscalization

If you have configured **ComposeIt** for receipts and need **ZIMRA FDMS Fiscalization** (including fiscal day counters and QR verification codes on customer receipts), follow the setup guide below:

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

---

## Managing Orders in Admin

From `/admin/collections/orders`, you can track orders, inspect payment and fiscal receipt details, and move orders along the fulfillment pipeline (`CONFIRMED` -> `PROCESSING` -> `READY_FOR_COLLECTION` / `OUT_FOR_DELIVERY` -> `COMPLETED`), or let your workflows advance them automatically.

![Payload Admin Order Management Screenshot](./docs/screenshots/admin-order-controls.png)

> **Tip:** Always confirm that `paymentStatus` is marked as **Paid** before moving an order to **Completed** (especially for _Pay on Delivery_ and _Pay on Collection_ orders), as completing an order commits reserved variant stock.

---

## Data Protection & Compliance Disclaimer

This application collects and stores personally identifiable information (PII)—including customer names, email addresses, phone numbers, delivery coordinates, and order histories—during account registration and checkout.

As the store operator, you act as the **Data Controller**. Depending on your jurisdiction (such as under Zimbabwe's **Cyber and Data Protection Act [Chapter 12:07]** and POTRAZ regulations) and the volume of customer data you process, you may be legally required to register as a data controller, appoint a Data Protection Officer (DPO), publish a Privacy Policy, and obtain a **Data Protection License**.

## Point of Sale (POS) & Stock Sync

This storefront is built primarily around the **online side of your business** and assumes online orders and workflow-driven stock reservations are the source of truth.

- **Small operations:** When order volume is low, reconciling stock manually isn't usually overwhelming. You can even create a single placeholder customer (e.g., _"In-Store Walk-In"_) to log in-store sales in one place so your order and customer history stays centralized.
- **Scaling up:** Once walk-in and multi-channel volume ramps up, manual reconciliation gets error-prone. At that stage, consider subscribing to or triggering store workflows from your in-store POS machines for example (via webhooks or API endpoints) so inventory deductions and order records stay in sync automatically.

## Contact & Support

For setup help, customization questions, or reporting issues with this template, reach out through your project's preferred channels:

- **Repository / Issues:** Open an issue or pull request in your project repository [(`serverless-storefront`)](https://github.com/Ju99ernaut/serverless-storefront) for bugs, workflow improvements, or feature extensions.
- **Security & Data Requests:** Direct privacy, data-access, or security disclosures email brendon@composeit.app rather than public issue trackers.
- **Custom implementations:** email brendon@composeit.app
