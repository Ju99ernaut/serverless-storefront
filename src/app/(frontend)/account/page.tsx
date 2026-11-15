'use client';

import { Suspense, useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Heart,
  LogOut,
  Mail,
  Package,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Trash2,
  Truck,
  User as UserIcon,
} from 'lucide-react';
import { useStore } from '../../../context/StoreContext';
import { updateOrderStatusViaSdk } from '../../../lib/payload-sdk';
import type { StoreOrderRecord } from '../../../lib/storefront-db';
import { OptimizedImage } from '../../../components/ui/optimized-image';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Alert } from '../../../components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../../components/ui/tabs';
import Cart from '../../../components/Cart';

const STATUS_BADGE_MAP: Record<
  StoreOrderRecord['orderStatus'],
  { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'outline' }
> = {
  PENDING: { label: 'Pending', variant: 'secondary' as never },
  CONFIRMED: { label: 'Confirmed & Reserved', variant: 'outline' },
  PROCESSING: { label: 'Preparing in Atelier', variant: 'default' },
  READY_FOR_COLLECTION: { label: 'Ready for Collection', variant: 'warning' },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', variant: 'warning' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  CANCELLED: { label: 'Cancelled & Stock Released', variant: 'destructive' },
};

function AccountPortalContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab');

  const {
    user,
    orders,
    products,
    wishlistSlugs,
    toggleWishlist,
    cartItems,
    totalCartCount,
    isCartOpen,
    setIsCartOpen,
    addToCart,
    updateCartQuantity,
    removeCartItem,
    clearCart,
    openAuthModal,
    signOut,
    updateProfile,
    refreshUserOrders,
  } = useStore();

  const [activeTab, setActiveTab] = useState(
    initialTab === 'wishlist' || initialTab === 'cart' || initialTab === 'profile'
      ? initialTab
      : 'orders'
  );

  const [profileName, setProfileName] = useState(user?.name || '');
  const [profilePhone, setProfilePhone] = useState(user?.phone || '');
  const [profileAddress, setProfileAddress] = useState(
    user?.shippingAddresses?.[0]?.streetAddress || ''
  );
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSavedMsg, setProfileSavedMsg] = useState('');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [orderNotice, setOrderNotice] = useState('');

  useEffect(() => {
    if (user) {
      setProfileName(user.name || '');
      setProfilePhone(user.phone || '');
      setProfileAddress(user.shippingAddresses?.[0]?.streetAddress || '');
    }
  }, [user]);

  useEffect(() => {
    if (
      initialTab === 'wishlist' ||
      initialTab === 'cart' ||
      initialTab === 'profile' ||
      initialTab === 'orders'
    ) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const lovedProducts = products.filter((p) => wishlistSlugs.includes(p.slug));

  const handleSaveProfile = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSavedMsg('');
    try {
      await updateProfile({
        name: profileName.trim(),
        phone: profilePhone.trim(),
        shippingAddress: profileAddress.trim(),
      });
      setProfileSavedMsg('Account profile & delivery address saved to Payload CMS.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAdvanceStatus = async (
    orderId: string,
    nextStatus: StoreOrderRecord['orderStatus']
  ) => {
    setUpdatingOrderId(orderId);
    setOrderNotice('');
    try {
      const res = await updateOrderStatusViaSdk({
        orderId,
        nextStatus,
      });
      setOrderNotice(
        `Order ${orderId} updated to "${nextStatus}". ${
          res.emailDispatched
            ? 'Email status notification dispatched to your inbox.'
            : ''
        }`
      );
      await refreshUserOrders();
    } catch (err: unknown) {
      setOrderNotice(
        err instanceof Error ? err.message : 'Unable to update order status.'
      );
    } finally {
      setUpdatingOrderId(null);
    }
  };

  return (
    <div className="min-h-screen pb-16">
      <Cart
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={updateCartQuantity}
        onRemoveItem={removeCartItem}
        onClearCart={clearCart}
      />

      {/* Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-[var(--border-color)] bg-[var(--surface-drawer)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span>Back to Store</span>
              </Link>
            </Button>
            <span className="text-sm font-bold text-[var(--fg-heading)]">
              My Account Portal
            </span>
          </div>

          <div className="flex items-center gap-2">
            {user && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={signOut}
                className="gap-1.5"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>Sign Out</span>
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={() => setIsCartOpen(true)}
              className="gap-1.5"
            >
              <ShoppingCart className="h-4 w-4" aria-hidden="true" />
              <span>Bag ({totalCartCount})</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-8">
        {!user ? (
          <Card className="mx-auto max-w-lg text-center">
            <CardHeader>
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#5C5EDC]/15 text-[#797BED]">
                <ShieldCheck className="h-6 w-6" aria-hidden="true" />
              </div>
              <CardTitle className="text-xl">
                Sign in to manage orders &amp; saved wardrobe
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-[var(--fg-muted)]">
                Create an account or sign in via Neon Managed Better Auth (Email
                or Google) to track orders, download Invoice/Receipt PDFs, sync
                your saved bag, and receive email shipping updates.
              </p>
              {totalCartCount > 0 && (
                <Alert>
                  <Sparkles className="h-4 w-4 text-[#797BED]" aria-hidden="true" />
                  <span className="text-xs">
                    You currently have <strong>{totalCartCount}</strong> item(s)
                    in your guest <code>localStorage</code> bag &mdash; signing
                    in will merge them automatically.
                  </span>
                </Alert>
              )}
              <div className="flex justify-center gap-3">
                <Button
                  type="button"
                  onClick={() => openAuthModal('account')}
                >
                  Sign In / Create Account
                </Button>
                <Button asChild variant="outline">
                  <Link href="/">Continue Browsing</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* User Header & KPIs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-card)] p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#5C5EDC] text-white text-xl font-bold">
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-[var(--fg-heading)]">
                      {user.name}
                    </h1>
                    <Badge variant="outline" className="text-[10px]">
                      {user.authProvider.toUpperCase()} AUTH
                    </Badge>
                  </div>
                  <p className="text-sm text-[var(--fg-muted)]">{user.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-elevated)] px-4 py-2.5">
                  <div className="text-lg font-bold text-[var(--fg-heading)]">
                    {orders.length}
                  </div>
                  <div className="text-[11px] text-[var(--fg-muted)]">
                    Orders
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-elevated)] px-4 py-2.5">
                  <div className="text-lg font-bold text-[var(--fg-heading)]">
                    {wishlistSlugs.length}
                  </div>
                  <div className="text-[11px] text-[var(--fg-muted)]">
                    Loved
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-elevated)] px-4 py-2.5">
                  <div className="text-lg font-bold text-[var(--fg-heading)]">
                    {totalCartCount}
                  </div>
                  <div className="text-[11px] text-[var(--fg-muted)]">
                    Saved Bag
                  </div>
                </div>
              </div>
            </div>

            {orderNotice && (
              <Alert variant="success">
                <Mail className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span className="text-xs sm:text-sm">{orderNotice}</span>
              </Alert>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="flex flex-wrap h-auto gap-1">
                <TabsTrigger value="orders" className="gap-1.5">
                  <Package className="h-4 w-4" aria-hidden="true" />
                  <span>Orders &amp; Tracking ({orders.length})</span>
                </TabsTrigger>
                <TabsTrigger value="wishlist" className="gap-1.5">
                  <Heart className="h-4 w-4" aria-hidden="true" />
                  <span>Loved Items ({lovedProducts.length})</span>
                </TabsTrigger>
                <TabsTrigger value="cart" className="gap-1.5">
                  <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                  <span>Saved Bag ({totalCartCount})</span>
                </TabsTrigger>
                <TabsTrigger value="profile" className="gap-1.5">
                  <UserIcon className="h-4 w-4" aria-hidden="true" />
                  <span>Profile &amp; Address</span>
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Orders & Live Tracking */}
              <TabsContent value="orders" className="space-y-4">
                {orders.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center space-y-3">
                      <Package
                        className="h-8 w-8 mx-auto text-[var(--fg-muted)]"
                        aria-hidden="true"
                      />
                      <p className="text-sm font-semibold text-[var(--fg-heading)]">
                        You haven&apos;t placed an order yet
                      </p>
                      <Button asChild size="sm">
                        <Link href="/">Explore Clothing Storefront</Link>
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  orders.map((order) => {
                    const statusBadge =
                      STATUS_BADGE_MAP[order.orderStatus] ||
                      STATUS_BADGE_MAP.CONFIRMED;
                    const isTerminal =
                      order.orderStatus === 'COMPLETED' ||
                      order.orderStatus === 'CANCELLED';

                    return (
                      <Card key={order.orderId}>
                        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-color)]">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <CardTitle>{order.orderId}</CardTitle>
                              <Badge variant={statusBadge.variant}>
                                {statusBadge.label}
                              </Badge>
                              <Badge variant="secondary">
                                Payment: {order.paymentStatus}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs text-[var(--fg-muted)]">
                              Placed{' '}
                              {new Date(order.issuedAt).toLocaleString()} &bull;{' '}
                              {order.paymentMethodLabel} &bull;{' '}
                              {order.fulfillmentMethod}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <Button asChild variant="outline" size="sm">
                              <a
                                href={`/api/storefront/documents/${encodeURIComponent(order.orderId)}?type=invoice`}
                                target="_blank"
                                rel="noreferrer"
                                className="gap-1.5"
                              >
                                <FileText
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                                <span>Invoice PDF</span>
                                <ExternalLink
                                  className="h-3 w-3"
                                  aria-hidden="true"
                                />
                              </a>
                            </Button>
                            <Button asChild variant="outline" size="sm">
                              <a
                                href={`/api/storefront/documents/${encodeURIComponent(order.orderId)}?type=receipt`}
                                target="_blank"
                                rel="noreferrer"
                                className="gap-1.5"
                              >
                                <FileText
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                                <span>Receipt PDF</span>
                                <ExternalLink
                                  className="h-3 w-3"
                                  aria-hidden="true"
                                />
                              </a>
                            </Button>
                          </div>
                        </CardHeader>

                        <CardContent className="p-5 space-y-5">
                          {/* Items */}
                          <div className="space-y-2.5">
                            {order.items.map((item, idx) => (
                              <div
                                key={`${order.orderId}-item-${idx}`}
                                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--surface-elevated)] p-2.5 text-xs"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="h-12 w-12 rounded-md bg-[var(--surface-card)] p-1 flex items-center justify-center border border-[var(--border-color)]">
                                    <OptimizedImage
                                      src={item.imageUrl || '/images/shirt.png'}
                                      alt={item.title}
                                      width={48}
                                      height={48}
                                      className="max-h-full w-auto object-contain"
                                    />
                                  </div>
                                  <div>
                                    <Link
                                      href={`/products/${item.productSlug}`}
                                      className="font-bold text-[var(--fg-heading)] hover:text-[#5C5EDC]"
                                    >
                                      {item.title}
                                    </Link>
                                    <div className="text-[var(--fg-muted)]">
                                      {item.color} / Size {item.size} &bull; Qty{' '}
                                      {item.quantity} &bull; SKU{' '}
                                      <code>{item.variantSku}</code>
                                    </div>
                                  </div>
                                </div>
                                <span className="font-bold text-[var(--fg-heading)]">
                                  ${item.lineTotal.toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Destination & Total */}
                          <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-t border-[var(--border-color)] pt-3">
                            <div className="text-[var(--fg-muted)]">
                              <strong className="text-[var(--fg-heading)]">
                                {order.fulfillmentMethod === 'COLLECTION'
                                  ? 'Pickup Boutique:'
                                  : 'Delivery Address:'}
                              </strong>{' '}
                              {order.shippingAddress ||
                                order.collectionLocation ||
                                'Flagship Storefront Atelier'}
                            </div>
                            <div className="text-sm font-bold text-[#797BED]">
                              Total: ${order.totals.grandTotal.toFixed(2)}
                            </div>
                          </div>

                          {/* Status Timeline */}
                          <div className="space-y-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-drawer)] p-4">
                            <div className="text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                              Live Tracking &amp; Email Updates
                            </div>
                            <div className="space-y-2.5 pt-1">
                              {order.statusTimeline.map((entry, idx) => (
                                <div
                                  key={`${order.orderId}-tl-${idx}`}
                                  className="flex items-start justify-between gap-2 text-xs"
                                >
                                  <div className="flex items-start gap-2">
                                    <CheckCircle2
                                      className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5"
                                      aria-hidden="true"
                                    />
                                    <div>
                                      <div className="font-semibold text-[var(--fg-heading)]">
                                        {entry.label}
                                      </div>
                                      {entry.note && (
                                        <div className="text-[var(--fg-muted)]">
                                          {entry.note}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <div className="text-[var(--fg-muted)]">
                                      {new Date(
                                        entry.timestamp
                                      ).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </div>
                                    {entry.emailSent && (
                                      <span className="inline-flex items-center gap-1 text-[10px] text-[#797BED]">
                                        <Mail
                                          className="h-2.5 w-2.5"
                                          aria-hidden="true"
                                        />
                                        Emailed
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {!isTerminal && (
                              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[var(--border-color)]">
                                <span className="text-[11px] text-[var(--fg-muted)] mr-1">
                                  Simulate Tracking Update (Emails Customer):
                                </span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  disabled={updatingOrderId === order.orderId}
                                  onClick={() =>
                                    void handleAdvanceStatus(
                                      order.orderId,
                                      'PROCESSING'
                                    )
                                  }
                                >
                                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                                  Preparing
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  disabled={updatingOrderId === order.orderId}
                                  onClick={() =>
                                    void handleAdvanceStatus(
                                      order.orderId,
                                      order.fulfillmentMethod === 'COLLECTION'
                                        ? 'READY_FOR_COLLECTION'
                                        : 'OUT_FOR_DELIVERY'
                                    )
                                  }
                                >
                                  <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                                  {order.fulfillmentMethod === 'COLLECTION'
                                    ? 'Ready for Pickup'
                                    : 'Out for Delivery'}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={updatingOrderId === order.orderId}
                                  onClick={() =>
                                    void handleAdvanceStatus(
                                      order.orderId,
                                      'COMPLETED'
                                    )
                                  }
                                >
                                  Mark Completed
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  disabled={updatingOrderId === order.orderId}
                                  onClick={() =>
                                    void handleAdvanceStatus(
                                      order.orderId,
                                      'CANCELLED'
                                    )
                                  }
                                >
                                  Cancel &amp; Release Stock
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </TabsContent>

              {/* Tab 2: Loved Items */}
              <TabsContent value="wishlist">
                {lovedProducts.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center space-y-3">
                      <Heart
                        className="h-8 w-8 mx-auto text-[var(--fg-muted)]"
                        aria-hidden="true"
                      />
                      <p className="text-sm font-semibold text-[var(--fg-heading)]">
                        No loved items saved yet
                      </p>
                      <Button asChild size="sm">
                        <Link href="/">Discover Clothing Pieces</Link>
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {lovedProducts.map((item) => (
                      <Card key={item.id}>
                        <CardContent className="p-4 flex flex-col gap-3">
                          <Link
                            href={`/products/${item.slug}`}
                            className="flex h-40 items-center justify-center rounded-lg bg-[var(--surface-elevated)] p-3"
                          >
                            <OptimizedImage
                              src={item.images[0] || '/images/shirt.png'}
                              alt={item.title}
                              width={160}
                              height={160}
                              className="max-h-full w-auto object-contain"
                            />
                          </Link>
                          <div>
                            <Link
                              href={`/products/${item.slug}`}
                              className="font-bold text-sm text-[var(--fg-heading)] hover:text-[#5C5EDC]"
                            >
                              {item.title}
                            </Link>
                            <div className="text-xs text-[var(--fg-muted)]">
                              {item.brand} &bull; ${item.price}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <Button
                              type="button"
                              size="sm"
                              className="flex-1 gap-1.5"
                              onClick={() => addToCart(item)}
                            >
                              <ShoppingCart
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                              <span>Add to Bag</span>
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              aria-label={`Remove ${item.title} from loved items`}
                              onClick={() => void toggleWishlist(item)}
                            >
                              <Trash2 className="h-4 w-4 text-rose-500" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Tab 3: Saved Bag */}
              <TabsContent value="cart">
                <Card>
                  <CardContent className="p-6 space-y-4">
                    {cartItems.length === 0 ? (
                      <div className="text-center py-6 space-y-3">
                        <p className="text-sm text-[var(--fg-muted)]">
                          Your saved shopping bag is currently empty.
                        </p>
                        <Button asChild size="sm">
                          <Link href="/">Browse Clothing Grid</Link>
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-3">
                          {cartItems.map((ci) => (
                            <div
                              key={ci.cartItemId}
                              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--surface-elevated)] p-3 text-sm"
                            >
                              <div className="flex items-center gap-3">
                                <OptimizedImage
                                  src={ci.images[0] || '/images/shirt.png'}
                                  alt={ci.title}
                                  width={52}
                                  height={52}
                                  className="h-12 w-12 object-contain rounded bg-[var(--surface-card)] p-1"
                                />
                                <div>
                                  <Link
                                    href={`/products/${ci.slug}`}
                                    className="font-bold text-[var(--fg-heading)] hover:text-[#5C5EDC]"
                                  >
                                    {ci.title}
                                  </Link>
                                  <div className="text-xs text-[var(--fg-muted)]">
                                    {ci.selectedColor} / Size {ci.selectedSize}{' '}
                                    &bull; Qty {ci.quantity}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-[#797BED]">
                                  ${(ci.price * ci.quantity).toFixed(2)}
                                </span>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  aria-label={`Remove ${ci.title}`}
                                  onClick={() => removeCartItem(ci.cartItemId)}
                                >
                                  <Trash2 className="h-4 w-4 text-rose-500" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-end pt-2">
                          <Button
                            type="button"
                            onClick={() => setIsCartOpen(true)}
                          >
                            Open Checkout Drawer
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 4: Profile & Address */}
              <TabsContent value="profile">
                <Card>
                  <CardHeader>
                    <CardTitle>Profile &amp; Saved Delivery Address</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form
                      onSubmit={handleSaveProfile}
                      className="space-y-4 max-w-lg"
                    >
                      {profileSavedMsg && (
                        <Alert variant="success">
                          <CheckCircle2
                            className="h-4 w-4 shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                          <span className="text-xs">{profileSavedMsg}</span>
                        </Alert>
                      )}

                      <div className="space-y-1">
                        <label
                          htmlFor="profile-name"
                          className="text-xs font-semibold text-[var(--fg-heading)]"
                        >
                          Full Name
                        </label>
                        <Input
                          id="profile-name"
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="profile-phone"
                          className="text-xs font-semibold text-[var(--fg-heading)]"
                        >
                          Phone Number
                        </label>
                        <Input
                          id="profile-phone"
                          value={profilePhone}
                          onChange={(e) => setProfilePhone(e.target.value)}
                          placeholder="+1 (415) 555-0192"
                        />
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="profile-address"
                          className="text-xs font-semibold text-[var(--fg-heading)]"
                        >
                          Default Shipping Address
                        </label>
                        <Textarea
                          id="profile-address"
                          value={profileAddress}
                          onChange={(e) => setProfileAddress(e.target.value)}
                          placeholder="Street address, suite, city, postal code"
                        />
                      </div>

                      <Button type="submit" disabled={savingProfile}>
                        {savingProfile ? 'Saving Profile...' : 'Save Changes'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-[var(--fg-muted)]">
          Loading account portal...
        </div>
      }
    >
      <AccountPortalContent />
    </Suspense>
  );
}
