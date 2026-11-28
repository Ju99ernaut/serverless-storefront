'use client'

import { useEffect, useId, useState } from 'react'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { CACHE_TIMES, storefrontQueryKeys, useAuth } from '../../context'
import {
  PAYMENT_OPTIONS,
  calculateOrderTotalsCents,
  type CartLineItem,
} from '../../lib/utils/products'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { getBillingDetails } from '@/lib/payload-sdk'
import { Drawer, DrawerContent } from '../ui/drawer'
import { toast } from '../ui/toast'
import { CartBagStep } from './cart-bag-step'
import { CartCheckoutStep } from './cart-checkout-step'
import { CartEmptyState } from './cart-empty-state'
import { CartMobilePaymentStep } from './cart-mobile-payment-step'
import { CartOrderSuccessStep } from './cart-order-success-step'
import {
  COLLECTION_LOCATIONS,
  CheckoutApiResponse,
  checkoutSchema,
  type CheckoutFormValues,
  type CheckoutPendingMobilePaymentResponse,
  type CheckoutSuccessResponse,
} from './checkout-schema'
import { neonAuthClient } from '@/lib/auth-client'
import type { Order } from '@/payload-types'
import { calculateDeliveryFee } from '@/lib/utils/delivery-fee'

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
  const { data: sessionData, isPending: isSessionPending } = neonAuthClient.useSession()
  const user = sessionData?.user
  const { openAuthModal } = useAuth()
  const isMobile = useIsMobile()
  const baseId = useId()

  const [step, setStep] = useState<'cart' | 'checkout' | 'mobile_payment' | 'success'>('cart')
  const [orderResult, setOrderResult] = useState<CheckoutSuccessResponse | null>(null)
  const [pendingMobilePayment, setPendingMobilePayment] =
    useState<CheckoutPendingMobilePaymentResponse | null>(null)
  const [mobilePaymentStatus, setMobilePaymentStatus] = useState<string>('sent')

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
      paymentProvider: 'paynow_mobile',
      mobileMethod: 'ecocash',
      mobileNumber: billingDetails?.phone || '',
      customerName: user?.name || '',
      customerEmail: user?.email || '',
      customerPhone: billingDetails?.phone || '',
      shippingAddress: billingDetails?.shippingAddress || '',
      collectionLocation: COLLECTION_LOCATIONS[0],
      ccName: user?.name || '',
      ccNumber: '',
      ccExp: '',
      ccCsc: '',
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

  const customerAddress = checkoutForm.watch('shippingAddress')
  const calculationItems = items.map((item) => ({
    unitPriceCents: item.unitPrice ?? item.price,
    quantity: item.quantity,
  }))
  const delivery = calculateDeliveryFee({ items: calculationItems, customerAddress })
  const {
    subTotalCents: subTotal,
    taxCents: tax,
    shippingCents: shippingFee,
    grandTotalCents: grandTotal,
  } = calculateOrderTotalsCents(
    calculationItems,
    selectedPaymentMeta.fulfillmentMethod,
    delivery.feeCents,
  )
  const isEmpty = items.length === 0
  const totalItemCount = items.reduce((sum, i) => sum + i.quantity, 0)

  useEffect(() => {
    if (!isOpen) {
      setStep('cart')
      setOrderResult(null)
      setPendingMobilePayment(null)
      setMobilePaymentStatus('sent')
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
    setPendingMobilePayment(null)
    setMobilePaymentStatus('sent')
    onClose()
  }

  const handleProceedToCheckout = () => {
    if (isSessionPending) return
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

      const { data } = await axios.post<CheckoutApiResponse>('/api/checkout', {
        userId: user?.id,
        paymentOption: values.paymentOption,
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
          ? values.paymentProvider === 'paynow_mobile'
            ? {
                provider: 'paynow_mobile' as const,
                mobileMethod: values.mobileMethod,
                mobileNumber: values.mobileNumber.trim(),
              }
            : values.paymentProvider === 'paynow'
              ? {
                  provider: 'paynow' as const,
                }
              : {
                  provider: 'card' as const,
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
      if ('pollUrl' in data && data.pendingPayment) {
        setPendingMobilePayment(data)
        setMobilePaymentStatus('sent')
        setStep('mobile_payment')
        if (data.mobileNumber) {
          toast.add({
            type: 'info',
            title: 'Mobile payment prompt sent',
            description: `Check your ${data.mobileMethod === 'ecocash' ? 'EcoCash' : 'InnBucks'} phone (${data.mobileNumber}) to complete payment.`,
          })
        } else {
          toast.add({
            type: 'info',
            title: 'Payment initiated',
            description: `You will be redirected to Paynow to complete the payment.`,
          })
        }
        return
      }

      const currentValues = checkoutForm.getValues()

      setOrderResult({
        success: true,
        order: {
          orderId: data.orderId,
          invoiceNumber: `INV-${data.orderId.replace('ORD-', '')}`,
          receiptNumber: `RCP-${data.orderId.replace('ORD-', '')}`,
          issuedAt: new Date().toISOString(),
          paymentOption: currentValues.paymentOption,
          fulfillmentMethod: selectedPaymentMeta.fulfillmentMethod,
          orderStatus: 'CONFIRMED',
          paymentSummary: {
            method: 'PENDING',
            status: 'PENDING',
          },
          totals: {
            subTotal,
            tax,
            shipping: shippingFee,
            grandTotal,
          },
        },
        documents: {
          invoice: {
            filename: `Invoice-${data.orderId}.pdf`,
            templateId: '',
          },
          receipt: {
            filename: `Receipt-$data.orderId}.pdf`,
            templateId: '',
          },
        },
        email: {
          status: 'sent',
          messageId: '',
          to: currentValues.customerEmail,
          subject: `Order ${data.orderId} Confirmed`,
          templateId: '',
          attachmentsCount: 2,
        },
      })
      setStep('success')
      onClearCart()
      toast.add({
        type: 'success',
        description: `Order ${data.orderId} confirmed!`,
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

  const pollMobilePaymentMutation = useMutation({
    mutationFn: async (pending: CheckoutPendingMobilePaymentResponse) => {
      const { data } = await axios.post<{
        orderId: string
        status: string
        paid: boolean
        failed: boolean
        pending: boolean
        error?: string
        order?: Order | null
      }>('/api/gateways/paynow/status', {
        orderId: pending.orderId,
        pollUrl: pending.pollUrl,
        mobileMethod: pending.mobileMethod,
        mobileNumber: pending.mobileNumber,
      })
      return data
    },
    onSuccess: async (data) => {
      setMobilePaymentStatus(data.status)

      if (data.paid) {
        const currentValues = checkoutForm.getValues()
        const orderDoc = data.order
        const walletLabel =
          pendingMobilePayment?.mobileMethod === 'ecocash'
            ? 'EcoCash'
            : pendingMobilePayment?.mobileMethod === 'innbucks'
              ? 'Innbucks'
              : 'Redirect'

        setOrderResult({
          success: true,
          order: {
            orderId: orderDoc?.orderId || data.orderId,
            invoiceNumber: orderDoc?.invoiceNumber || `INV-${data.orderId.replace('ORD-', '')}`,
            receiptNumber: orderDoc?.receiptNumber || `RCP-${data.orderId.replace('ORD-', '')}`,
            issuedAt: orderDoc?.issuedAt || new Date().toISOString(),
            paymentOption: orderDoc?.paymentOption || currentValues.paymentOption,
            fulfillmentMethod: orderDoc?.fulfillmentMethod || selectedPaymentMeta.fulfillmentMethod,
            orderStatus: orderDoc?.orderStatus || 'CONFIRMED',
            paymentSummary: {
              method: orderDoc?.paymentMethodLabel || `Paynow ${walletLabel}`,
              status: orderDoc?.paymentStatus || 'PAID',
            },
            totals: orderDoc?.totals || {
              subTotal,
              tax,
              shipping: shippingFee,
              grandTotal,
            },
          },
          documents: {
            invoice: {
              filename: `Invoice-${orderDoc?.invoiceNumber || data.orderId}.pdf`,
              templateId: '',
            },
            receipt: {
              filename: `Receipt-${orderDoc?.receiptNumber || data.orderId}.pdf`,
              templateId: '',
            },
          },
          email: {
            status: 'sent',
            messageId: '',
            to: orderDoc?.customerEmail || currentValues.customerEmail,
            subject: `Order ${data.orderId} Confirmed`,
            templateId: '',
            attachmentsCount: 2,
          },
        })
        setPendingMobilePayment(null)
        setStep('success')
        onClearCart()
        toast.add({
          type: 'success',
          description: `Paynow payment received! Order ${data.orderId} confirmed.`,
        })
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: storefrontQueryKeys.orders(user?.id || user?.email),
          }),
          queryClient.invalidateQueries({ queryKey: storefrontQueryKeys.cart(user?.id) }),
          queryClient.invalidateQueries({ queryKey: storefrontQueryKeys.catalog }),
        ])
      } else if (data.failed) {
        setPendingMobilePayment(null)
        setStep('checkout')
        await queryClient.invalidateQueries({ queryKey: storefrontQueryKeys.catalog })
        toast.add({
          type: 'error',
          title: 'Mobile payment not completed',
          description:
            data.error ||
            `Paynow reported status "${data.status}". Reserved stock has been released.`,
        })
      }
    },
    onError: (err: unknown) => {
      toast.add({
        type: 'error',
        description:
          err instanceof Error ? err.message : 'Unable to check Paynow transaction status.',
      })
    },
  })

  useEffect(() => {
    if (step !== 'mobile_payment' || !pendingMobilePayment || !isOpen) return
    const intervalId = window.setInterval(() => {
      if (!pollMobilePaymentMutation.isPending) {
        pollMobilePaymentMutation.mutate(pendingMobilePayment)
      }
    }, 10000)
    return () => window.clearInterval(intervalId)
  }, [step, pendingMobilePayment, isOpen, pollMobilePaymentMutation])

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
        ) : step === 'mobile_payment' && pendingMobilePayment ? (
          <CartMobilePaymentStep
            pendingPayment={pendingMobilePayment}
            paymentStatus={mobilePaymentStatus}
            isChecking={pollMobilePaymentMutation.isPending}
            onCheckStatus={() => pollMobilePaymentMutation.mutate(pendingMobilePayment)}
            onBackToCheckout={() => {
              setPendingMobilePayment(null)
              setStep('checkout')
            }}
          />
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
            delivery={delivery}
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
            isSessionPending={isSessionPending}
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
