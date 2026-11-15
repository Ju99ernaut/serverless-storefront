import { NextRequest, NextResponse } from 'next/server';
import {
  getRuntimeStore,
  StoreUserRecord,
} from '@/lib/storefront-db';
import type { CartLineItem } from '@/data/products';

function mergeCartLists(
  existing: CartLineItem[],
  incoming: CartLineItem[]
): CartLineItem[] {
  const map = new Map<string, CartLineItem>();
  for (const item of existing) {
    const key = item.variantSku || item.id;
    map.set(key, { ...item });
  }
  for (const item of incoming) {
    const key = item.variantSku || item.id;
    const prev = map.get(key);
    if (prev) {
      map.set(key, {
        ...prev,
        quantity: Math.min(
          item.maxAvailableStock || 99,
          prev.quantity + item.quantity
        ),
      });
    } else {
      map.set(key, { ...item });
    }
  }
  return Array.from(map.values());
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      action,
      email,
      name,
      phone,
      shippingAddress,
      productSlug,
      cartItems,
    } = body || {};

    const store = getRuntimeStore();
    const cleanEmail = String(email || 'alex.rivera@example.com')
      .trim()
      .toLowerCase();

    if (!cleanEmail) {
      return NextResponse.json(
        { error: 'A valid email address is required.' },
        { status: 400 }
      );
    }

    let user = store.users.find((u) => u.email.toLowerCase() === cleanEmail);

    if (
      action === 'register' ||
      action === 'login' ||
      action === 'oauth_google'
    ) {
      if (!user) {
        user = {
          id: `usr_${Date.now()}`,
          email: cleanEmail,
          name:
            String(name || '').trim() ||
            cleanEmail
              .split('@')[0]
              .replace(/[._-]/g, ' ')
              .replace(/\b\w/g, (l) => l.toUpperCase()),
          phone: phone || '+1 (415) 555-0192',
          role: 'customer',
          neonAuthUserId: `neon_ba_${Date.now()}`,
          authProvider: action === 'oauth_google' ? 'google' : 'neon',
          shippingAddresses: shippingAddress
            ? [
                {
                  id: `addr_${Date.now()}`,
                  label: 'Primary Delivery',
                  fullName: String(name || 'Customer').trim(),
                  streetAddress: shippingAddress,
                  isDefault: true,
                },
              ]
            : [
                {
                  id: 'addr-default',
                  label: 'Home',
                  fullName: String(name || 'Alex Rivera').trim(),
                  streetAddress:
                    '742 Evergreen Terrace, Suite 200, San Francisco, CA 94107',
                  isDefault: true,
                },
              ],
          wishlistProductSlugs: [],
          savedCart: Array.isArray(cartItems) ? cartItems : [],
          createdAt: new Date().toISOString(),
        };
        store.users.push(user);
      } else {
        if (name) user.name = String(name).trim();
        if (action === 'oauth_google') user.authProvider = 'google';
        if (Array.isArray(cartItems) && cartItems.length > 0) {
          user.savedCart = mergeCartLists(user.savedCart, cartItems);
        }
      }
    } else if (!user) {
      return NextResponse.json(
        { error: 'Account not found. Please sign in or create an account.' },
        { status: 404 }
      );
    }

    if (action === 'sync_cart' && Array.isArray(cartItems)) {
      user.savedCart = cartItems;
    }

    if (action === 'toggle_wishlist' && productSlug) {
      const idx = user.wishlistProductSlugs.indexOf(productSlug);
      if (idx >= 0) {
        user.wishlistProductSlugs.splice(idx, 1);
      } else {
        user.wishlistProductSlugs.push(productSlug);
      }
    }

    if (action === 'update_profile') {
      if (name) user.name = String(name).trim();
      if (phone !== undefined) user.phone = String(phone).trim();
      if (shippingAddress !== undefined) {
        if (user.shippingAddresses.length > 0) {
          user.shippingAddresses[0].streetAddress = String(shippingAddress).trim();
          user.shippingAddresses[0].fullName = user.name;
        } else {
          user.shippingAddresses.push({
            id: `addr_${Date.now()}`,
            label: 'Primary',
            fullName: user.name,
            streetAddress: String(shippingAddress).trim(),
            isDefault: true,
          });
        }
      }
    }

    const userOrders = store.orders.filter(
      (o) => o.customerEmail.toLowerCase() === user.email.toLowerCase()
    );

    return NextResponse.json({
      user: user as StoreUserRecord,
      orders: userOrders,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Could not process account request',
      },
      { status: 500 }
    );
  }
}
