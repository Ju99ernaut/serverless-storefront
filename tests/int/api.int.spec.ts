import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getCatalog } from '@/app/(frontend)/api/storefront/catalog/route';
import { POST as postCheckout } from '@/app/(frontend)/api/checkout/route';
import { GET as getProductBySlug } from '@/app/(frontend)/api/storefront/products/[slug]/route';
import { POST as postProductReview } from '@/app/(frontend)/api/storefront/products/[slug]/reviews/route';
import { POST as postAccount } from '@/app/(frontend)/api/storefront/account/route';
import {
  GET as getOrders,
  PATCH as patchOrder,
} from '@/app/(frontend)/api/storefront/orders/route';
import { GET as getDocument } from '@/app/(frontend)/api/storefront/documents/[orderId]/route';
import {
  getRuntimeStore,
  reserveVariantStockAtomic,
  releaseVariantStockAtomic,
} from '@/lib/storefront-db';
import { getProductLowestAvailableVariantStock } from '@/data/utils';

describe('Storefront End-to-End API & Workflow Integration Suite', () => {
  beforeAll(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        const parsed =
          typeof init?.body === 'string'
            ? (JSON.parse(init.body) as {
                formats?: string[];
                data?: { orderId?: string; documentType?: string };
              })
            : {};
        const orderId = parsed.data?.orderId || 'ORD-TEST';
        const docType =
          parsed.data?.documentType === 'RECEIPT' ? 'receipt' : 'invoice';
        const wantsPdf = !parsed.formats || parsed.formats.includes('pdf');
        const wantsHtml = !parsed.formats || parsed.formats.includes('html');
        const htmlDocument = `<!DOCTYPE html><html><body><h1>Order ${orderId}</h1></body></html>`;

        return new Response(
          JSON.stringify({
            ...(wantsPdf
              ? {
                  pdf: {
                    url: `/api/storefront/documents/${encodeURIComponent(orderId)}?type=${docType}`,
                    sizeBytes: 28450,
                    mimeType: 'application/pdf',
                    checksum: `sha256_${orderId.toLowerCase()}_${docType}`,
                  },
                }
              : {}),
            ...(wantsHtml
              ? {
                  html: {
                    htmlDocument,
                    checksum: `sha256_${orderId.toLowerCase()}_html`,
                    mimeType: 'text/html',
                    url: `/api/storefront/documents/${encodeURIComponent(orderId)}?type=html`,
                    sizeBytes: htmlDocument.length,
                  },
                }
              : {}),
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      })
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });
  it('supports catalog listing, search, sorting, category filtering, and low-stock detection', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/storefront/catalog?q=oxford&filter=shirts&sort=price-asc'
    );
    const res = await getCatalog(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(Array.isArray(data.products)).toBe(true);
    expect(data.products.length).toBeGreaterThan(0);
    expect(Array.isArray(data.banners)).toBe(true);
    expect(data.banners.length).toBeGreaterThan(0);

    const oxford = data.products.find(
      (p: { slug: string }) => p.slug === 'classic-oxford-button-down'
    );
    expect(oxford).toBeDefined();

    const stockInfo = getProductLowestAvailableVariantStock(oxford);
    expect(stockInfo.hasLowStockVariant).toBe(true);
    expect(stockInfo.minAvailable).toBeLessThanOrEqual(5);
  });

  it('prevents double allocation under concurrent reservations and releases stock on failed payment', async () => {
    const store = getRuntimeStore();
    const oxford = store.products.find(
      (p) => p.slug === 'classic-oxford-button-down'
    );
    expect(oxford).toBeDefined();
    const variant = oxford!.variants.find((v) => v.sku === 'PROD-1-SKY-S');
    expect(variant).toBeDefined();
    const initialStock = variant!.stock;
    expect(initialStock).toBe(2);

    // 1. Simulate failed payment checkout -> Workflow reserves then compensates/releases stock
    const failedReq = new NextRequest('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idempotencyKey: 'res_test_fail_1',
        paymentOption: 'pay_and_delivery',
        simulatePaymentFailure: true,
        customer: {
          name: 'Alex Rivera',
          email: 'alex.rivera@example.com',
          address: '742 Evergreen Terrace, San Francisco, CA',
        },
        payment: {
          cardholderName: 'Alex Rivera',
          cardNumber: '4242424242424242',
          expiry: '08/29',
        },
        items: [
          {
            id: oxford!.id,
            slug: oxford!.slug,
            variantSku: variant!.sku,
            title: oxford!.title,
            brand: oxford!.brand,
            category: oxford!.category,
            subcategory: oxford!.subcategory,
            size: variant!.size,
            color: variant!.color,
            price: oxford!.price,
            quantity: 2,
            images: oxford!.images,
          },
        ],
      }),
    });

    const failedRes = await postCheckout(failedReq);
    expect(failedRes.status).toBe(402);
    const failedBody = await failedRes.json();
    expect(failedBody.stockReleased).toBe(true);
    expect(variant!.reservedStock).toBe(0);
    expect(variant!.stock).toBe(initialStock);

    // 2. Concurrent / over-allocation check: lock SKU then verify double-allocation blocked, then test 409 insufficient stock
    const r1 = reserveVariantStockAtomic({
      reservationKey: 'res_double_1',
      orderId: 'ORD-DBL-1',
      items: [
        {
          productSlug: oxford!.slug,
          variantSku: variant!.sku,
          quantity: 2,
        },
      ],
    });
    expect(r1.success).toBe(true);
    expect(variant!.reservedStock).toBe(2);

    // Attempting a second reservation for the same 2 remaining units must fail
    const r2 = reserveVariantStockAtomic({
      reservationKey: 'res_double_2',
      orderId: 'ORD-DBL-2',
      items: [
        {
          productSlug: oxford!.slug,
          variantSku: variant!.sku,
          quantity: 1,
        },
      ],
    });
    expect(r2.success).toBe(false);
    expect(r2.insufficientItems?.[0].available).toBe(0);

    // Clean up reservation lock for next tests
    releaseVariantStockAtomic('res_double_1', 'Test cleanup');
    expect(variant!.reservedStock).toBe(0);
  });

  it('supports all 4 payment and fulfillment options and generates ComposeIt documents and emails', async () => {
    const store = getRuntimeStore();
    const boot = store.products.find(
      (p) => p.slug === 'milan-leather-chelsea-boot'
    );
    expect(boot).toBeDefined();
    const targetVariant = boot!.variants[0];
    const startStock = targetVariant.stock;

    const scenarios = [
      {
        option: 'pay_and_delivery',
        expectedPaymentStatus: 'PAID',
        expectedFulfillment: 'DELIVERY',
        expectedShipping: 12,
      },
      {
        option: 'pay_then_collect',
        expectedPaymentStatus: 'PAID',
        expectedFulfillment: 'COLLECTION',
        expectedShipping: 0,
      },
      {
        option: 'pay_on_delivery',
        expectedPaymentStatus: 'PENDING',
        expectedFulfillment: 'DELIVERY',
        expectedShipping: 12,
      },
      {
        option: 'pay_on_collection',
        expectedPaymentStatus: 'PENDING',
        expectedFulfillment: 'COLLECTION',
        expectedShipping: 0,
      },
    ] as const;

    let lastOrderId = '';

    for (const sc of scenarios) {
      const req = new NextRequest('http://localhost:3000/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentOption: sc.option,
          customer: {
            name: 'Alex Rivera',
            email: 'alex.rivera@example.com',
            address: '742 Evergreen Terrace, San Francisco, CA',
            collectionLocation: 'Flagship Storefront Atelier — SoHo',
          },
          payment:
            sc.expectedPaymentStatus === 'PAID'
              ? {
                  cardholderName: 'Alex Rivera',
                  cardNumber: '4242424242424242',
                  expiry: '08/29',
                }
              : undefined,
          items: [
            {
              id: boot!.id,
              slug: boot!.slug,
              variantSku: targetVariant.sku,
              title: boot!.title,
              brand: boot!.brand,
              category: boot!.category,
              subcategory: boot!.subcategory,
              size: targetVariant.size,
              color: targetVariant.color,
              price: boot!.price,
              quantity: 1,
              images: boot!.images,
            },
          ],
        }),
      });

      const res = await postCheckout(req);
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.success).toBe(true);
      expect(body.order.paymentOption).toBe(sc.option);
      expect(body.order.fulfillmentMethod).toBe(sc.expectedFulfillment);
      expect(body.order.paymentSummary.status).toBe(sc.expectedPaymentStatus);
      expect(body.order.totals.shipping).toBe(sc.expectedShipping);
      expect(body.documents.invoice.pdf?.url).toContain('type=invoice');
      expect(body.documents.receipt.pdf?.url).toContain('type=receipt');
      expect(body.email.renderedHtml).toContain(body.order.orderId);

      lastOrderId = body.order.orderId;
    }

    // Stock should have decremented cleanly by 4 units
    expect(targetVariant.stock).toBe(startStock - 4);
    expect(targetVariant.reservedStock).toBe(0);

    // Check document preview endpoint renders printable invoice
    const docReq = new NextRequest(
      `http://localhost:3000/api/storefront/documents/${lastOrderId}?type=invoice`
    );
    const docRes = await getDocument(docReq, {
      params: Promise.resolve({ orderId: lastOrderId }),
    });
    expect(docRes.status).toBe(200);
    const docHtml = await docRes.text();
    expect(docHtml).toContain(lastOrderId);
  });

  it('publishes clothing product reviews and updates rating averages', async () => {
    const slug = 'organic-pima-crewneck-shirt';
    const postReq = new NextRequest(
      `http://localhost:3000/api/storefront/products/${slug}/reviews`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorName: 'Maya Lin',
          authorEmail: 'maya.lin@example.com',
          rating: 5,
          title: 'Exceptionally soft organic cotton',
          comment: 'Holds collar structure cleanly after wearing all day.',
          variantSize: 'M',
          variantColor: 'Crisp Ivory',
        }),
      }
    );

    const postRes = await postProductReview(postReq, {
      params: Promise.resolve({ slug }),
    });
    expect(postRes.status).toBe(200);
    const postData = await postRes.json();
    expect(postData.review.title).toBe('Exceptionally soft organic cotton');
    expect(postData.product.reviewCount).toBeGreaterThan(0);

    const getReq = new NextRequest(
      `http://localhost:3000/api/storefront/products/${slug}`
    );
    const getRes = await getProductBySlug(getReq, {
      params: Promise.resolve({ slug }),
    });
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(
      getData.reviews.some(
        (r: { title: string }) => r.title === 'Exceptionally soft organic cotton'
      )
    ).toBe(true);
  });

  it('handles Neon Auth account registration, guest cart merge, wishlist toggle, and order status updates', async () => {
    const regReq = new NextRequest(
      'http://localhost:3000/api/storefront/account',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          email: 'new.shopper@example.com',
          name: 'New Shopper',
          cartItems: [
            {
              id: 'prod-1',
              slug: 'classic-oxford-button-down',
              cartItemId: 'PROD-1-SKY-M',
              variantSku: 'PROD-1-SKY-M',
              selectedSize: 'M',
              selectedColor: 'Oxford Sky',
              selectedColorHex: '#7FA3C9',
              unitPrice: 89,
              price: 89,
              quantity: 1,
              maxAvailableStock: 3,
              title: 'Classic Oxford Button-Down',
              brand: 'Atelier Nord',
              category: 'shirts',
              subcategory: 'Oxford Button-Downs',
              tags: ['shirts'],
              images: ['/images/shirt.png'],
              size: 'normal',
              description: '',
              material: '100% Supima Cotton',
              fit: 'Tailored Fit',
              care: 'Machine wash cold',
              variants: [],
              averageRating: 4.9,
              reviewCount: 18,
            },
          ],
        }),
      }
    );

    const regRes = await postAccount(regReq);
    expect(regRes.status).toBe(200);
    const regData = await regRes.json();
    expect(regData.user.email).toBe('new.shopper@example.com');
    expect(regData.user.savedCart.length).toBe(1);

    // Toggle wishlist
    const wishReq = new NextRequest(
      'http://localhost:3000/api/storefront/account',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_wishlist',
          email: 'new.shopper@example.com',
          productSlug: 'moto-full-grain-biker-jacket',
        }),
      }
    );
    const wishRes = await postAccount(wishReq);
    expect(wishRes.status).toBe(200);
    const wishData = await wishRes.json();
    expect(wishData.user.wishlistProductSlugs).toContain(
      'moto-full-grain-biker-jacket'
    );

    // Fetch existing orders and advance an order status via Workflow SDK
    const ordersReq = new NextRequest(
      'http://localhost:3000/api/storefront/orders?email=alex.rivera@example.com'
    );
    const ordersRes = await getOrders(ordersReq);
    expect(ordersRes.status).toBe(200);
    const ordersData = await ordersRes.json();
    expect(ordersData.orders.length).toBeGreaterThan(0);

    const firstOrderId = ordersData.orders[0].orderId;
    const patchReq = new NextRequest(
      'http://localhost:3000/api/storefront/orders',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: firstOrderId,
          nextStatus: 'COMPLETED',
          note: 'Package signed and delivered.',
        }),
      }
    );
    const patchRes = await patchOrder(patchReq);
    expect(patchRes.status).toBe(200);
    const patchData = await patchRes.json();
    expect(patchData.order.orderStatus).toBe('COMPLETED');
    expect(patchData.emailDispatched).toBe(true);
  });

  it('supports updating user name, email, password, and avatar with validation guards', async () => {
    // 1. Register user with initial password
    const initReq = new NextRequest(
      'http://localhost:3000/api/storefront/account',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          email: 'profile.tester@example.com',
          name: 'Profile Tester',
          password: 'initialPassword123',
        }),
      }
    );
    const initRes = await postAccount(initReq);
    expect(initRes.status).toBe(200);

    // 2. Reject incorrect current password
    const badPwReq = new NextRequest(
      'http://localhost:3000/api/storefront/account',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_profile',
          email: 'profile.tester@example.com',
          currentPassword: 'wrongPassword',
          newPassword: 'updatedPassword456',
        }),
      }
    );
    const badPwRes = await postAccount(badPwReq);
    expect(badPwRes.status).toBe(401);

    // 3. Reject email conflict with existing demo account
    const conflictReq = new NextRequest(
      'http://localhost:3000/api/storefront/account',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_profile',
          email: 'profile.tester@example.com',
          newEmail: 'alex.rivera@example.com',
        }),
      }
    );
    const conflictRes = await postAccount(conflictReq);
    expect(conflictRes.status).toBe(409);

    // 4. Reject too-short new password
    const shortPwReq = new NextRequest(
      'http://localhost:3000/api/storefront/account',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_profile',
          email: 'profile.tester@example.com',
          currentPassword: 'initialPassword123',
          newPassword: '123',
        }),
      }
    );
    const shortPwRes = await postAccount(shortPwReq);
    expect(shortPwRes.status).toBe(400);

    // 5. Successfully update name, email, avatarUrl, and password
    const updateReq = new NextRequest(
      'http://localhost:3000/api/storefront/account',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_profile',
          email: 'profile.tester@example.com',
          newEmail: 'updated.tester@example.com',
          name: 'Updated Tester Name',
          avatarUrl: 'https://example.com/avatar-updated.png',
          currentPassword: 'initialPassword123',
          newPassword: 'updatedPassword456',
        }),
      }
    );
    const updateRes = await postAccount(updateReq);
    expect(updateRes.status).toBe(200);
    const updateData = await updateRes.json();
    expect(updateData.user.name).toBe('Updated Tester Name');
    expect(updateData.user.email).toBe('updated.tester@example.com');
    expect(updateData.user.avatarUrl).toBe(
      'https://example.com/avatar-updated.png'
    );

    // 6. Verify login works with updated email & new password, and fails with old password
    const wrongLoginReq = new NextRequest(
      'http://localhost:3000/api/storefront/account',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          email: 'updated.tester@example.com',
          password: 'initialPassword123',
        }),
      }
    );
    const wrongLoginRes = await postAccount(wrongLoginReq);
    expect(wrongLoginRes.status).toBe(401);

    const goodLoginReq = new NextRequest(
      'http://localhost:3000/api/storefront/account',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          email: 'updated.tester@example.com',
          password: 'updatedPassword456',
        }),
      }
    );
    const goodLoginRes = await postAccount(goodLoginReq);
    expect(goodLoginRes.status).toBe(200);
    const goodLoginData = await goodLoginRes.json();
    expect(goodLoginData.user.name).toBe('Updated Tester Name');
  });
});
