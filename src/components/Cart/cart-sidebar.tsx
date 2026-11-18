'use client'

import { useState, useEffect, useId } from 'react'
import Link from 'next/link'
import axios from 'axios'
import { useMutation } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  ArrowLeft,
  Check,
  Clock,
  CreditCard,
  ExternalLink,
  FileText,
  Loader2,
  Lock,
  ShoppingBag,
  Store,
  Truck,
} from 'lucide-react'
import CartItem from './cart-item'
import { useStore } from '../../context/store-context'
import { PAYMENT_OPTIONS, PaymentOptionType, type CartLineItem } from '../../data/utils'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { Alert } from '../ui/alert'
import { Badge } from '../ui/badge'
import { Button, buttonVariants } from '../ui/button'
import { Card, CardContent } from '../ui/card'
import { Checkbox } from '../ui/checkbox'
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from '../ui/drawer'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../ui/empty'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from '../ui/field'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Separator } from '../ui/separator'
import { Textarea } from '../ui/textarea'
import { toast } from '../ui/toast'

interface CheckoutSuccessResponse {
  success: boolean
  reservationKey?: string
  order: {
    orderId: string
    invoiceNumber: string
    receiptNumber: string
    issuedAt: string
    paymentOption: PaymentOptionType
    fulfillmentMethod: 'DELIVERY' | 'COLLECTION'
    orderStatus: string
    paymentSummary: {
      method: string
      status: string
    }
    totals: {
      subTotal: number
      tax: number
      shipping: number
      grandTotal: number
    }
  }
  documents: {
    invoice: {
      filename: string
      templateId: string
      pdf?: {
        url: string
        sizeBytes: number
        mimeType: string
        checksum: string
      }
      payloadSent: unknown
    }
    receipt: {
      filename: string
      templateId: string
      pdf?: {
        url: string
        sizeBytes: number
        mimeType: string
        checksum: string
      }
      payloadSent: unknown
    }
  }
  email: {
    status: string
    messageId: string
    to: string
    subject: string
    previewUrl: string | null
    templateId: string
    attachmentsCount: number
    attachments: Array<{
      filename: string
      path: string
      contentType: string
    }>
    renderedHtml: string
    html?: {
      htmlDocument: string
      checksum: string
      mimeType: string
      url: string
      sizeBytes: number
    }
    payloadSent: unknown
  }
}

interface CartSidebarProps {
  isOpen: boolean
  onClose: () => void
  items: CartLineItem[]
  onUpdateQuantity: (cartItemId: string, nextQty: number) => void
  onRemoveItem: (cartItemId: string) => void
  onClearCart: () => void
}

const COLLECTION_LOCATIONS = [
  'Flagship Storefront Atelier — 450 Mercer St, SoHo',
  'Midtown Boutique — 685 Fifth Ave, Lounge B',
  'San Francisco Jackson Square Showroom',
]

const DEFAULT_SHIPPING_ADDRESS = '742 Evergreen Terrace, Suite 200\nSan Francisco, CA 94107'

