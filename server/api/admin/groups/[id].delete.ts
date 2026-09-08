import { count, eq } from 'drizzle-orm'
import { db } from '../../../db'
import { ballots, parliamentaryGroups, users } from '../../../db/schema'
import { apiError } from '../../../utils/apiErrorMessages'
import { discardEntityImage } from '../../../utils/images'
import { emitContentChanged } from '../../../utils/sseManager'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw apiError(400, 'requiredId')

  const [members] = await db.select({ total: count() }).from(users).where(eq(users.groupId, id))
  if ((members?.total ?? 0) > 0) throw apiError(409, 'groupHasMembers')

  // Ballots keep the group the voter belonged to when they voted; removing it
  // would rewrite the history of already closed votes.
  const [voted] = await db.select({ total: count() }).from(ballots).where(eq(ballots.groupId, id))
  if ((voted?.total ?? 0) > 0) throw apiError(409, 'groupHasBallots')

  const [deleted] = await db
    .delete(parliamentaryGroups)
    .where(eq(parliamentaryGroups.id, id))
    .returning()
  if (!deleted) throw apiError(404, 'groupNotFound')

  // Only now: a delete refused because of members or ballots must leave the
  // logo where it is.
  await discardEntityImage(deleted.logo, `group:${id}`)

  emitContentChanged('groups')
  return { data: deleted }
})
