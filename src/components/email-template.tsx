import type { Order } from '../payload-types'
import { formatCentsAsDollars } from '../lib/utils/products'

export interface AdminOrderEmailTemplateProps {
  order: Order
  adminOrderUrl?: string
  actionGuidance?: string
}

export function AdminOrderEmailTemplate({
  order,
  adminOrderUrl,
  actionGuidance,
}: AdminOrderEmailTemplateProps) {
  const serverUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const manageUrl =
    adminOrderUrl || `${serverUrl}/admin/collections/orders/${order.id || order.orderId}`

  const resolvedAddress =
    order.fulfillmentMethod === 'COLLECTION'
      ? `Store Pickup: ${order.collectionLocation || 'N/A'}`
      : `Delivery Address: ${order.shippingAddress || 'N/A'}`

  const grandTotal = formatCentsAsDollars(order.totals?.grandTotal)
  const subTotal = formatCentsAsDollars(order.totals?.subTotal)
  const tax = formatCentsAsDollars(order.totals?.tax)
  const shipping = formatCentsAsDollars(order.totals?.shipping)

  return (
    <div
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        color: '#1e293b',
        lineHeight: 1.5,
        padding: '20px',
        backgroundColor: '#f8fafc',
      }}
    >
      <div
        style={{
          maxWidth: '600px',
          margin: '0 auto',
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ backgroundColor: '#0f172a', color: '#ffffff', padding: '24px' }}>
          <h1 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 600 }}>
            New Order Received: {order.orderId}
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
            Issued: {new Date(order.issuedAt || order.createdAt || Date.now()).toLocaleString()}
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {actionGuidance && (
            <div
              style={{
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#166534',
                padding: '12px 16px',
                borderRadius: '6px',
                fontSize: '14px',
                marginBottom: '20px',
                fontWeight: 500,
              }}
            >
              {actionGuidance}
            </div>
          )}

          {/* Customer Details */}
          <div style={{ marginBottom: '20px' }}>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#64748b',
                marginBottom: '8px',
              }}
            >
              Customer Details
            </div>
            <p style={{ margin: 0, fontSize: '14px' }}>
              <strong>{order.customerName}</strong> ({order.customerEmail})
            </p>
            {order.customerPhone && (
              <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                Phone: {order.customerPhone}
              </p>
            )}
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              {resolvedAddress}
            </p>
          </div>

          {/* Order Status & Payment */}
          <div style={{ marginBottom: '20px' }}>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#64748b',
                marginBottom: '8px',
              }}
            >
              Order Status & Payment
            </div>
            <p style={{ margin: 0, fontSize: '13px' }}>
              Status: <strong>{order.orderStatus}</strong> • Payment Status:{' '}
              <strong>{order.paymentStatus}</strong>
            </p>
            <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              Method: {order.paymentMethodLabel || order.paymentOption} ({order.fulfillmentMethod})
            </p>
          </div>

          {/* Items Ordered */}
          <div style={{ marginBottom: '20px' }}>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#64748b',
                marginBottom: '8px',
              }}
            >
              Items Ordered
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th
                    style={{
                      padding: '8px 12px',
                      textAlign: 'left',
                      color: '#475569',
                      fontWeight: 600,
                    }}
                  >
                    Item
                  </th>
                  <th
                    style={{
                      padding: '8px 12px',
                      textAlign: 'center',
                      color: '#475569',
                      fontWeight: 600,
                    }}
                  >
                    Qty
                  </th>
                  <th
                    style={{
                      padding: '8px 12px',
                      textAlign: 'right',
                      color: '#475569',
                      fontWeight: 600,
                    }}
                  >
                    Unit Price
                  </th>
                  <th
                    style={{
                      padding: '8px 12px',
                      textAlign: 'right',
                      color: '#475569',
                      fontWeight: 600,
                    }}
                  >
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {(order.items || []).map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 500 }}>
                      {item.title}
                      {item.size && (
                        <span style={{ color: '#64748b', fontSize: '12px' }}>
                          {' '}
                          ({item.size}
                          {item.color ? ` / ${item.color}` : ''})
                        </span>
                      )}
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                        SKU: {item.variantSku || 'N/A'}
                      </div>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>{item.quantity}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      {formatCentsAsDollars(item.unitPrice)}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>
                      {formatCentsAsDollars(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td
                    colSpan={3}
                    style={{ padding: '6px 12px', textAlign: 'right', fontSize: '13px' }}
                  >
                    Subtotal:
                  </td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', fontSize: '13px' }}>
                    {subTotal}
                  </td>
                </tr>
                <tr>
                  <td
                    colSpan={3}
                    style={{ padding: '6px 12px', textAlign: 'right', fontSize: '13px' }}
                  >
                    Tax:
                  </td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', fontSize: '13px' }}>
                    {tax}
                  </td>
                </tr>
                <tr>
                  <td
                    colSpan={3}
                    style={{ padding: '6px 12px', textAlign: 'right', fontSize: '13px' }}
                  >
                    Shipping / Delivery:
                  </td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', fontSize: '13px' }}>
                    {shipping}
                  </td>
                </tr>
                <tr style={{ borderTop: '2px solid #e2e8f0' }}>
                  <td
                    colSpan={3}
                    style={{
                      padding: '8px 12px',
                      textAlign: 'right',
                      fontSize: '15px',
                      fontWeight: 700,
                      color: '#0f172a',
                    }}
                  >
                    Grand Total:
                  </td>
                  <td
                    style={{
                      padding: '8px 12px',
                      textAlign: 'right',
                      fontSize: '15px',
                      fontWeight: 700,
                      color: '#0f172a',
                    }}
                  >
                    {grandTotal}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Action Link to Payload Admin */}
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <a
              href={manageUrl}
              style={{
                display: 'inline-block',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                padding: '10px 20px',
                borderRadius: '6px',
                textDecoration: 'none',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              Manage Order in Payload Admin
            </a>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            fontSize: '11px',
            color: '#94a3b8',
            textAlign: 'center',
          }}
        >
          Serverless Storefront Order Management System
        </div>
      </div>
    </div>
  )
}

export const EmailTemplate = AdminOrderEmailTemplate
