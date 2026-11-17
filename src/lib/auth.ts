import { createNeonAuth } from '@neon/auth/next/server'

export const neonAuth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.DB_SECRET!,
  },
  logLevel: 'silent',
})
