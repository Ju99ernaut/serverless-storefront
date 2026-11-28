'use client'

import { Field, FieldDescription } from '../ui/field'

export function CheckoutRedirectPaymentFields() {
  return (
    <Field>
      <div className="rounded-md border border-border/80 bg-muted/40 p-3">
        <p className="text-xs font-medium text-foreground">Redirects to Paynow on submit</p>
        <FieldDescription className="mt-1 text-xs leading-relaxed">
          You will be redirected to complete payment securely and you can return once payment is
          complete. Final totals or provider fees may update on the provider page.
        </FieldDescription>
      </div>
    </Field>
  )
}
