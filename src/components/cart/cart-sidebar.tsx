'use client'

import { useEffect, useId, useState } from 'react'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { CACHE_TIMES, storefrontQueryKeys, useAuth } from '../../context'
import { PAYMENT_OPTIONS, calculateOrderTotalsCents, type CartLineItem } from '../../lib/utils/data'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { getBillingDetails } from '@/lib/payload-sdk'
import { Drawer, DrawerContent } from '../ui/drawer'
import { toast } from '../ui/toast'
import { CartBagStep } from './cart-bag-step'
import { CartCheckoutStep } from './cart-checkout-step'
import { CartEmptyState } from './cart-empty-state'
import { CartOrderSuccessStep } from './cart-order-success-step'
import {
  COLLECTION_LOCATIONS,
  DEFAULT_SHIPPING_ADDRESS,
  checkoutSchema,
  type CheckoutFormValues,
  type CheckoutSuccessResponse,
} from './checkout-schema'
import { neonAuthClient } from '@/lib/auth-client'

interface CartSidebarProps {
  isOpen: boolean
  onClose: () => void
  items: CartLineItem[]
  onUpdateQuantity: (cartItemId: string, nextQty: number) => void
  onRemoveItem: (cartItemId: string) => void
  onClearCart: () => void
}

const CartSidebar = ({
  isOpen,
  onClose,
  items = [],
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
}: CartSidebarProps) => {
  const queryClient = useQueryClient()
  const { data: sessionData } = neonAuthClient.useSession()
  const user = sessionData?.user
  const { openAuthModal } = useAuth()
  const isMobile = useIsMobile()
  const baseId = useId()

  const [step, setStep] = useState<'cart' | 'checkout' | 'success'>('cart')
  const [orderResult, setOrderResult] = useState<CheckoutSuccessResponse | null>(null)

  const { data: billingDetails } = useQuery({
    queryKey: storefrontQueryKeys.billingDetails(user?.id),
    queryFn: () => getBillingDetails(user!.id),
    enabled: Boolean(user?.id),
    ...CACHE_TIMES.userState,
  })

  const checkoutForm = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    mode: 'onTouched',
    defaultValues: {
      paymentOption: 'pay_and_delivery',
      customerName: user?.name || 'Alex Rivera',
      customerEmail: user?.email || 'alex.rivera@example.com',
      customerPhone: billingDetails?.phone || '+1 (415) 555-0192',
      shippingAddress: billingDetails?.shippingAddress || DEFAULT_SHIPPING_ADDRESS,
      collectionLocation: COLLECTION_LOCATIONS[0],
      ccName: user?.name || 'Alex Rivera',
      ccNumber: '4242 4242 4242 4242',
      ccExp: '08/29',
      ccCsc: '842',
      simulatePaymentFailure: false,
    },
  })

  // Pre-fill profile details when user logs in
  useEffect(() => {
    if (!user) return
    checkoutForm.setValue('customerName', user.name || '')
    checkoutForm.setValue('customerEmail', user.email || '')
    checkoutForm.setValue('ccName', user.name || '')
  }, [user, checkoutForm])

  // Pre-fill billing details (phone & shipping address) when loaded from Payload
  useEffect(() => {
    if (!billingDetails) return
    if (billingDetails.phone) {
      checkoutForm.setValue('customerPhone', billingDetails.phone)
    }
    if (billingDetails.shippingAddress) {
      checkoutForm.setValue('shippingAddress', billingDetails.shippingAddress)
    }
  }, [billingDetails, checkoutForm])

  const paymentOption = checkoutForm.watch('paymentOption')
  const selectedPaymentMeta =
    PAYMENT_OPTIONS.find((opt) => opt.id === paymentOption) || PAYMENT_OPTIONS[0]

  const {
    subTotalCents: subTotal,
    taxCents: tax,
    shippingCents: shippingFee,
    grandTotalCents: grandTotal,
  } = calculateOrderTotalsCents(
    items.map((item) => ({
      unitPriceCents: item.unitPrice ?? item.price,
      quantity: item.quantity,
    })),
    selectedPaymentMeta.fulfillmentMethod,
  )
  const isEmpty = items.length === 0
  const totalItemCount = items.reduce((sum, i) => sum + i.quantity, 0)

  useEffect(() => {
    if (!isOpen) {
      setStep('cart')
      setOrderResult(null)
    }
  }, [isOpen])

  useEffect(() => {
    if (items.length > 0 && step === 'success') {
      setStep('cart')
      setOrderResult(null)
    }
  }, [items.length, step])

  const handleCloseSidebar = () => {
    setStep('cart')
    setOrderResult(null)
    onClose()
  }

  const handleProceedToCheckout = () => {
    if (!user) {
      onClose()
      openAuthModal('checkout')
      return
    }
    setStep('checkout')
  }

  const checkoutMutation = useMutation({
    mutationFn: async (values: CheckoutFormValues) => {
      const meta =
        PAYMENT_OPTIONS.find((opt) => opt.id === values.paymentOption) || PAYMENT_OPTIONS[0]
      const idempotencyKey = `chk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

      const { data } = await axios.post<CheckoutSuccessResponse>('/api/checkout', {
        idempotencyKey,
        userId: user?.id,
        paymentOption: values.paymentOption,
        simulatePaymentFailure: values.simulatePaymentFailure,
        customer: {
          name: values.customerName.trim(),
          email: values.customerEmail.trim(),
          phone: values.customerPhone.trim(),
          address: meta.requiresShippingAddress
            ? values.shippingAddress.trim()
            : values.collectionLocation,
          collectionLocation:
            meta.fulfillmentMethod === 'COLLECTION' ? values.collectionLocation : undefined,
        },
        payment: meta.requiresCardNow
          ? {
              cardholderName: values.ccName.trim(),
              cardNumber: values.ccNumber.replace(/\s+/g, ''),
              expiry: values.ccExp.trim(),
            }
          : undefined,
        items: items.map((item) => ({
          id: String(
            typeof item.product === 'object' && item.product !== null
              ? item.product.id
              : (item.product ?? item.productSlug),
          ),
          slug: item.productSlug,
          variantSku: item.variantSku,
          title: item.title,
          brand: item.brand,
          category: item.category,
          subcategory: item.subcategory,
          size: item.selectedSize,
          color: item.selectedColor,
          price: item.unitPrice ?? item.price,
          quantity: item.quantity,
          images: item.imageUrl ? [item.imageUrl] : [],
        })),
      })

      return data
    },
    onSuccess: async (data) => {
      setOrderResult(data)
      setStep('success')
      onClearCart()
      toast.add({
        type: 'success',
        description: `Order ${data.order.orderId} confirmed!`,
      })
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: storefrontQueryKeys.orders(user?.id || user?.email),
        }),
        queryClient.invalidateQueries({ queryKey: storefrontQueryKeys.cart(user?.id) }),
        queryClient.invalidateQueries({ queryKey: storefrontQueryKeys.catalog }),
      ])
    },
    onError: async (err: unknown) => {
      let message = 'We couldn’t process the purchase. Please try again.'
      let stockReleased = false

      if (axios.isAxiosError<{ error?: string; stockReleased?: boolean }>(err)) {
        const responseData = err.response?.data
        if (responseData?.error) {
          message = responseData.error
        } else if (err.message) {
          message = err.message
        }
        stockReleased = Boolean(responseData?.stockReleased)
      } else if (err instanceof Error && err.message) {
        message = err.message
      }

      if (stockReleased) {
        await queryClient.invalidateQueries({ queryKey: storefrontQueryKeys.catalog })
        toast.add({
          type: 'error',
          title: 'Checkout failed — reserved stock released',
          description: message,
        })
        return
      }

      toast.add({
        type: 'error',
        description: message,
      })
    },
  })

  const onSubmitCheckout = (values: CheckoutFormValues) => {
    if (checkoutMutation.isPending || isEmpty) return
    checkoutMutation.mutate(values)
  }

  return (
    <Drawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleCloseSidebar()
        }
      }}
      showSwipeHandle={isMobile}
      swipeDirection={isMobile ? 'down' : 'right'}
      aria-label="Shopping Cart and Checkout"
    >
      <DrawerContent>
        {step === 'success' && orderResult ? (
          <CartOrderSuccessStep orderResult={orderResult} onClose={handleCloseSidebar} />
        ) : isEmpty ? (
          <CartEmptyState />
        ) : step === 'checkout' ? (
          <CartCheckoutStep
            form={checkoutForm}
            baseId={baseId}
            selectedPaymentMeta={selectedPaymentMeta}
            totalItemCount={totalItemCount}
            subTotal={subTotal}
            tax={tax}
            shippingFee={shippingFee}
            grandTotal={grandTotal}
            isPending={checkoutMutation.isPending}
            onBackToCart={() => setStep('cart')}
            onSubmit={onSubmitCheckout}
          />
        ) : (
          <CartBagStep
            items={items}
            totalItemCount={totalItemCount}
            subTotal={subTotal}
            tax={tax}
            isAuthenticated={Boolean(user)}
            onUpdateQuantity={onUpdateQuantity}
            onRemoveItem={onRemoveItem}
            onClearCart={onClearCart}
            onProceedToCheckout={handleProceedToCheckout}
          />
        )}
      </DrawerContent>
    </Drawer>
  )
}

export default CartSidebar
