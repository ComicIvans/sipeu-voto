import { auth } from '../../utils/auth'
import { apiError } from '../../utils/apiErrorMessages'

/**
 * Only the auth operations this product uses are exposed. Everything else the
 * Better Auth handler offers (update-user, delete-user, change-email, admin
 * plugin routes, ...) is handled by the app's own endpoints or not needed.
 */
const ALLOWED_PATHS = new Set([
  '/sign-in/email',
  '/sign-out',
  '/get-session',
  '/change-password',
  '/list-sessions',
  '/revoke-session',
  '/revoke-other-sessions',
  '/ok',
])

export default defineEventHandler(async (event) => {
  const path = (getRouterParam(event, 'all') ?? '').replace(/\/+$/, '')
  const normalized = `/${path}`

  if (!ALLOWED_PATHS.has(normalized)) throw apiError(404, 'notFound')

  return auth.handler(toWebRequest(event))
})
