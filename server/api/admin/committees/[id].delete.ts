import { count, eq } from 'drizzle-orm'
import { db } from '../../../db'
import { ballots, committees, users, votes } from '../../../db/schema'
import { apiError } from '../../../utils/apiErrorMessages'
import { discardEntityImage } from '../../../utils/images'
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

  // Plenary ballots also point at the committee the voter belonged to, so the
  // "no votes of its own" check above does not cover every reference.
  const [voted] = await db
    .select({ total: count() })
    .from(ballots)
    .where(eq(ballots.committeeId, id))
  if ((voted?.total ?? 0) > 0) throw apiError(409, 'committeeHasBallots')

  const [deleted] = await db.delete(committees).where(eq(committees.id, id)).returning()
  if (!deleted) throw apiError(404, 'committeeNotFound')

  // Only now: a delete refused because of members, votes or ballots must leave
  // the cover where it is.
  await discardEntityImage(deleted.cover, `committee:${id}`)

  emitContentChanged('committees')
  return { data: deleted }
})
