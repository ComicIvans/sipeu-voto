import { count, eq } from 'drizzle-orm'
import { db } from '../../../db'
import { committees, users, votes } from '../../../db/schema'
import { apiError } from '../../../utils/apiErrorMessages'
import { emitContentChanged } from '../../../utils/sseManager'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw apiError(400, 'requiredId')

  const [members] = await db.select({ total: count() }).from(users).where(eq(users.committeeId, id))
  if ((members?.total ?? 0) > 0) throw apiError(409, 'committeeHasMembers')

  const [voteUsage] = await db
    .select({ total: count() })
    .from(votes)
    .where(eq(votes.committeeId, id))
  if ((voteUsage?.total ?? 0) > 0) throw apiError(409, 'committeeHasVotes')

  const [deleted] = await db.delete(committees).where(eq(committees.id, id)).returning()
  if (!deleted) throw apiError(404, 'committeeNotFound')
  emitContentChanged('committees')
  return { data: deleted }
})
