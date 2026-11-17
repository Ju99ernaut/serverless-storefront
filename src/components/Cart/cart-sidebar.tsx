'use client'

import { useState, useEffect, useRef, useId, FormEvent, FocusEvent, TouchEvent } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clock,
  CreditCard,
  ExternalLink,
  FileText,
  Lock,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  UserCheck,
  X,
} from 'lucide-react'
import styles from '../../styles/Hamburger.module.css'
import s from '../../styles/CartSidebar.module.css'
import CartItem from './cart-item'
import { useStore } from '../../context/store-context'
import { PAYMENT_OPTIONS, PaymentOptionType, type CartLineItem } from '../../data/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'

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

interface FieldInteractionState {
  hasInteracted: boolean
  hasBlurred: boolean
}

const COLLECTION_LOCATIONS = [
  'Flagship Storefront Atelier — 450 Mercer St, SoHo',
  'Midtown Boutique — 685 Fifth Ave, Lounge B',
  'San Francisco Jackson Square Showroom',
]

function getPaymentOptionIcon(optionId: PaymentOptionType) {
  switch (optionId) {
    case 'pay_and_delivery':
      return <CreditCard className="h-4 w-4 text-[#797BED]" aria-hidden="true" />
    case 'pay_then_collect':
      return <Store className="h-4 w-4 text-[#797BED]" aria-hidden="true" />
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

  const [step, setStep] = useState<'cart' | 'checkout' | 'success'>('cart')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [stockWasReleased, setStockWasReleased] = useState(false)
  const [orderResult, setOrderResult] = useState<CheckoutSuccessResponse | null>(null)
  const [showPayloadPreview, setShowPayloadPreview] = useState(false)

  const [paymentOption, setPaymentOption] = useState<PaymentOptionType>('pay_and_delivery')
  const [collectionLocation, setCollectionLocation] = useState(COLLECTION_LOCATIONS[0])
  const [simulatePaymentFailure, setSimulatePaymentFailure] = useState(false)

  const [customerName, setCustomerName] = useState(user?.name || 'Alex Rivera')
  const [customerEmail, setCustomerEmail] = useState(user?.email || 'alex.rivera@example.com')
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '+1 (415) 555-0192')
  const [shippingAddress, setShippingAddress] = useState(
    user?.shippingAddresses?.[0]?.streetAddress
      ? `${user.shippingAddresses[0].streetAddress}, ${user.shippingAddresses[0].city || ''}`
      : '742 Evergreen Terrace, Suite 200\nSan Francisco, CA 94107',
  )
  const [ccName, setCcName] = useState(user?.name || 'Alex Rivera')
  const [ccNumber, setCcNumber] = useState('4242 4242 4242 4242')
  const [ccExp, setCcExp] = useState('08/29')
  const [ccCsc, setCcCsc] = useState('842')

  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)
  const dirtyStateRef = useRef<WeakMap<Element, FieldInteractionState>>(new WeakMap())
  const touchStartXRef = useRef<number | null>(null)
  const [dragOffsetX, setDragOffsetX] = useState(0)

  const baseId = useId()
  const nameId = `${baseId}-name`
  const emailId = `${baseId}-email`
  const phoneId = `${baseId}-phone`
  const addressId = `${baseId}-address`
  const ccNameId = `${baseId}-cc-name`
  const ccNumberId = `${baseId}-cc-number`
  const ccExpId = `${baseId}-cc-exp`
  const ccCscId = `${baseId}-cc-csc`

  // Pre-fill profile details when user logs in
  useEffect(() => {
    if (user) {
      setCustomerName(user.name || '')
      setCustomerEmail(user.email || '')
      if (user.phone) setCustomerPhone(user.phone)
      setCcName(user.name || '')
      if (user.shippingAddresses?.[0]?.streetAddress) {
        const addr = user.shippingAddresses[0]
        setShippingAddress(
          `${addr.streetAddress}${addr.city ? `, ${addr.city}` : ''}${addr.postalCode ? ` ${addr.postalCode}` : ''}`,
        )
      }
    }
  }, [user])

  const selectedPaymentMeta =
    PAYMENT_OPTIONS.find((opt) => opt.id === paymentOption) || PAYMENT_OPTIONS[0]

  const subTotal = Number(
    items.reduce((acc, item) => acc + item.price * item.quantity, 0).toFixed(2),
  )
  const tax = Number((subTotal * 0.08).toFixed(2))
  const shippingFee = selectedPaymentMeta.fulfillmentMethod === 'DELIVERY' ? 12 : 0
  const grandTotal = Number((subTotal + tax + shippingFee).toFixed(2))
  const isEmpty = items.length === 0

  useEffect(() => {
    if (isOpen && closeBtnRef.current) {
      closeBtnRef.current.focus()
    }
    if (!isOpen) {
      setStep('cart')
      setOrderResult(null)
      setShowPayloadPreview(false)
      setSubmitError('')
      setStockWasReleased(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (items.length > 0 && step === 'success') {
      setStep('cart')
      setOrderResult(null)
      setShowPayloadPreview(false)
    }
  }, [items.length, step])

  const handleCloseSidebar = () => {
    setStep('cart')
    setOrderResult(null)
    setShowPayloadPreview(false)
    setSubmitError('')
    setStockWasReleased(false)
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

  const syncInputValidationState = (
    input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
    eventType: 'blur' | 'input',
  ) => {
    if (!input || typeof input.checkValidity !== 'function') return

    const supportsUserInvalid =
      typeof CSS !== 'undefined' &&
      typeof CSS.supports === 'function' &&
      CSS.supports('selector(:user-invalid)')

    if (!supportsUserInvalid) {
      const state = dirtyStateRef.current.get(input) || {
        hasInteracted: false,
        hasBlurred: false,
      }
      if (eventType === 'input') {
        state.hasInteracted = true
      } else if (eventType === 'blur') {
        state.hasBlurred = true
      }
      dirtyStateRef.current.set(input, state)

      if (state.hasInteracted && state.hasBlurred) {
        const isValid = input.checkValidity()
        input.classList.toggle(s.userInvalidFallback, !isValid)
        input.classList.toggle(s.userValidFallback, isValid)
        if (!isValid) {
          input.setAttribute('aria-invalid', 'true')
        } else {
          input.removeAttribute('aria-invalid')
        }
      }
      return
    }

    const isUserInvalid = input.matches(':user-invalid')
    if (isUserInvalid) {
      input.setAttribute('aria-invalid', 'true')
    } else {
      input.removeAttribute('aria-invalid')
    }
  }

  const handleFormBlurCapture = (e: FocusEvent<HTMLFormElement>) => {
    const target = e.target as HTMLElement
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ) {
      syncInputValidationState(target, 'blur')
    }
  }

  const handleFormInputCapture = (e: FormEvent<HTMLFormElement>) => {
    const target = e.target as HTMLElement
    if (!(
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    )) {
      return
    }
    target.setCustomValidity('')
    if (target.hasAttribute('aria-invalid')) {
      syncInputValidationState(target, 'input')
    }
  }

  const handleCheckoutSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isSubmitting || isEmpty) return

    const formEl = formRef.current
    if (formEl && !formEl.checkValidity()) {
      const firstInvalid = formEl.querySelector<HTMLElement>(':invalid')
      if (firstInvalid) {
        firstInvalid.setAttribute('aria-invalid', 'true')
        firstInvalid.focus()
      }
      return
    }

    setIsSubmitting(true)
    setSubmitError('')
    setStockWasReleased(false)

    try {
      const idempotencyKey = `chk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey,
          userId: user?.id,
          paymentOption,
          simulatePaymentFailure,
          customer: {
            name: customerName.trim(),
            email: customerEmail.trim(),
            phone: customerPhone.trim(),
            address: selectedPaymentMeta.requiresShippingAddress
              ? shippingAddress.trim()
              : collectionLocation,
            collectionLocation:
              selectedPaymentMeta.fulfillmentMethod === 'COLLECTION'
                ? collectionLocation
                : undefined,
          },
          payment: selectedPaymentMeta.requiresCardNow
            ? {
                cardholderName: ccName.trim(),
                cardNumber: ccNumber.replace(/\s+/g, ''),
                expiry: ccExp.trim(),
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
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        setStockWasReleased(Boolean(data.stockReleased))
        await refreshCatalog()
        throw new Error(data.error || 'Could not process checkout.')
      }

      setOrderResult(data as CheckoutSuccessResponse)
      setStep('success')
      onClearCart()
      await refreshUserOrders()
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'We couldn’t process the purchase. Please try again.'
      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTouchStart = (e: TouchEvent<HTMLElement>) => {
    if (e.changedTouches && e.changedTouches[0]) {
      touchStartXRef.current = e.changedTouches[0].clientX
    }
  }

  const handleTouchMove = (e: TouchEvent<HTMLElement>) => {
    if (touchStartXRef.current === null) return
    const currentX = e.changedTouches[0]?.clientX ?? 0
    const dx = currentX - touchStartXRef.current
    if (dx > 0) {
      setDragOffsetX(Math.round(dx))
    }
  }

  const handleTouchEnd = (e: TouchEvent<HTMLElement>) => {
    if (touchStartXRef.current === null) return
    const currentX = e.changedTouches[0]?.clientX ?? 0
    const dx = currentX - touchStartXRef.current
    if (dx > 90) {
      handleCloseSidebar()
    }
    touchStartXRef.current = null
    setDragOffsetX(0)
  }

  return (
    <nav
      id="cart-menu"
      className={`menu right${isOpen ? ' menu--open' : ''} ${s.drawerFlex}`}
      style={dragOffsetX > 0 ? { transform: `translate3d(${dragOffsetX}px, 0, 0)` } : undefined}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      aria-label="Shopping Cart and Checkout"
    >
      <button
        ref={closeBtnRef}
        type="button"
        className={`${styles.action} action--close-cart`}
        aria-label="Close Cart"
        onClick={handleCloseSidebar}
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>

      {step === 'success' && orderResult ? (
        <div className={s.successWrap} role="status" aria-live="polite">
          <div className={s.emptyIcon}>
            <Check className="h-8 w-8 text-emerald-500" aria-hidden="true" />
          </div>
          <h2 className={s.emptyHeader}>Order Confirmed!</h2>
          <p className={s.emptyText}>
            Order <strong>{orderResult.order.orderId}</strong> has been allocated cleanly by our
            durable checkout workflow. Your <strong>Invoice</strong> &amp; <strong>Receipt</strong>{' '}
            PDFs and confirmation email have been dispatched to{' '}
            <strong>{orderResult.email.to}</strong>.
          </p>

          <div className={s.receiptCard}>
            <div className={s.receiptRow}>
              <span>Order ID</span>
              <strong>{orderResult.order.orderId}</strong>
            </div>
            <div className={s.receiptRow}>
              <span>Payment Mode</span>
              <code>{orderResult.order.paymentSummary?.method}</code>
            </div>
            <div className={s.receiptRow}>
              <span>Payment Status</span>
              <code>{orderResult.order.paymentSummary?.status}</code>
            </div>
            <div className={s.receiptRow}>
              <span>Fulfillment</span>
              <code>{orderResult.order.fulfillmentMethod}</code>
            </div>
            <div className={s.receiptRow}>
              <span>Total</span>
              <strong>${orderResult.order.totals.grandTotal.toFixed(2)}</strong>
            </div>
            <div className={s.receiptRow}>
              <span>Email Status</span>
              <code>{orderResult.email.status}</code>
            </div>
            <div className={s.receiptRow}>
              <span>Invoice PDF</span>
              <a
                href={`/api/storefront/documents/${encodeURIComponent(orderResult.order.orderId)}?type=invoice`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[#797BED] hover:underline font-semibold"
              >
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{orderResult.documents.invoice.filename}</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </div>
            <div className={s.receiptRow}>
              <span>Receipt PDF</span>
              <a
                href={`/api/storefront/documents/${encodeURIComponent(orderResult.order.orderId)}?type=receipt`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[#797BED] hover:underline font-semibold"
              >
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{orderResult.documents.receipt.filename}</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </div>
            {orderResult.email.previewUrl && (
              <div className={s.receiptRow}>
                <span>Email Preview</span>
                <a
                  href={orderResult.email.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#797BED] underline"
                >
                  Open Ethereal Email
                </a>
              </div>
            )}
          </div>

          <Link href="/account" onClick={handleCloseSidebar} className={`${s.btn} mt-3`}>
            Track Order in My Account
          </Link>

          <button
            type="button"
            className={s.secondaryBtn}
            onClick={() => setShowPayloadPreview((prev) => !prev)}
            aria-expanded={showPayloadPreview}
          >
            {showPayloadPreview
              ? 'Hide Template Payloads & Rendered HTML'
              : 'Inspect TemplateId Payloads & Rendered Email HTML'}
          </button>

          {showPayloadPreview && (
            <pre className={s.payloadPreview}>
              {JSON.stringify(
                {
                  reservationKey: orderResult.reservationKey,
                  invoicePdfApiPost: orderResult.documents.invoice.payloadSent,
                  invoicePdfOutput: orderResult.documents.invoice.pdf,
                  receiptPdfApiPost: orderResult.documents.receipt.payloadSent,
                  receiptPdfOutput: orderResult.documents.receipt.pdf,
                  emailTemplateApiPost: orderResult.email.payloadSent,
                  emailTemplateHtmlOutput: orderResult.email.html,
                  attachmentsViaUrl: orderResult.email.attachments,
                },
                null,
                2,
              )}
            </pre>
          )}

          <button type="button" className={s.secondaryBtn} onClick={handleCloseSidebar}>
            Continue Shopping
          </button>
        </div>
      ) : isEmpty ? (
        <div className={s.empty}>
          <span className={s.emptyIcon}>
            <ShoppingBag className="h-7 w-7" aria-hidden="true" />
          </span>
          <h2 className={s.emptyHeader}>Your cart is empty</h2>
          <p className={s.emptyText}>
            Explore our collection of jackets, shirts, dresses, trousers, and shoes to add items to
            your bag.
          </p>
        </div>
      ) : step === 'checkout' ? (
        <div className={s.checkoutScroll}>
          <div className={s.checkoutHeaderRow}>
            <button
              type="button"
              className={s.backToCartBtn}
              onClick={() => {
                setSubmitError('')
                setStockWasReleased(false)
                setStep('cart')
              }}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Back to Cart</span>
            </button>
            <span className={s.stepBadge} aria-current="step">
              Step 2 of 2: Checkout
            </span>
          </div>

          <h2 className={s.cartHeader}>Payment, Stock Lock &amp; Receipt</h2>

          <div className="mb-3 flex items-center gap-2 rounded-none border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-500">
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Durable workflow locks variant inventory during authorization and releases stock
              automatically if payment fails.
            </span>
          </div>

          {submitError && (
            <div className={s.errorBanner} role="alert">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <div>{submitError}</div>
                {stockWasReleased && (
                  <div className="mt-1 font-semibold underline">
                    Workflow Status: Reserved variant stock automatically released.
                  </div>
                )}
              </div>
            </div>
          )}

          <form
            ref={formRef}
            method="POST"
            action="/api/checkout"
            className={s.checkoutForm}
            onSubmit={handleCheckoutSubmit}
            onBlurCapture={handleFormBlurCapture}
            onInputCapture={handleFormInputCapture}
            noValidate
          >
            {/* Payment & Fulfillment Options */}
            <fieldset className={s.fieldset}>
              <legend className={s.legend}>Payment &amp; Fulfillment Method</legend>

              <div className="grid grid-cols-1 gap-2">
                {PAYMENT_OPTIONS.map((option) => {
                  const selected = paymentOption === option.id
                  return (
                    <label
                      key={option.id}
                      className={`flex items-start gap-2.5 rounded-none border p-2.5 cursor-pointer transition-colors ${
                        selected
                          ? 'border-[#5C5EDC] bg-[#5C5EDC]/12'
                          : 'border-[var(--border-color)] hover:border-[#5C5EDC]/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentOption"
                        value={option.id}
                        checked={selected}
                        onChange={() => setPaymentOption(option.id)}
                        className="mt-1 accent-[#5C5EDC]"
                      />
                      <div className="flex-1 text-left">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--fg-heading)]">
                            {getPaymentOptionIcon(option.id)}
                            <span>{option.label}</span>
                          </span>
                          <span className="rounded-none bg-[var(--surface-elevated)] px-2 py-0.5 text-[10px] font-semibold text-[#797BED]">
                            {option.badge}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-[var(--fg-muted)] leading-snug">
                          {option.description}
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            {/* Customer & Delivery/Collection */}
            <fieldset className={s.fieldset}>
              <legend className={s.legend}>
                Customer &amp;{' '}
                {selectedPaymentMeta.fulfillmentMethod === 'COLLECTION'
                  ? 'Store Pickup'
                  : 'Delivery'}
              </legend>

              <div className={s.field}>
                <label htmlFor={nameId} className={s.label}>
                  Full name (required)
                </label>
                <input
                  id={nameId}
                  name="name"
                  type="text"
                  required
                  maxLength={100}
                  autoComplete="name"
                  enterKeyHint="next"
                  className={s.input}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  aria-errormessage={`${nameId}-error`}
                />
                <span id={`${nameId}-error`} className={s.errorMsg}>
                  Please enter your full name.
                </span>
              </div>

              <div className={s.field}>
                <label htmlFor={emailId} className={s.label}>
                  Email for Invoice, Receipt &amp; Tracking Updates (required)
                </label>
                <input
                  id={emailId}
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  enterKeyHint="next"
                  className={s.input}
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  aria-errormessage={`${emailId}-error`}
                />
                <span id={`${emailId}-error`} className={s.errorMsg}>
                  Please enter a valid email address.
                </span>
              </div>

              <div className={s.field}>
                <label htmlFor={phoneId} className={s.label}>
                  Phone for Courier / Pickup SMS
                </label>
                <input
                  id={phoneId}
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  className={s.input}
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
              </div>

              {selectedPaymentMeta.requiresShippingAddress ? (
                <div className={s.field}>
                  <label htmlFor={addressId} className={s.label}>
                    Shipping &amp; Delivery Address (required)
                  </label>
                  <textarea
                    id={addressId}
                    name="address"
                    required
                    rows={2}
                    maxLength={300}
                    autoComplete="shipping street-address"
                    className={s.textarea}
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    aria-errormessage={`${addressId}-error`}
                  />
                  <span id={`${addressId}-error`} className={s.errorMsg}>
                    Please enter a delivery address.
                  </span>
                </div>
              ) : (
                <div className={s.field}>
                  <label htmlFor={addressId} className={s.label}>
                    Select Store Collection Boutique
                  </label>
                  <Select value={collectionLocation} onValueChange={setCollectionLocation}>
                    <SelectTrigger
                      id={addressId}
                      className="h-10 w-full rounded-none border-[var(--border-color)] bg-[var(--surface-drawer)] text-sm text-[var(--fg-heading)] cursor-pointer"
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
                </div>
              )}
            </fieldset>

            {/* Card details only if payment is upfront */}
            {selectedPaymentMeta.requiresCardNow && (
              <fieldset className={s.fieldset}>
                <legend className={s.legend}>Online Card Payment</legend>

                <div className={s.field}>
                  <label htmlFor={ccNameId} className={s.label}>
                    Name on card (required)
                  </label>
                  <input
                    id={ccNameId}
                    name="cc-name"
                    type="text"
                    required
                    maxLength={50}
                    autoComplete="cc-name"
                    enterKeyHint="next"
                    className={s.input}
                    value={ccName}
                    onChange={(e) => setCcName(e.target.value)}
                    aria-errormessage={`${ccNameId}-error`}
                  />
                  <span id={`${ccNameId}-error`} className={s.errorMsg}>
                    Enter the cardholder name.
                  </span>
                </div>

                <div className={s.field}>
                  <label htmlFor={ccNumberId} className={s.label}>
                    Card number (required)
                  </label>
                  <input
                    id={ccNumberId}
                    name="cc-number"
                    type="text"
                    required
                    autoComplete="cc-number"
                    inputMode="numeric"
                    maxLength={19}
                    pattern="[\d ]{13,19}"
                    enterKeyHint="next"
                    className={s.input}
                    value={ccNumber}
                    onChange={(e) => setCcNumber(e.target.value)}
                    aria-errormessage={`${ccNumberId}-error`}
                  />
                  <span id={`${ccNumberId}-error`} className={s.errorMsg}>
                    Enter a valid 13–19 digit card number.
                  </span>
                </div>

                <div className={s.fieldRow}>
                  <div className={s.field}>
                    <label htmlFor={ccExpId} className={s.label}>
                      Expiry (required)
                    </label>
                    <input
                      id={ccExpId}
                      name="cc-exp"
                      type="text"
                      required
                      autoComplete="cc-exp"
                      maxLength={5}
                      pattern="(0[1-9]|1[0-2])\/[0-9]{2}"
                      enterKeyHint="next"
                      className={s.input}
                      value={ccExp}
                      onChange={(e) => setCcExp(e.target.value)}
                      aria-errormessage={`${ccExpId}-error`}
                    />
                    <span id={`${ccExpId}-error`} className={s.errorMsg}>
                      Use MM/YY.
                    </span>
                  </div>

                  <div className={s.field}>
                    <label htmlFor={ccCscId} className={s.label}>
                      CVC (required)
                    </label>
                    <input
                      id={ccCscId}
                      name="cc-csc"
                      type="text"
                      required
                      autoComplete="cc-csc"
                      inputMode="numeric"
                      maxLength={4}
                      pattern="[0-9]{3,4}"
                      enterKeyHint="done"
                      className={s.input}
                      value={ccCsc}
                      onChange={(e) => setCcCsc(e.target.value)}
                      aria-errormessage={`${ccCscId}-error`}
                    />
                    <span id={`${ccCscId}-error`} className={s.errorMsg}>
                      3–4 digits.
                    </span>
                  </div>
                </div>

                <label className="mt-2 flex items-start gap-2 rounded-none border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={simulatePaymentFailure}
                    onChange={(e) => setSimulatePaymentFailure(e.target.checked)}
                    className="mt-0.5 accent-amber-500"
                  />
                  <span>
                    <strong>Simulate Failed Payment:</strong> Test Workflow SDK rollback &amp;
                    automatic release of reserved stock.
                  </span>
                </label>
              </fieldset>
            )}

            <div className={s.checkoutSummaryMini}>
              <div className={s.total}>
                <span>Subtotal ({items.reduce((sum, i) => sum + i.quantity, 0)} items)</span>
                <span>${subTotal.toFixed(2)}</span>
              </div>
              <div className={s.total}>
                <span>Taxes (8%)</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <div className={s.total}>
                <span>
                  {selectedPaymentMeta.fulfillmentMethod === 'DELIVERY'
                    ? 'Courier Delivery'
                    : 'In-Store Collection'}
                </span>
                <span className={shippingFee === 0 ? s.free : undefined}>
                  {shippingFee === 0 ? 'FREE' : `$${shippingFee.toFixed(2)}`}
                </span>
              </div>
              <div className={s.grandTotal} style={{ marginBottom: '1rem' }}>
                <span>Total Due</span>
                <span>${grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              type="submit"
              className={`${s.btn}${isSubmitting ? ` ${s.loading}` : ''}`}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? 'Running Durable Checkout Workflow...'
                : selectedPaymentMeta.requiresCardNow
                  ? `Pay $${grandTotal.toFixed(2)} & Place Order`
                  : `Confirm Reservation ($${grandTotal.toFixed(2)} ${selectedPaymentMeta.shortLabel})`}
            </button>
          </form>
        </div>
      ) : (
        <>
          <div className={s.cartContainer}>
            <div className={s.cartHeaderBar}>
              <h2 className={s.cartHeader}>
                My Bag ({items.reduce((sum, i) => sum + i.quantity, 0)})
              </h2>
              <button type="button" className={s.clearCartBtn} onClick={onClearCart}>
                Clear All
              </button>
            </div>
            <ul className={s.listContainer}>
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

          <div className={s.totalsContainer}>
            {/* Guest vs Signed-In Notice */}
            {user ? (
              <div className="mb-3 flex items-center gap-2 rounded-none border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-500">
                <UserCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  Signed in as <strong>{user.name}</strong> ({user.email})
                </span>
              </div>
            ) : (
              <div className="mb-3 flex items-start gap-2 rounded-none border border-[#5C5EDC]/40 bg-[#5C5EDC]/10 px-3 py-2 text-xs text-[var(--fg-primary)]">
                <Lock className="h-4 w-4 shrink-0 text-[#797BED] mt-0.5" aria-hidden="true" />
                <span>
                  Guest bag is saved in <code>localStorage</code>. Sign in or create a free account
                  at checkout to reserve stock.
                </span>
              </div>
            )}

            <div>
              <ul className={s.padding}>
                <li className={s.total}>
                  <span>Subtotal</span>
                  <span>${subTotal.toFixed(2)}</span>
                </li>
                <li className={s.total}>
                  <span>Taxes (8%)</span>
                  <span>${tax.toFixed(2)}</span>
                </li>
                <li className={s.total}>
                  <span>Shipping / Collection</span>
                  <span className={s.free}>From FREE ($12 Courier)</span>
                </li>
              </ul>
              <div className={s.grandTotal}>
                <span>Estimated Total</span>
                <span>${(subTotal + tax).toFixed(2)}</span>
              </div>
            </div>
            <button type="button" className={s.btn} onClick={handleProceedToCheckout}>
              {user
                ? `Proceed to Checkout ($${(subTotal + tax).toFixed(2)})`
                : 'Sign In / Register to Checkout'}
            </button>
          </div>
        </>
      )}
    </nav>
  )
}

export default CartSidebar