const checkoutSchema = z
  .object({
    paymentOption: z.enum([
      'pay_and_delivery',
      'pay_then_collect',
      'pay_on_delivery',
      'pay_on_collection',
    ]),
    customerName: z
      .string()
      .trim()
      .min(2, { message: 'Please enter your full name.' })
      .max(100, { message: 'Full name must be 100 characters or fewer.' }),
    customerEmail: z.email({ message: 'Please enter a valid email address.' }),
    customerPhone: z.string().trim(),
    shippingAddress: z.string().max(300, {
      message: 'Delivery address must be 300 characters or fewer.',
    }),
    collectionLocation: z.string(),
    ccName: z.string().max(50, {
      message: 'Cardholder name must be 50 characters or fewer.',
    }),
    ccNumber: z.string(),
    ccExp: z.string(),
    ccCsc: z.string(),
    simulatePaymentFailure: z.boolean(),
  })
  .superRefine((values, ctx) => {
    const meta =
      PAYMENT_OPTIONS.find((opt) => opt.id === values.paymentOption) || PAYMENT_OPTIONS[0]

    if (meta.requiresShippingAddress && !values.shippingAddress.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['shippingAddress'],
        message: 'Please enter a delivery address.',
      })
    }

    if (!meta.requiresShippingAddress && !values.collectionLocation.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['collectionLocation'],
        message: 'Please select a collection boutique.',
      })
    }

    if (meta.requiresCardNow) {
      if (!values.ccName.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['ccName'],
          message: 'Enter the cardholder name.',
        })
      }
      if (!/^[\d ]{13,19}$/.test(values.ccNumber.trim())) {
        ctx.addIssue({
          code: 'custom',
          path: ['ccNumber'],
          message: 'Enter a valid 13–19 digit card number.',
        })
      }
      if (!/^(0[1-9]|1[0-2])\/[0-9]{2}$/.test(values.ccExp.trim())) {
        ctx.addIssue({
          code: 'custom',
          path: ['ccExp'],
          message: 'Use MM/YY.',
        })
      }
      if (!/^[0-9]{3,4}$/.test(values.ccCsc.trim())) {
        ctx.addIssue({
          code: 'custom',
          path: ['ccCsc'],
          message: '3–4 digits.',
        })
      }
    }
  })

type CheckoutFormValues = z.infer<typeof checkoutSchema>

function getPaymentOptionIcon(optionId: PaymentOptionType) {
  switch (optionId) {
    case 'pay_and_delivery':
      return <CreditCard className="h-4 w-4 text-primary" aria-hidden="true" />
    case 'pay_then_collect':
      return <Store className="h-4 w-4 text-primary" aria-hidden="true" />
    case 'pay_on_delivery':
      return <Truck className="h-4 w-4 text-emerald-500" aria-hidden="true" />
    case 'pay_on_collection':
      return <Clock className="h-4 w-4 text-amber-500" aria-hidden="true" />
  }
}

