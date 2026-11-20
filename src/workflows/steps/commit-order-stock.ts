import { commitVariantStock } from '../../lib/payload-server'

export async function commitOrderStockStep(input: { reservationKey: string }) {
  'use step'
  const committed = await commitVariantStock(input.reservationKey)
  return {
    committed: Boolean(committed),
    reservationKey: input.reservationKey,
  }
}
