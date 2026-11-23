'use client'

import { useState } from 'react'
import { useAuth, useFormFields, toast, Button } from '@payloadcms/ui'

export function OrderManagementControls() {
  const { user } = useAuth()
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [note, setNote] = useState<string>('')
  const [showPaymentFields, setShowPaymentFields] = useState<boolean>(false)
  const [cardNumber, setCardNumber] = useState<string>('4242')
  const [cardholderName, setCardholderName] = useState<string>('')

  const orderId = useFormFields(([fields]) => fields.orderId?.value as string | undefined)
  const orderStatus = useFormFields(([fields]) => fields.orderStatus?.value as string | undefined)
  const paymentStatus = useFormFields(
    ([fields]) => fields.paymentStatus?.value as string | undefined,
  )
  const fulfillmentMethod = useFormFields(
    ([fields]) => fields.fulfillmentMethod?.value as string | undefined,
  )

  const userRole = (user?.role as string | undefined)?.trim().toLowerCase()
  const isAuthorizedOperator = Boolean(
    userRole && ['admin', 'staff', 'fulfillment'].includes(userRole),
  )

  if (!orderId) {
    return (
      <div style={{ padding: '12px', fontSize: '13px', color: '#64748b' }}>
        Save order first to enable operator controls.
      </div>
    )
  }

  if (!isAuthorizedOperator) {
    return (
      <div
        style={{
          padding: '12px',
          fontSize: '13px',
          color: '#b45309',
          backgroundColor: '#fef3c7',
          borderRadius: '6px',
          border: '1px solid #fde68a',
        }}
      >
        Operator authorization required (role: admin, staff, or fulfillment) to manage orders.
      </div>
    )
  }

  const isTerminal = orderStatus === 'COMPLETED' || orderStatus === 'CANCELLED'

  const callOrderApi = async (body: Record<string, unknown>, actionLabel: string) => {
    setLoadingAction(actionLabel)
    try {
      const res = await fetch('/api/storefront/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, ...body }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || `Failed to execute ${actionLabel}`)
      }
      toast.success(data.message || `Order ${orderId}: ${actionLabel} completed successfully.`)
      setNote('')
      // Reload after slight delay to refresh Payload form state
      setTimeout(() => {
        window.location.reload()
      }, 500)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to execute ${actionLabel}`)
    } finally {
      setLoadingAction(null)
    }
  }

  const handleAdvanceStatus = (
    nextStatus: string,
    options?: { deliveryFailed?: boolean; label?: string },
  ) => {
    const label = options?.label || `Advance to ${nextStatus}`
    callOrderApi(
      {
        nextStatus,
        note: note.trim() || undefined,
        deliveryFailed: options?.deliveryFailed,
      },
      label,
    )
  }

  const handleConfirmPayment = () => {
    callOrderApi(
      {
        action: 'payment',
        authorized: true,
        cardNumber: cardNumber || '4242',
        cardholderName: cardholderName || undefined,
      },
      'Confirm Payment',
    )
  }

  const handleGenerateDoc = (docType: 'INVOICE' | 'RECEIPT') => {
    callOrderApi(
      {
        action: 'generate_document',
        documentType: docType,
      },
      `Generate ${docType}`,
    )
  }

  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        marginBottom: '20px',
      }}
    >
      <div style={{ marginBottom: '12px' }}>
        <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
          Operator Order Management
        </h4>
        <div style={{ fontSize: '12px', color: '#64748b' }}>
          Order ID: <strong>{orderId}</strong> • Status: <strong>{orderStatus}</strong> • Payment:{' '}
          <strong>{paymentStatus}</strong>
        </div>
      </div>

      {/* Fulfillment Status Actions */}
      {!isTerminal && (
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: '#475569',
              marginBottom: '6px',
            }}
          >
            Fulfillment Controls
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {orderStatus !== 'PROCESSING' && (
              <Button
                type="button"
                disabled={Boolean(loadingAction)}
                onClick={() => handleAdvanceStatus('PROCESSING', { label: 'Mark Preparing' })}
              >
                Mark Preparing
              </Button>
            )}

            {orderStatus !== 'READY_FOR_COLLECTION' &&
              orderStatus !== 'OUT_FOR_DELIVERY' &&
              orderStatus !== 'COMPLETED' && (
                <Button
                  type="button"
                  buttonStyle="secondary"
                  disabled={Boolean(loadingAction)}
                  onClick={() =>
                    handleAdvanceStatus(
                      fulfillmentMethod === 'COLLECTION'
                        ? 'READY_FOR_COLLECTION'
                        : 'OUT_FOR_DELIVERY',
                      {
                        label:
                          fulfillmentMethod === 'COLLECTION'
                            ? 'Ready for Collection'
                            : 'Out for Delivery',
                      },
                    )
                  }
                >
                  {fulfillmentMethod === 'COLLECTION' ? 'Ready for Pickup' : 'Out for Delivery'}
                </Button>
              )}

            {orderStatus !== 'COMPLETED' && (
              <Button
                type="button"
                buttonStyle="secondary"
                disabled={Boolean(loadingAction)}
                onClick={() =>
                  handleAdvanceStatus('COMPLETED', {
                    label: fulfillmentMethod === 'COLLECTION' ? 'Mark Collected' : 'Mark Delivered',
                  })
                }
              >
                {fulfillmentMethod === 'COLLECTION' ? 'Mark Collected' : 'Mark Delivered'}
              </Button>
            )}

            <Button
              type="button"
              buttonStyle="error"
              disabled={Boolean(loadingAction)}
              onClick={() =>
                handleAdvanceStatus('CANCELLED', {
                  deliveryFailed: fulfillmentMethod === 'DELIVERY',
                  label:
                    fulfillmentMethod === 'DELIVERY'
                      ? 'Mark Delivery Failed / Cancel'
                      : 'Cancel & Release Stock',
                })
              }
            >
              {fulfillmentMethod === 'DELIVERY'
                ? 'Delivery Failed / Cancel'
                : 'Cancel & Release Stock'}
            </Button>
          </div>

          <div style={{ marginTop: '8px' }}>
            <input
              type="text"
              placeholder="Optional status transition note..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                fontSize: '12px',
                borderRadius: '4px',
                border: '1px solid #cbd5e1',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      )}

      {/* Payment Confirmation */}
      {paymentStatus !== 'PAID' && (
        <div style={{ marginBottom: '16px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: '#475569',
              marginBottom: '6px',
            }}
          >
            Payment Confirmation
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <Button
              type="button"
              buttonStyle="secondary"
              disabled={Boolean(loadingAction)}
              onClick={() => setShowPaymentFields(!showPaymentFields)}
            >
              {showPaymentFields ? 'Cancel' : 'Confirm Payment...'}
            </Button>
          </div>

          {showPaymentFields && (
            <div
              style={{
                marginTop: '8px',
                padding: '10px',
                backgroundColor: '#ffffff',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
              }}
            >
              <div style={{ marginBottom: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                  Card Last 4 / Number
                </label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="4242"
                  style={{
                    width: '100%',
                    padding: '5px 8px',
                    fontSize: '12px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ marginBottom: '8px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                  Cardholder Name (optional)
                </label>
                <input
                  type="text"
                  value={cardholderName}
                  onChange={(e) => setCardholderName(e.target.value)}
                  placeholder="Cardholder Name"
                  style={{
                    width: '100%',
                    padding: '5px 8px',
                    fontSize: '12px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <Button
                type="button"
                buttonStyle="secondary"
                disabled={Boolean(loadingAction)}
                onClick={handleConfirmPayment}
              >
                Submit Payment Confirmation
              </Button>
            </div>
          )}
        </div>
      )}

      {/* On-Demand Document Generation */}
      <div style={{ paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            color: '#475569',
            marginBottom: '6px',
          }}
        >
          Document Generation
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          <Button
            type="button"
            disabled={Boolean(loadingAction)}
            onClick={() => handleGenerateDoc('INVOICE')}
          >
            Generate Invoice PDF
          </Button>
          <Button
            type="button"
            disabled={Boolean(loadingAction)}
            onClick={() => handleGenerateDoc('RECEIPT')}
          >
            Generate Receipt PDF
          </Button>
        </div>
      </div>

      {loadingAction && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#6366f1', fontStyle: 'italic' }}>
          Processing {loadingAction}...
        </div>
      )}
    </div>
  )
}
