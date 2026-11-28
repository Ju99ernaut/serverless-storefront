import { type PaynowMobileMethod, pollPaynowTransaction } from '@/lib/paynow'

export async function pollPaynowUntilTerminalStep({
  pollUrl,
  mobileMethod,
  mobileNumber,
  cardNumber,
  intervalMs = 5000,
}: {
  pollUrl: string
  mobileMethod?: PaynowMobileMethod
  mobileNumber?: string
  cardNumber?: string
  intervalMs?: number
}) {
  'use step'

  while (true) {
    const pollResult = await pollPaynowTransaction(pollUrl)

    if (pollResult.paid || pollResult.failed) {
      return {
        authorized: pollResult.paid,
        mobileMethod,
        mobileNumber,
        cardNumber,
        pollUrl: pollResult.pollUrl || pollUrl,
        paynowReference: pollResult.paynowReference,
        error: pollResult.failed
          ? pollResult.error || `Paynow payment ${pollResult.status}.`
          : undefined,
      }
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}
