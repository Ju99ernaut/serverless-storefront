'use client'

import { ArrowLeft, Clock, CreditCard, Loader2, Smartphone, Store, Truck } from 'lucide-react'
import { Controller, type UseFormReturn } from 'react-hook-form'
import {
  PAYMENT_OPTIONS,
  TAX_RATE,
  formatCentsAsDollars,
  type PaymentOptionType,
} from '../../lib/utils/data'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import { DrawerHeader, DrawerTitle } from '../ui/drawer'
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
import { CheckoutCardFields } from './checkout-card-fields'
import { CheckoutMobilePaymentFields } from './checkout-mobile-payment-fields'
import {
  COLLECTION_LOCATIONS,
  type CheckoutFormValues,
  type PaymentOptionMeta,
} from './checkout-schema'

interface CartCheckoutStepProps {
  form: UseFormReturn<CheckoutFormValues>
  baseId: string
  selectedPaymentMeta: PaymentOptionMeta
  totalItemCount: number
  subTotal: number
  tax: number
  shippingFee: number
  grandTotal: number
  isPending: boolean
  onBackToCart: () => void
  onSubmit: (values: CheckoutFormValues) => void
}

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

export function CartCheckoutStep({
  form,
  baseId,
  selectedPaymentMeta,
  totalItemCount,
  subTotal,
  tax,
  shippingFee,
  grandTotal,
  isPending,
  onBackToCart,
  onSubmit,
}: CartCheckoutStepProps) {
  const paymentProvider = form.watch('paymentProvider')

  return (
    <>
      <DrawerHeader className="border-b border-border pb-3">
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 gap-1.5"
            onClick={onBackToCart}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to Cart</span>
          </Button>
          <Badge variant="secondary" aria-current="step">
            Step 2 of 2: Checkout
          </Badge>
        </div>
        <DrawerTitle className="pt-1 text-lg font-bold">Payment and Stock Reservation</DrawerTitle>
      </DrawerHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <form
          id="payment-fulfillment"
          className="space-y-5"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
        >
          {/* Payment & Fulfillment Options */}
          <FieldSet className="gap-3 rounded-lg border border-border bg-card p-3.5">
            <FieldLegend className="mb-0 text-xs font-semibold">
              Payment &amp; Fulfillment Method
            </FieldLegend>

            <Controller
              name="paymentOption"
              control={form.control}
              render={({ field }) => (
                <div className="grid grid-cols-1 gap-2">
                  {PAYMENT_OPTIONS.map((option) => {
                    const selected = field.value === option.id
                    const optionId = `${baseId}-payment-${option.id}`

                    return (
                      <FieldLabel key={option.id} htmlFor={optionId} className="cursor-pointer">
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
            <FieldLegend className="mb-0 text-xs font-semibold">
              Customer &amp;{' '}
              {selectedPaymentMeta.fulfillmentMethod === 'COLLECTION' ? 'Store Pickup' : 'Delivery'}
            </FieldLegend>

            <FieldGroup className="gap-3.5">
              <Controller
                name="customerName"
                control={form.control}
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
                control={form.control}
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
                control={form.control}
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
                  control={form.control}
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
                  control={form.control}
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

          {/* Express Mobile (Paynow) or Card details if payment is upfront */}
          {selectedPaymentMeta.requiresCardNow && (
            <div className="space-y-3">
              <Controller
                name="paymentProvider"
                control={form.control}
                render={({ field }) => (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={field.value === 'paynow_mobile' ? 'default' : 'outline'}
                      size="sm"
                      className="gap-1.5"
                      onClick={() => field.onChange('paynow_mobile')}
                      aria-pressed={field.value === 'paynow_mobile'}
                    >
                      <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Mobile</span>
                    </Button>
                    <Button
                      type="button"
                      variant={field.value === 'card' ? 'default' : 'outline'}
                      size="sm"
                      className="gap-1.5"
                      onClick={() => field.onChange('card')}
                      aria-pressed={field.value === 'card'}
                      disabled
                    >
                      <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Card</span>
                    </Button>
                  </div>
                )}
              />

              {paymentProvider === 'paynow_mobile' ? (
                <CheckoutMobilePaymentFields control={form.control} baseId={baseId} />
              ) : (
                <CheckoutCardFields control={form.control} baseId={baseId} />
              )}
            </div>
          )}

          <div className="space-y-1.5 pt-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotal ({totalItemCount} items)</span>
              <span>{formatCentsAsDollars(subTotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Taxes ({TAX_RATE * 100}%)</span>
              <span>{formatCentsAsDollars(tax)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {selectedPaymentMeta.fulfillmentMethod === 'DELIVERY'
                  ? 'Courier Delivery'
                  : 'In-Store Collection'}
              </span>
              <span className={shippingFee === 0 ? 'font-bold text-primary' : undefined}>
                {shippingFee === 0 ? 'FREE' : formatCentsAsDollars(shippingFee)}
              </span>
            </div>
            <Separator className="my-2" />
            <div className="flex items-center justify-between py-1 text-base font-bold">
              <span>Total Due</span>
              <span>{formatCentsAsDollars(grandTotal)}</span>
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {isPending
              ? 'Checkout...'
              : selectedPaymentMeta.requiresCardNow
                ? `Pay ${formatCentsAsDollars(grandTotal)} & Place Order`
                : `Confirm Reservation (${formatCentsAsDollars(grandTotal)} ${selectedPaymentMeta.shortLabel})`}
          </Button>
        </form>
      </div>
    </>
  )
}
