'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Heart, Mail, Package, ShoppingBag, User as UserIcon } from 'lucide-react'
import { useStore } from '../../../context/store-context'
import { updateOrderStatusViaSdk } from '../../../lib/payload-sdk'
import type { StoreOrderRecord } from '../../../data/utils'
import { Alert } from '../../../components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs'
import {
  AccountCartTab,
  AccountGuestPrompt,
  AccountHeader,
  AccountOrdersTab,
  AccountProfileTab,
  AccountSkeleton,
  AccountWishlistTab,
} from '../../../components/account'

function AccountPortalContent() {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab')

  const {
    user,
    orders,
    products,
    wishlistSlugs,
    toggleWishlist,
    cartItems,
    totalCartCount,
    setIsCartOpen,
    addToCart,
    removeCartItem,
    openAuthModal,
    updateProfile,
    refreshUserOrders,
  } = useStore()

  const [activeTab, setActiveTab] = useState(
    initialTab === 'wishlist' || initialTab === 'cart' || initialTab === 'profile'
      ? initialTab
      : 'orders',
  )
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)
  const [orderNotice, setOrderNotice] = useState('')

  useEffect(() => {
    if (
      initialTab === 'wishlist' ||
      initialTab === 'cart' ||
      initialTab === 'profile' ||
      initialTab === 'orders'
    ) {
      setActiveTab(initialTab)
    }
  }, [initialTab])

  const lovedProducts = products.filter((p) => wishlistSlugs.includes(p.slug))

  const handleAdvanceStatus = async (
    orderId: string,
    nextStatus: StoreOrderRecord['orderStatus'],
  ) => {
    setUpdatingOrderId(orderId)
    setOrderNotice('')
    try {
      const res = await updateOrderStatusViaSdk({
        orderId,
        nextStatus,
      })
      setOrderNotice(
        `Order ${orderId} updated to "${nextStatus}". ${
          res.emailDispatched ? 'Email status notification dispatched to your inbox.' : ''
        }`,
      )
      await refreshUserOrders()
    } catch (err: unknown) {
      setOrderNotice(err instanceof Error ? err.message : 'Unable to update order status.')
    } finally {
      setUpdatingOrderId(null)
    }
  }

  if (!user) {
    return (
      <AccountGuestPrompt
        totalCartCount={totalCartCount}
        onOpenAuthModal={() => openAuthModal('account')}
      />
    )
  }

  return (
    <>
      <AccountHeader
        user={user}
        ordersCount={orders.length}
        wishlistCount={wishlistSlugs.length}
        totalCartCount={totalCartCount}
      />

      {orderNotice && (
        <Alert>
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

        <TabsContent value="orders">
          <AccountOrdersTab
            orders={orders}
            updatingOrderId={updatingOrderId}
            onAdvanceStatus={(orderId, nextStatus) => void handleAdvanceStatus(orderId, nextStatus)}
          />
        </TabsContent>

        <TabsContent value="wishlist">
          <AccountWishlistTab
            lovedProducts={lovedProducts}
            onAddToCart={(item) => addToCart(item)}
            onToggleWishlist={(item) => void toggleWishlist(item)}
          />
        </TabsContent>

        <TabsContent value="cart">
          <AccountCartTab
            cartItems={cartItems}
            onRemoveCartItem={removeCartItem}
            onOpenCart={() => setIsCartOpen(true)}
          />
        </TabsContent>

        <TabsContent value="profile">
          <AccountProfileTab user={user} onUpdateProfile={updateProfile} />
        </TabsContent>
      </Tabs>
    </>
  )
}

export default function AccountPage() {
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <AccountPortalContent />
    </Suspense>
  )
}
