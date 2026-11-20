import { releaseVariantStock } from '../../lib/payload-server'

export async function releaseReservedStockStep(input: { reservationKey: string; reason: string }) {
  'use step'
  const released = await releaseVariantStock(input.reservationKey, input.reason)
  return {
    released: Boolean(released),
    reservationKey: input.reservationKey,
    reason: input.reason,
  }
}
