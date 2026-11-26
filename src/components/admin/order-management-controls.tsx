'use client'

import { useState } from 'react'
import { useAuth, useFormFields, toast, Button } from '@payloadcms/ui'

export function OrderManagementControls() {
  const { user } = useAuth()
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [note, setNote] = useState<string>('')

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
    return <div style={{ fontSize: '13px' }}>Save order first to enable operator controls.</div>
  }

  if (!isAuthorizedOperator) {
    return (
      <div
        style={{
          fontSize: '13px',
          color: '#b45309',
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
    <div>
      <div style={{ marginBottom: '12px' }}>
        <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 700 }}>
          Operator Order Management
        </h4>
        <div style={{ fontSize: '12px' }}>
          Status: <strong>{orderStatus}</strong> • Payment: <strong>{paymentStatus}</strong>
        </div>
      </div>

      {/* Fulfillment Status Actions */}
      {!isTerminal && (
        <div style={{ marginBottom: '8px' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
            Fulfillment Controls
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {orderStatus !== 'PROCESSING' &&
              orderStatus !== 'READY_FOR_COLLECTION' &&
              orderStatus !== 'OUT_FOR_DELIVERY' && (
                <Button
                  type="button"
                  buttonStyle="secondary"
                  disabled={Boolean(loadingAction)}
                  onClick={() => handleAdvanceStatus('PROCESSING', { label: 'Mark Preparing' })}
                >
                  Preparing
                </Button>
              )}

            {orderStatus !== 'READY_FOR_COLLECTION' && orderStatus !== 'OUT_FOR_DELIVERY' && (
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
                {fulfillmentMethod === 'COLLECTION' ? 'Collected' : 'Delivered'}
              </Button>
            )}

            <Button
              type="button"
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
              Cancel
            </Button>
          </div>

          <div className="field-type text">
            <input
              type="text"
              placeholder="Optional status transition note..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{
                width: '100%',
              }}
            />
          </div>
        </div>
      )}

      {/* On-Demand Document Generation */}
      <div
        style={{
          fontSize: '11px',
          fontWeight: 700,
          textTransform: 'uppercase',
        }}
      >
        Document Generation
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        <Button
          type="button"
          buttonStyle="secondary"
          disabled={Boolean(loadingAction)}
          onClick={() => handleGenerateDoc('INVOICE')}
        >
          Generate Invoice PDF
        </Button>
        <Button
          type="button"
          buttonStyle="secondary"
          disabled={Boolean(loadingAction)}
          onClick={() => handleGenerateDoc('RECEIPT')}
        >
          Generate Receipt PDF
        </Button>
      </div>

      {loadingAction && (
        <div style={{ fontSize: '12px', fontStyle: 'italic' }}>Processing {loadingAction}...</div>
      )}
    </div>
  )
}
