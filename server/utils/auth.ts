import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin } from 'better-auth/plugins'
import { getOptionalConfigUrl, requireConfigString } from '~~/shared/utils/config'
import { db } from '../db'
import { users, sessions, accounts, verifications } from '../db/schema'

function getAuthBaseUrl() {
  return (
    getOptionalConfigUrl(process.env.BETTER_AUTH_URL, 'BETTER_AUTH_URL') ||
    getOptionalConfigUrl(process.env.NUXT_SITE_URL, 'NUXT_SITE_URL') ||
    undefined
  )
}

function getTrustedOrigins() {
  const origin = getAuthBaseUrl()
  return origin ? [new URL(origin).origin] : []
}

export const auth = betterAuth({
  baseURL: getAuthBaseUrl(),
  secret: requireConfigString(process.env.APP_SECRET, 'APP_SECRET'),
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
    revokeSessionsOnPasswordReset: true,
  },
  user: {
    additionalFields: {
      firstName: { type: 'string', required: false, defaultValue: '', input: false },
      lastName: { type: 'string', required: false, defaultValue: '', input: false },
      committeeId: { type: 'string', required: false, input: false },
      groupId: { type: 'string', required: false, input: false },
      photoRemovedAt: { type: 'date', required: false, input: false },
    },
  },
  plugins: [admin({ defaultRole: 'delegate', adminRoles: ['admin'] })],
  // Everyone at the venue shares one IP: per-IP rate limiting would lock the room out.
  rateLimit: {
    enabled: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: false,
    },
  },
  advanced: {
    cookies: {
      session_token: {
        attributes: {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax' as const,
          path: '/',
        },
      },
    },
  },
  trustedOrigins: getTrustedOrigins(),
})

export type AuthSession = typeof auth.$Infer.Session
