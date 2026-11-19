'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Heart, Mail, Package, ShoppingBag, User as UserIcon } from 'lucide-react'
import {
  CACHE_TIMES,
  fetchCatalogData,
  storefrontQueryKeys,
  useAuth,
  useCart,
  useWishlist,
} from '../../../context'
import { getOrdersByUser, updateOrderStatusViaSdk } from '../../../lib/payload-sdk'
import type { Order } from '../../../lib/utils/data'
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
  const queryClient = useQueryClient()

  const { user, openAuthModal } = useAuth()
  const { cartItems, totalCartCount, setIsCartOpen, addToCart, removeCartItem } = useCart()
  const { wishlistSlugs, toggleWishlist } = useWishlist()

  const { data: catalog } = useQuery({
    queryKey: storefrontQueryKeys.catalog,
    queryFn: fetchCatalogData,
    ...CACHE_TIMES.catalog,
  })
  const products = catalog?.products ?? []

  const { data: orders = [] } = useQuery({
    queryKey: storefrontQueryKeys.orders(user?.id || user?.email),
    queryFn: () => getOrdersByUser({ neonUserId: user?.id, email: user?.email }),
    enabled: Boolean(user?.id || user?.email),
    ...CACHE_TIMES.orders,
  })

  const [activeTab, setActiveTab] = useState(
    initialTab === 'wishlist' || initialTab === 'cart' || initialTab === 'profile'
      ? initialTab
      : 'orders',
  )
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

  const advanceStatusMutation = useMutation({
    mutationFn: ({
      orderId,
      nextStatus,
      deliveryFailed,
    }: {
      orderId: string
      nextStatus: Order['orderStatus']
      deliveryFailed?: boolean
    }) => updateOrderStatusViaSdk({ orderId, nextStatus, deliveryFailed }),
    onMutate: () => {
      setOrderNotice('')
    },
    onSuccess: async (res, variables) => {
      setOrderNotice(
        `Order ${variables.orderId} updated to "${variables.nextStatus}". ${
          res.emailDispatched ? 'Email status notification dispatched to your inbox.' : ''
        }`,
      )
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: storefrontQueryKeys.orders(user?.id || user?.email),
        }),
        queryClient.invalidateQueries({ queryKey: storefrontQueryKeys.catalog }),
      ])
    },
    onError: (err: unknown) => {
      setOrderNotice(err instanceof Error ? err.message : 'Unable to update order status.')
    },
  })

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
            updatingOrderId={
              advanceStatusMutation.isPending
                ? (advanceStatusMutation.variables?.orderId ?? null)
                : null
            }
            onAdvanceStatus={(orderId, nextStatus, options) =>
              advanceStatusMutation.mutate({
                orderId,
                nextStatus,
                deliveryFailed: options?.deliveryFailed,
              })
            }
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
          <AccountProfileTab user={user} />
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
