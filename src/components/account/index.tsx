'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Heart, Package, ShoppingBag, User as UserIcon } from 'lucide-react'
import { CACHE_TIMES, storefrontQueryKeys, useCart, useWishlist } from '../../context'
import { getCatalogData, getOrdersByUser } from '../../lib/payload-sdk'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { neonAuthClient } from '@/lib/auth-client'
import { AccountHeader } from './account-header'
import { AccountGuestPrompt } from './account-guest-prompt'
import { AccountOrdersTab } from './account-orders-tab'
import { AccountWishlistTab } from './account-wishlist-tab'
import { AccountCartTab } from './account-cart-tab'
import { AccountProfileTab } from './account-profile-tab'

export function AccountPortalContent() {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab')

  const { data: sessionData } = neonAuthClient.useSession()
  const user = sessionData?.user
  const { totalCartCount } = useCart()
  const { wishlistSlugs } = useWishlist()

  const { data: catalog } = useQuery({
    queryKey: storefrontQueryKeys.catalog,
    queryFn: getCatalogData,
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

  if (!user) {
    return <AccountGuestPrompt />
  }

  return (
    <>
      <AccountHeader />

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
          <AccountOrdersTab />
        </TabsContent>

        <TabsContent value="wishlist">
          <AccountWishlistTab />
        </TabsContent>

        <TabsContent value="cart">
          <AccountCartTab />
        </TabsContent>

        <TabsContent value="profile">
          <AccountProfileTab />
        </TabsContent>
      </Tabs>
    </>
  )
}
