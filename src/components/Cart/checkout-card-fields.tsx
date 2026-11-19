'use client'

import { Controller, type Control } from 'react-hook-form'
import { Checkbox } from '../ui/checkbox'
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

interface CheckoutCardFieldsProps {
  control: Control<CheckoutFormValues>
  baseId: string
}

export function CheckoutCardFields({ control, baseId }: CheckoutCardFieldsProps) {
  return (
    <FieldSet className="gap-3 rounded-lg border border-border bg-card p-3.5">
      <FieldLegend className="mb-0 text-xs font-bold uppercase tracking-wider text-primary">
        Online Card Payment
      </FieldLegend>

      <FieldGroup className="gap-3.5">
        <Controller
          name="ccName"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${baseId}-cc-name`}>Name on card (required)</FieldLabel>
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
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${baseId}-cc-number`}>Card number (required)</FieldLabel>
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
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${baseId}-cc-exp`}>Expiry (required)</FieldLabel>
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
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${baseId}-cc-csc`}>CVC (required)</FieldLabel>
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
          control={control}
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
                  <strong>Simulate Failed Payment:</strong> Test Workflow SDK rollback &amp;
                  automatic release of reserved stock.
                </span>
              </FieldLabel>
            </Field>
          )}
        />
      </FieldGroup>
    </FieldSet>
  )
}
