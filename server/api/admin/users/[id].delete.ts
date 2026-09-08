import { count, eq } from 'drizzle-orm'
import { db } from '../../../db'
import { ballots, users } from '../../../db/schema'
import { apiError } from '../../../utils/apiErrorMessages'
import { deleteAvatarFile } from '../../../utils/avatars'
import { requireAdmin } from '../../../utils/requireAuth'
import { emitContentChanged } from '../../../utils/sseManager'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw apiError(400, 'requiredId')
  const admin = await requireAdmin(event)
  if (id === admin.id) throw apiError(409, 'cannotDeleteSelf')

  const [usage] = await db.select({ total: count() }).from(ballots).where(eq(ballots.userId, id))
  if ((usage?.total ?? 0) > 0) throw apiError(409, 'userHasBallots')

  const [deleted] = await db.delete(users).where(eq(users.id, id)).returning()
  if (!deleted) throw apiError(404, 'userNotFound')
  await deleteAvatarFile(deleted.image)

  emitContentChanged('users')
  return { data: { id } }
})
