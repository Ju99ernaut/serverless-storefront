import { sql } from '@payloadcms/db-vercel-postgres'
import {
  FiscalDevice,
  NodeTransport,
  PemSigner,
  type DeviceIdentity,
  type MoneyType,
  type Storage,
  type TaxDefinition,
} from 'zimra-fdms'
import { getServerPayload } from './payload-server'
import type { DatabaseAdapter } from 'payload'

export interface FiscalReceiptData {
  deviceId: number
  fiscalDayNo?: number
  receiptGlobalNo: number
  receiptCounter: number
  qrData: string
  submittedAt: string
}

export interface SubmitFiscalReceiptParams {
  invoiceNo: string
  paymentMethodLabel?: string
  paymentOption?: string
  currency?: string
  buyer?: {
    name?: string
    email?: string
    phone?: string
  }
  items: Array<{
    title: string
    unitPriceCents: number
    quantity: number
  }>
  taxCents: number
  shippingCents: number
  grandTotalCents: number
}

function normalizePem(raw: string | undefined): string {
  if (!raw) return ''
  return raw.replace(/\\n/g, '\n').trim()
}

export function isZimraFdmsConfigured(): boolean {
  const deviceId = Number(process.env.ZIMRA_FDMS_DEVICE_ID)
  return Boolean(
    Number.isInteger(deviceId) &&
    deviceId > 0 &&
    process.env.ZIMRA_FDMS_SERIAL_NUMBER?.trim() &&
    normalizePem(process.env.ZIMRA_FDMS_CERTIFICATE_PEM) &&
    normalizePem(process.env.ZIMRA_FDMS_PRIVATE_KEY_PEM),
  )
}

function getZimraConfig() {
  const deviceId = Number(process.env.ZIMRA_FDMS_DEVICE_ID)
  const serialNumber = process.env.ZIMRA_FDMS_SERIAL_NUMBER?.trim() || ''
  const certificatePem = normalizePem(process.env.ZIMRA_FDMS_CERTIFICATE_PEM)
  const privateKeyPem = normalizePem(process.env.ZIMRA_FDMS_PRIVATE_KEY_PEM)
  const rawEnv = process.env.ZIMRA_FDMS_ENVIRONMENT?.trim().toLowerCase()
  const environment: 'test' | 'production' =
    rawEnv === 'production' || rawEnv === 'prod' ? 'production' : 'test'
  const modelName = process.env.ZIMRA_FDMS_MODEL_NAME?.trim() || 'Server'
  const modelVersion = process.env.ZIMRA_FDMS_MODEL_VERSION?.trim() || 'v1'
  const currency = (process.env.ZIMRA_FDMS_CURRENCY?.trim() || 'USD').toUpperCase()

  const identity: DeviceIdentity = {
    deviceId,
    serialNumber,
    modelName,
    modelVersion,
  }

  return {
    identity,
    certificatePem,
    privateKeyPem,
    environment,
    currency,
  }
}

let stateTableInitialized = false
let cachedTaxes: TaxDefinition[] = []
let localFiscalQueue: Promise<void> = Promise.resolve()

async function getPayloadDb() {
  const payload = await getServerPayload()
  return payload.db
}

