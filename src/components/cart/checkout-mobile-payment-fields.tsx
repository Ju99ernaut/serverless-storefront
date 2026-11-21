'use client'

import { Smartphone } from 'lucide-react'
import { Controller, type Control } from 'react-hook-form'
import { Button } from '../ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '../ui/field'
import { Input } from '../ui/input'
import type { CheckoutFormValues } from './checkout-schema'

interface CheckoutMobilePaymentFieldsProps {
  control: Control<CheckoutFormValues>
  baseId: string
}

const MOBILE_METHODS = [
  {
    id: 'ecocash' as const,
    label: 'EcoCash',
    hint: 'Econet (077 / 078)',
  },
  {
    id: 'onemoney' as const,
    label: 'OneMoney',
    hint: 'NetOne (071)',
  },
]

export function CheckoutMobilePaymentFields({ control, baseId }: CheckoutMobilePaymentFieldsProps) {
  return (
    <FieldSet className="gap-3 rounded-lg border border-border bg-card p-3.5">
      <FieldLegend className="mb-0 flex items-center gap-1.5 text-xs font-semibold">
        <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Express Payment</span>
      </FieldLegend>

      <FieldGroup className="gap-3.5">
        <Controller
          name="mobileMethod"
          control={control}
          render={({ field }) => (
            <Field>
              <FieldLabel>Wallet</FieldLabel>
              <div className="grid grid-cols-2 gap-2">
                {MOBILE_METHODS.map((method) => {
                  const selected = field.value === method.id
                  return (
                    <Button
                      key={method.id}
                      type="button"
                      variant={selected ? 'default' : 'outline'}
                      className="h-auto flex-col items-start gap-0.5 py-2.5 text-left"
                      onClick={() => field.onChange(method.id)}
                      aria-pressed={selected}
                    >
                      <span className="text-xs font-bold">{method.label}</span>
                      <span
                        className={
                          selected
                            ? 'text-[10px] text-primary-foreground/80'
                            : 'text-[10px] text-muted-foreground'
                        }
                      >
                        {method.hint}
                      </span>
                    </Button>
                  )
                })}
              </div>
            </Field>
          )}
        />

        <Controller
          name="mobileNumber"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${baseId}-mobile-number`}>Phone Number (required)</FieldLabel>
              <FieldDescription id={`${baseId}-mobile-number-hint`} className="text-xs">
                A Paynow USSD payment prompt will be sent directly to this phone.
              </FieldDescription>
              <Input
                {...field}
                id={`${baseId}-mobile-number`}
                name="mobile-number"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                enterKeyHint="done"
                aria-describedby={`${baseId}-mobile-number-hint`}
                aria-invalid={fieldState.invalid}
                placeholder="0777 000 000"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
    </FieldSet>
  )
}