const CartSidebar = ({
  isOpen,
  onClose,
  items = [],
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
}: CartSidebarProps) => {
  const { user, openAuthModal, refreshUserOrders, refreshCatalog } = useStore()
  const isMobile = useIsMobile()
  const baseId = useId()

  const [step, setStep] = useState<'cart' | 'checkout' | 'success'>('cart')
  const [orderResult, setOrderResult] = useState<CheckoutSuccessResponse | null>(null)

  const initialAddress = user?.shippingAddresses?.[0]?.streetAddress
    ? `${user.shippingAddresses[0].streetAddress}, ${user.shippingAddresses[0].city || ''}`
    : DEFAULT_SHIPPING_ADDRESS

  const checkoutForm = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    mode: 'onTouched',
    defaultValues: {
      paymentOption: 'pay_and_delivery',
      customerName: user?.name || 'Alex Rivera',
      customerEmail: user?.email || 'alex.rivera@example.com',
      customerPhone: user?.phone || '+1 (415) 555-0192',
      shippingAddress: initialAddress,
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
    if (user.phone) {
      checkoutForm.setValue('customerPhone', user.phone)
    }
    checkoutForm.setValue('ccName', user.name || '')
    if (user.shippingAddresses?.[0]?.streetAddress) {
      const addr = user.shippingAddresses[0]
      checkoutForm.setValue(
        'shippingAddress',
        `${addr.streetAddress}${addr.city ? `, ${addr.city}` : ''}${addr.postalCode ? ` ${addr.postalCode}` : ''}`,
      )
    }
  }, [user, checkoutForm])

  const paymentOption = checkoutForm.watch('paymentOption')
  const selectedPaymentMeta =
    PAYMENT_OPTIONS.find((opt) => opt.id === paymentOption) || PAYMENT_OPTIONS[0]

  const subTotal = Number(
    items.reduce((acc, item) => acc + item.price * item.quantity, 0).toFixed(2),
  )
  const tax = Number((subTotal * 0.08).toFixed(2))
  const shippingFee = selectedPaymentMeta.fulfillmentMethod === 'DELIVERY' ? 12 : 0
  const grandTotal = Number((subTotal + tax + shippingFee).toFixed(2))
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
          id: item.id,
          slug: item.slug,
          variantSku: item.variantSku,
          title: item.title,
          brand: item.brand,
          category: item.category,
          subcategory: item.subcategory,
          size: item.selectedSize,
          color: item.selectedColor,
          price: item.unitPrice ?? item.price,
          quantity: item.quantity,
          images: item.images,
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
      await refreshUserOrders()
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
        await refreshCatalog()
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
          <div
            className="min-h-0 flex-1 overflow-y-auto px-4 py-6"
            role="status"
            aria-live="polite"
          >
            <Empty className="p-2">
              <EmptyHeader>
                <EmptyMedia
                  variant="icon"
                  className="size-16 rounded-full border border-dashed border-border bg-secondary text-emerald-500 [&_svg:not([class*='size-'])]:size-8"
                >
                  <Check aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle className="text-xl font-bold">Order Confirmed!</EmptyTitle>
                <EmptyDescription>
                  Order <strong>{orderResult.order.orderId}</strong> has been allocated cleanly by
                  our durable checkout workflow. Your <strong>Invoice</strong> &amp;{' '}
                  <strong>Receipt</strong> PDFs and confirmation email have been dispatched to{' '}
                  <strong>{orderResult.email.to}</strong>.
                </EmptyDescription>
              </EmptyHeader>

              <EmptyContent className="w-full max-w-none gap-3">
                <Card className="w-full text-left text-xs">
                  <CardContent className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Order ID</span>
                      <strong className="text-foreground">{orderResult.order.orderId}</strong>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Payment Mode</span>
                      <code className="text-primary">{orderResult.order.paymentSummary?.method}</code>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Payment Status</span>
                      <code className="text-primary">{orderResult.order.paymentSummary?.status}</code>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Fulfillment</span>
                      <code className="text-primary">{orderResult.order.fulfillmentMethod}</code>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Total</span>
                      <strong className="text-foreground">
                        ${orderResult.order.totals.grandTotal.toFixed(2)}
                      </strong>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Email Status</span>
                      <code className="text-primary">{orderResult.email.status}</code>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Invoice PDF</span>
                      <a
                        href={`/api/storefront/documents/${encodeURIComponent(orderResult.order.orderId)}?type=invoice`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="truncate max-w-[170px]">
                          {orderResult.documents.invoice.filename}
                        </span>
                        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                      </a>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Receipt PDF</span>
                      <a
                        href={`/api/storefront/documents/${encodeURIComponent(orderResult.order.orderId)}?type=receipt`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="truncate max-w-[170px]">
                          {orderResult.documents.receipt.filename}
                        </span>
                        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                      </a>
                    </div>
                  </CardContent>
                </Card>

                <Link
                  href="/account"
                  onClick={handleCloseSidebar}
                  className={buttonVariants({ className: 'w-full' })}
                >
                  Track Order in My Account
                </Link>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleCloseSidebar}
                >
                  Continue Shopping
                </Button>
              </EmptyContent>
            </Empty>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <Empty>
              <EmptyHeader>
                <EmptyMedia
                  variant="icon"
                  className="size-16 rounded-full border border-dashed border-border bg-secondary text-primary [&_svg:not([class*='size-'])]:size-7"
                >
                  <ShoppingBag aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle className="text-lg font-bold">Your cart is empty</EmptyTitle>
                <EmptyDescription>
                  Explore our collection of jackets, shirts, dresses, trousers, and shoes to add
                  items to your bag.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : step === 'checkout' ? (
          <>
            <DrawerHeader className="border-b border-border pb-3">
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-2 gap-1.5"
                  onClick={() => setStep('cart')}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  <span>Back to Cart</span>
                </Button>
                <Badge variant="secondary" aria-current="step">
                  Step 2 of 2: Checkout
                </Badge>
              </div>
              <DrawerTitle className="pt-1 text-lg font-bold">
                Payment and Stock Reservation
              </DrawerTitle>
            </DrawerHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <form
                method="POST"
                action="/api/checkout"
                className="space-y-5"
                onSubmit={checkoutForm.handleSubmit(onSubmitCheckout)}
                noValidate
              >
                {/* Payment & Fulfillment Options */}
                <FieldSet className="gap-3 rounded-lg border border-border bg-card p-3.5">
                  <FieldLegend className="mb-0 text-xs font-bold uppercase tracking-wider text-primary">
                    Payment &amp; Fulfillment Method
                  </FieldLegend>

                  <Controller
                    name="paymentOption"
                    control={checkoutForm.control}
                    render={({ field }) => (
                      <div className="grid grid-cols-1 gap-2">
                        {PAYMENT_OPTIONS.map((option) => {
                          const selected = field.value === option.id
                          const optionId = `${baseId}-payment-${option.id}`

                          return (
                            <FieldLabel
                              key={option.id}
                              htmlFor={optionId}
                              className="cursor-pointer"
                            >
                              <Field orientation="horizontal">
                                <Checkbox
                                  id={optionId}
                                  checked={selected}
                                  onCheckedChange={() => field.onChange(option.id)}
                                  className="mt-0.5"
                                />
                                <FieldContent>
                                  <div className="flex w-full items-center justify-between gap-2">
                                    <FieldTitle className="text-xs font-bold">
                                      {getPaymentOptionIcon(option.id)}
                                      <span>{option.label}</span>
                                    </FieldTitle>
                                    <Badge variant="secondary" className="text-[10px]">
                                      {option.badge}
                                    </Badge>
                                  </div>
                                  <FieldDescription className="text-xs leading-snug">
                                    {option.description}
                                  </FieldDescription>
                                </FieldContent>
                              </Field>
                            </FieldLabel>
                          )
                        })}
                      </div>
                    )}
                  />
                </FieldSet>

                {/* Customer & Delivery/Collection */}
                <FieldSet className="gap-3 rounded-lg border border-border bg-card p-3.5">
                  <FieldLegend className="mb-0 text-xs font-bold uppercase tracking-wider text-primary">
                    Customer &amp;{' '}
                    {selectedPaymentMeta.fulfillmentMethod === 'COLLECTION'
                      ? 'Store Pickup'
                      : 'Delivery'}
                  </FieldLegend>

                  <FieldGroup className="gap-3.5">
                    <Controller
                      name="customerName"
                      control={checkoutForm.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor={`${baseId}-name`}>Full name (required)</FieldLabel>
                          <Input
                            {...field}
                            id={`${baseId}-name`}
                            name="name"
                            type="text"
                            required
                            maxLength={100}
                            autoComplete="name"
                            enterKeyHint="next"
                            aria-invalid={fieldState.invalid}
                            placeholder="Alex Rivera"
                          />
                          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                        </Field>
                      )}
                    />

                    <Controller
                      name="customerEmail"
                      control={checkoutForm.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor={`${baseId}-email`}>
                            Email for Invoice, Receipt &amp; Tracking Updates (required)
                          </FieldLabel>
                          <Input
                            {...field}
                            id={`${baseId}-email`}
                            name="email"
                            type="email"
                            required
                            autoComplete="email"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            enterKeyHint="next"
                            aria-invalid={fieldState.invalid}
                            placeholder="alex.rivera@example.com"
                          />
                          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                        </Field>
                      )}
                    />

                    <Controller
                      name="customerPhone"
                      control={checkoutForm.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor={`${baseId}-phone`}>
                            Phone for Courier / Pickup SMS
                          </FieldLabel>
                          <Input
                            {...field}
                            id={`${baseId}-phone`}
                            name="phone"
                            type="tel"
                            autoComplete="tel"
                            enterKeyHint="next"
                            aria-invalid={fieldState.invalid}
                            placeholder="+1 (415) 555-0192"
                          />
                          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                        </Field>
                      )}
                    />

                    {selectedPaymentMeta.requiresShippingAddress ? (
                      <Controller
                        name="shippingAddress"
                        control={checkoutForm.control}
                        render={({ field, fieldState }) => (
                          <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor={`${baseId}-address`}>
                              Shipping &amp; Delivery Address (required)
                            </FieldLabel>
                            <Textarea
                              {...field}
                              id={`${baseId}-address`}
                              name="address"
                              required
                              rows={2}
                              maxLength={300}
                              autoComplete="shipping street-address"
                              aria-invalid={fieldState.invalid}
                              placeholder="742 Evergreen Terrace, Suite 200"
                            />
                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                          </Field>
                        )}
                      />
                    ) : (
                      <Controller
                        name="collectionLocation"
                        control={checkoutForm.control}
                        render={({ field, fieldState }) => (
                          <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor={`${baseId}-collection`}>
                              Select Store Collection Boutique
                            </FieldLabel>
                            <Select
                              value={field.value}
                              onValueChange={(value) => field.onChange(value ?? '')}
                            >
                              <SelectTrigger
                                id={`${baseId}-collection`}
                                aria-invalid={fieldState.invalid}
                                className="w-full cursor-pointer"
                              >
                                <SelectValue placeholder="Select Store Collection Boutique" />
                              </SelectTrigger>
                              <SelectContent>
                                {COLLECTION_LOCATIONS.map((loc) => (
                                  <SelectItem key={loc} value={loc}>
                                    {loc}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                          </Field>
                        )}
                      />
                    )}
                  </FieldGroup>
                </FieldSet>

                {/* Card details only if payment is upfront */}
                {selectedPaymentMeta.requiresCardNow && (
                  <FieldSet className="gap-3 rounded-lg border border-border bg-card p-3.5">
                    <FieldLegend className="mb-0 text-xs font-bold uppercase tracking-wider text-primary">
                      Online Card Payment
                    </FieldLegend>

                    <FieldGroup className="gap-3.5">
                      <Controller
                        name="ccName"
                        control={checkoutForm.control}
                        render={({ field, fieldState }) => (
                          <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor={`${baseId}-cc-name`}>
                              Name on card (required)
                            </FieldLabel>
                            <Input
                              {...field}
                              id={`${baseId}-cc-name`}
                              name="cc-name"
                              type="text"
                              required
                              maxLength={50}
                              autoComplete="cc-name"
                              enterKeyHint="next"
                              aria-invalid={fieldState.invalid}
                              placeholder="Alex Rivera"
                            />
                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                          </Field>
                        )}
                      />

                      <Controller
                        name="ccNumber"
                        control={checkoutForm.control}
                        render={({ field, fieldState }) => (
                          <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor={`${baseId}-cc-number`}>
                              Card number (required)
                            </FieldLabel>
                            <Input
                              {...field}
                              id={`${baseId}-cc-number`}
                              name="cc-number"
                              type="text"
                              required
                              autoComplete="cc-number"
                              inputMode="numeric"
                              maxLength={19}
                              enterKeyHint="next"
                              aria-invalid={fieldState.invalid}
                              placeholder="4242 4242 4242 4242"
                            />
                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                          </Field>
                        )}
                      />

                      <div className="grid grid-cols-2 items-end gap-2.5">
                        <Controller
                          name="ccExp"
                          control={checkoutForm.control}
                          render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                              <FieldLabel htmlFor={`${baseId}-cc-exp`}>
                                Expiry (required)
                              </FieldLabel>
                              <FieldDescription id={`${baseId}-cc-exp-hint`} className="text-xs">
                                Format: MM/YY
                              </FieldDescription>
                              <Input
                                {...field}
                                id={`${baseId}-cc-exp`}
                                name="cc-exp"
                                type="text"
                                required
                                autoComplete="cc-exp"
                                maxLength={5}
                                enterKeyHint="next"
                                aria-describedby={`${baseId}-cc-exp-hint`}
                                aria-invalid={fieldState.invalid}
                                placeholder="08/29"
                              />
                              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                            </Field>
                          )}
                        />

                        <Controller
                          name="ccCsc"
                          control={checkoutForm.control}
                          render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                              <FieldLabel htmlFor={`${baseId}-cc-csc`}>
                                CVC (required)
                              </FieldLabel>
                              <Input
                                {...field}
                                id={`${baseId}-cc-csc`}
                                name="cc-csc"
                                type="text"
                                required
                                autoComplete="cc-csc"
                                inputMode="numeric"
                                maxLength={4}
                                enterKeyHint="done"
                                aria-invalid={fieldState.invalid}
                                placeholder="842"
                              />
                              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                            </Field>
                          )}
                        />
                      </div>

                      <Controller
                        name="simulatePaymentFailure"
                        control={checkoutForm.control}
                        render={({ field }) => (
                          <Field
                            orientation="horizontal"
                            className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-600 dark:text-amber-400"
                          >
                            <Checkbox
                              id={`${baseId}-simulate-fail`}
                              checked={field.value}
                              onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                              className="mt-0.5"
                            />
                            <FieldLabel
                              htmlFor={`${baseId}-simulate-fail`}
                              className="cursor-pointer text-xs font-normal leading-snug text-amber-600 dark:text-amber-400"
                            >
                              <span>
                                <strong>Simulate Failed Payment:</strong> Test Workflow SDK rollback
                                &amp; automatic release of reserved stock.
                              </span>
                            </FieldLabel>
                          </Field>
                        )}
                      />
                    </FieldGroup>
                  </FieldSet>
                )}

                <div className="space-y-1.5 pt-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Subtotal ({totalItemCount} items)
                    </span>
                    <span>${subTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Taxes (8%)</span>
                    <span>${tax.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {selectedPaymentMeta.fulfillmentMethod === 'DELIVERY'
                        ? 'Courier Delivery'
                        : 'In-Store Collection'}
                    </span>
                    <span className={shippingFee === 0 ? 'font-bold text-primary' : undefined}>
                      {shippingFee === 0 ? 'FREE' : `$${shippingFee.toFixed(2)}`}
                    </span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex items-center justify-between py-1 text-base font-bold">
                    <span>Total Due</span>
                    <span>${grandTotal.toFixed(2)}</span>
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={checkoutMutation.isPending}
                >
                  {checkoutMutation.isPending && (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  )}
                  {checkoutMutation.isPending
                    ? 'Running Durable Checkout Workflow...'
                    : selectedPaymentMeta.requiresCardNow
                      ? `Pay $${grandTotal.toFixed(2)} & Place Order`
                      : `Confirm Reservation ($${grandTotal.toFixed(2)} ${selectedPaymentMeta.shortLabel})`}
                </Button>
              </form>
            </div>
          </>
        ) : (
          <>
            <DrawerHeader className="border-b border-border pb-3">
              <div className="flex items-center justify-between gap-2">
                <DrawerTitle className="text-lg font-bold">
                  My Bag ({totalItemCount})
                </DrawerTitle>
                <Button type="button" variant="outline" size="sm" onClick={onClearCart}>
                  Clear All
                </Button>
              </div>
            </DrawerHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
              <ul className="m-0 list-none p-0">
                {items.map((item) => (
                  <CartItem
                    key={item.cartItemId || item.id}
                    item={item}
                    onUpdateQuantity={onUpdateQuantity}
                    onRemove={onRemoveItem}
                  />
                ))}
              </ul>
            </div>

            <DrawerFooter className="border-t border-border bg-popover pt-3">
              {!user && (
                <Alert>
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="text-xs">
                    Sign in or create a free account at checkout to reserve stock.
                  </span>
                </Alert>
              )}

              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${subTotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Taxes (8%)</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Shipping / Collection</span>
                  <span className="font-bold text-primary">From FREE ($12 Courier)</span>
                </div>
                <Separator className="my-2" />
                <div className="flex items-center justify-between pb-1 text-base font-bold">
                  <span>Estimated Total</span>
                  <span>${(subTotal + tax).toFixed(2)}</span>
                </div>
              </div>

              <Button type="button" size="lg" className="w-full" onClick={handleProceedToCheckout}>
                {user
                  ? `Proceed to Checkout ($${(subTotal + tax).toFixed(2)})`
                  : 'Sign In / Register to Checkout'}
              </Button>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  )
}

export default CartSidebar