async function ensureFiscalStateTable(drizzle: DatabaseAdapter['drizzle']): Promise<void> {
  if (stateTableInitialized) return
  await drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS zimra_fdms_state (
      device_id INTEGER NOT NULL,
      state_key TEXT NOT NULL,
      state_value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (device_id, state_key)
    )
  `)
  stateTableInitialized = true
}

/**
 * Serverless-safe Postgres implementation of `zimra-fdms`'s `Storage` interface.
 * Persists day state, pending-submit markers, and last global receipt number
 * atomically in Neon Postgres so state survives cold starts and scales across instances.
 */
function createPostgresFiscalStorage(
  deviceId: number,
  drizzle: DatabaseAdapter['drizzle'],
): Storage {
  return {
    async get(key: string): Promise<string | null> {
      await ensureFiscalStateTable(drizzle)
      const res = await drizzle.execute(sql`
        SELECT state_value
        FROM zimra_fdms_state
        WHERE device_id = ${deviceId} AND state_key = ${key}
        LIMIT 1
      `)
      const row = res?.rows?.[0]
      return typeof row?.state_value === 'string' ? row.state_value : null
    },

    async set(key: string, value: string): Promise<void> {
      await ensureFiscalStateTable(drizzle)
      await drizzle.execute(sql`
        INSERT INTO zimra_fdms_state (device_id, state_key, state_value, updated_at)
        VALUES (${deviceId}, ${key}, ${value}, NOW())
        ON CONFLICT (device_id, state_key)
        DO UPDATE SET state_value = EXCLUDED.state_value, updated_at = NOW()
      `)
    },

    async delete(key: string): Promise<void> {
      await ensureFiscalStateTable(drizzle)
      await drizzle.execute(sql`
        DELETE FROM zimra_fdms_state
        WHERE device_id = ${deviceId} AND state_key = ${key}
      `)
    },
  }
}

/**
 * Serializes fiscal operations both in-process and across concurrent serverless instances
 * using a transaction-scoped Postgres advisory lock (`pg_advisory_xact_lock`) on a
 * dedicated lock connection, while `Storage` commits immediately on the main pool
 * so pending-submit crash markers are durable even if the function dies mid-request.
 */
async function withDistributedFiscalLock<T>(deviceId: number, fn: () => Promise<T>): Promise<T> {
  const prev = localFiscalQueue
  let releaseLocal!: () => void
  localFiscalQueue = new Promise<void>((resolve) => {
    releaseLocal = resolve
  })
  await prev

  let lockClient
  try {
    const db = await getPayloadDb()
    if (typeof db.pool?.connect === 'function') {
      lockClient = await db.pool.connect()
      await lockClient.query('BEGIN')
      await lockClient.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `zimra_fdms_device_${deviceId}`,
      ])
    }

    return await fn()
  } finally {
    if (lockClient) {
      try {
        await lockClient.query('COMMIT')
      } catch {
        // Lock is automatically released by Postgres if the connection dropped
      } finally {
        lockClient.release()
      }
    }
    releaseLocal()
  }
}

async function withReadyFiscalDevice<T>(
  fn: (ctx: {
    device: FiscalDevice
    deviceId: number
    taxId: number
    taxPercent: number | null
    currency: string
  }) => Promise<T>,
): Promise<T> {
  const cfg = getZimraConfig()

  return withDistributedFiscalLock(cfg.identity.deviceId, async () => {
    const db = await getPayloadDb()
    if (!db.drizzle) {
      throw new Error('Postgres Drizzle client is unavailable for ZIMRA FDMS state storage.')
    }

    const storage = createPostgresFiscalStorage(cfg.identity.deviceId, db.drizzle)
    const signer = new PemSigner(cfg.privateKeyPem)
    const transport = new NodeTransport({
      certificatePem: cfg.certificatePem,
      privateKeyPem: cfg.privateKeyPem,
    })

    const device = new FiscalDevice(
      cfg.identity,
      { signer, transport, storage },
      { environment: cfg.environment },
    )

    try {
      // Load persisted state from Postgres and settle any crash-interrupted submit
      await device.reconcile()

      if (cachedTaxes.length === 0) {
        const remoteConfig = await device.getConfig()
        cachedTaxes = remoteConfig.applicableTaxes || []
      }

      const status = await device.getStatus()
      if (status.fiscalDayStatus === 'FiscalDayClosed') {
        await device.openDay()
      }

      const envTaxId = process.env.ZIMRA_FDMS_TAX_ID ? Number(process.env.ZIMRA_FDMS_TAX_ID) : NaN
      const envTaxPercent =
        process.env.ZIMRA_FDMS_TAX_PERCENT !== undefined &&
        process.env.ZIMRA_FDMS_TAX_PERCENT !== ''
          ? Number(process.env.ZIMRA_FDMS_TAX_PERCENT)
          : undefined

      let taxId: number
      let taxPercent: number | null

      if (Number.isInteger(envTaxId) && envTaxId > 0) {
        taxId = envTaxId
        const matched = cachedTaxes.find((t) => t.taxID === envTaxId)
        taxPercent =
          envTaxPercent !== undefined && Number.isFinite(envTaxPercent)
            ? envTaxPercent
            : (matched?.taxPercent ?? 0)
      } else {
        const preferredTax =
          cachedTaxes.find((t) => t.taxPercent === 0) ||
          cachedTaxes.find((t) => t.taxPercent != null) ||
          cachedTaxes[0]
        taxId = preferredTax?.taxID ?? 513
        taxPercent = preferredTax?.taxPercent ?? 0
      }

      return await fn({
        device,
        deviceId: cfg.identity.deviceId,
        taxId,
        taxPercent,
        currency: cfg.currency,
      })
    } finally {
      transport.destroy()
    }
  })
}

function resolveMoneyType(paymentMethodLabel?: string, paymentOption?: string): MoneyType {
  const label = (paymentMethodLabel || '').toLowerCase()
  if (label.includes('ecocash') || label.includes('innbucks') || label.includes('mobile')) {
    return 'MobileWallet'
  }
  if (label.includes('card')) {
    return 'Card'
  }
  if (paymentOption === 'pay_on_delivery' || paymentOption === 'pay_on_collection') {
    return 'Cash'
  }
  return 'Card'
}

/**
 * Submits a fiscal receipt to ZIMRA FDMS when configured and returns the QR code
 * payload + PNG data URL for embedding on the customer's receipt.
 * Returns `null` when ZIMRA FDMS environment variables are not configured.
 */
export async function submitFiscalReceiptIfConfigured(
  params: SubmitFiscalReceiptParams,
): Promise<FiscalReceiptData | null> {
  if (!isZimraFdmsConfigured()) {
    return null
  }

  return withReadyFiscalDevice(async ({ device, deviceId, taxId, taxPercent, currency }) => {
    const lines = params.items.map((item) => ({
      name: item.title.slice(0, 200),
      price: item.unitPriceCents,
      quantity: Math.max(1, Math.round(item.quantity)),
      taxId,
      taxPercent,
    }))

    if (params.shippingCents > 0) {
      lines.push({
        name: 'Courier Delivery',
        price: params.shippingCents,
        quantity: 1,
        taxId,
        taxPercent,
      })
    }

    if (params.taxCents > 0) {
      lines.push({
        name: 'Storefront Tax',
        price: params.taxCents,
        quantity: 1,
        taxId,
        taxPercent,
      })
    }

    const moneyType = resolveMoneyType(params.paymentMethodLabel, params.paymentOption)

    const sale = await device.submitReceipt({
      currency: (params.currency || currency).toUpperCase(),
      invoiceNo: params.invoiceNo.slice(0, 50),
      linesTaxInclusive: true,
      lines,
      payments: [
        {
          moneyType,
          amount: params.grandTotalCents,
        },
      ],
    })

    const qrData = sale.qrData || ''
    const dayState = device.getState()

    return {
      deviceId,
      fiscalDayNo: dayState?.fiscalDayNo,
      receiptGlobalNo: sale.receipt.receiptGlobalNo,
      receiptCounter: sale.receipt.receiptCounter,
      qrData,
      submittedAt: new Date().toISOString(),
    }
  })
}

/**
 * Closes the active ZIMRA FDMS fiscal day (e.g. from a scheduled end-of-day job).
 */
export async function closeZimraFiscalDay() {
  if (!isZimraFdmsConfigured()) {
    return null
  }

  return withReadyFiscalDevice(async ({ device }) => {
    return await device.closeDay()
  })
}
