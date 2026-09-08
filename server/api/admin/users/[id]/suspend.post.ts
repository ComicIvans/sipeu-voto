import { eq } from 'drizzle-orm'
import { db } from '../../../../db'
import { sessions, users } from '../../../../db/schema'
import { apiError } from '../../../../utils/apiErrorMessages'
import { findAdminUser } from '../../../../utils/adminUsers'
import { requireAdmin } from '../../../../utils/requireAuth'
import { emitContentChanged } from '../../../../utils/sseManager'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw apiError(400, 'requiredId')
  const admin = await requireAdmin(event)
  if (id === admin.id) throw apiError(409, 'cannotSuspendSelf')

  const [updated] = await db
    .update(users)
    .set({ banned: true, banReason: 'Suspendido por la organización' })
    .where(eq(users.id, id))
    .returning()
  if (!updated) throw apiError(404, 'userNotFound')

  await db.delete(sessions).where(eq(sessions.userId, id))
  emitContentChanged('users')

  return { data: await findAdminUser(id) }
})
