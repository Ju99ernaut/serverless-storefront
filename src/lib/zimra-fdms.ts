import QRCode from 'qrcode'
import {
  FiscalDevice,
  cents,
  type DeviceIdentity,
  type MoneyType,
  type TaxDefinition,
} from 'zimra-fdms'

export interface FiscalReceiptData {
  deviceId: number
  fiscalDayNo?: number
  receiptGlobalNo: number
  receiptCounter: number
  qrData: string
  qrCodeDataUrl: string
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
  const stateDir = process.env.ZIMRA_FDMS_STATE_DIR?.trim() || './.zimra'
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
    stateDir,
    currency,
  }
}

let cachedDevice: FiscalDevice | null = null
let cachedTaxes: TaxDefinition[] = []
let fiscalQueue: Promise<void> = Promise.resolve()

async function withFiscalLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = fiscalQueue
  let release!: () => void
  fiscalQueue = new Promise<void>((resolve) => {
    release = resolve
  })
  await prev
  try {
    return await fn()
  } finally {
    release()
  }
}

async function getReadyFiscalDevice(): Promise<{
  device: FiscalDevice
  deviceId: number
  taxId: number
  taxPercent: number | null
  currency: string
}> {
  const cfg = getZimraConfig()

  if (!cachedDevice) {
    cachedDevice = new FiscalDevice(
      cfg.identity,
      {
        certificatePem: cfg.certificatePem,
        privateKeyPem: cfg.privateKeyPem,
      },
      {
        environment: cfg.environment,
        stateDir: cfg.stateDir,
      },
    )
    await cachedDevice.reconcile()
  }

  if (cachedTaxes.length === 0) {
    const remoteConfig = await cachedDevice.getConfig()
    cachedTaxes = remoteConfig.applicableTaxes || []
  }

  const status = await cachedDevice.getStatus()
  if (status.fiscalDayStatus === 'FiscalDayClosed') {
    await cachedDevice.openDay()
  }

  const envTaxId = process.env.ZIMRA_FDMS_TAX_ID ? Number(process.env.ZIMRA_FDMS_TAX_ID) : NaN
  const envTaxPercent =
    process.env.ZIMRA_FDMS_TAX_PERCENT !== undefined && process.env.ZIMRA_FDMS_TAX_PERCENT !== ''
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

  return {
    device: cachedDevice,
    deviceId: cfg.identity.deviceId,
    taxId,
    taxPercent,
    currency: cfg.currency,
  }
}

function centsToZimraMoney(amountCents: number) {
  return cents((Math.round(amountCents) / 100).toFixed(2))
}

function resolveMoneyType(paymentMethodLabel?: string, paymentOption?: string): MoneyType {
  const label = (paymentMethodLabel || '').toLowerCase()
  if (label.includes('ecocash') || label.includes('onemoney') || label.includes('mobile')) {
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

export async function generateQrCodeDataUrl(qrData: string): Promise<string> {
  return QRCode.toDataURL(qrData, {
    width: 220,
    margin: 1,
    errorCorrectionLevel: 'M',
  })
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

  return withFiscalLock(async () => {
    const { device, deviceId, taxId, taxPercent, currency } = await getReadyFiscalDevice()

    const lines = params.items.map((item) => ({
      name: item.title.slice(0, 200),
      price: centsToZimraMoney(item.unitPriceCents),
      quantity: Math.max(1, Math.round(item.quantity)),
      taxId,
      taxPercent,
    }))

    if (params.shippingCents > 0) {
      lines.push({
        name: 'Courier Delivery',
        price: centsToZimraMoney(params.shippingCents),
        quantity: 1,
        taxId,
        taxPercent,
      })
    }

    if (params.taxCents > 0) {
      lines.push({
        name: 'Storefront Tax',
        price: centsToZimraMoney(params.taxCents),
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
          amount: centsToZimraMoney(params.grandTotalCents),
        },
      ],
    })

    const qrData = sale.qrData || ''
    const qrCodeDataUrl = qrData ? await generateQrCodeDataUrl(qrData) : ''
    const dayState = device.getState()

    return {
      deviceId,
      fiscalDayNo: dayState?.fiscalDayNo,
      receiptGlobalNo: sale.receipt.receiptGlobalNo,
      receiptCounter: sale.receipt.receiptCounter,
      qrData,
      qrCodeDataUrl,
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

  return withFiscalLock(async () => {
    const { device } = await getReadyFiscalDevice()
    return await device.closeDay()
  })
}
