import { count, eq } from 'drizzle-orm'
import { db } from '../../../db'
import { parliamentaryGroups, users } from '../../../db/schema'
import { apiError } from '../../../utils/apiErrorMessages'
import { emitContentChanged } from '../../../utils/sseManager'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw apiError(400, 'requiredId')

  const [members] = await db.select({ total: count() }).from(users).where(eq(users.groupId, id))
  if ((members?.total ?? 0) > 0) throw apiError(409, 'groupHasMembers')

  const [deleted] = await db
    .delete(parliamentaryGroups)
    .where(eq(parliamentaryGroups.id, id))
    .returning()
  if (!deleted) throw apiError(404, 'groupNotFound')
  emitContentChanged('groups')
  return { data: deleted }
})
