import { requireAdmin, requireUser } from '../utils/requireAuth'

/**
 * Global guard for protected API prefixes. Handlers under these prefixes may
 * still call requireUser/requireAdmin themselves; this is the safety net.
 */
export default defineEventHandler(async (event) => {
  if (event.method === 'OPTIONS') return
  const path = event.path.split('?')[0] ?? ''

  if (path.startsWith('/api/admin/')) {
    await requireAdmin(event)
    return
  }

  if (path === '/api/me' || path.startsWith('/api/me/')) {
    await requireUser(event)
  }
})
