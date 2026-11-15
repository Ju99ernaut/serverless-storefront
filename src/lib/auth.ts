import { createNeonAuth } from '@neon/auth/next/server'

export const neonAuth = createNeonAuth({
  baseUrl:
    process.env.NEON_AUTH_BASE_URL ||
    'https://ep-example.neonauth.us-east-1.aws.neon.tech/neondb/auth',
  cookies: {
    secret:
      process.env.NEON_AUTH_COOKIE_SECRET ||
      'default-storefront-neon-auth-cookie-secret-32chars',
  },
  logLevel: 'silent',
})
