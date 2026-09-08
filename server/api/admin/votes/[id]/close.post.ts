import { eq, sql } from 'drizzle-orm'
import { db } from '../../../../db'
import { votes } from '../../../../db/schema'
import { apiError } from '../../../../utils/apiErrorMessages'
import { requireVote } from '../../../../utils/adminVotes'
import { emitVoteChanged } from '../../../../utils/sseManager'
import { getVoteWithResults } from '../../../../utils/voteResults'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw apiError(400, 'requiredId')

  const vote = await requireVote(id)
  if (!vote.open) throw apiError(409, 'voteAlreadyClosed')

  const [updated] = await db
    .update(votes)
    .set({ open: false, endedAt: sql`now()` })
    .where(eq(votes.id, id))
    .returning()

  emitVoteChanged(updated!)
  return { data: await getVoteWithResults(id, { includeHidden: true }) }
})
