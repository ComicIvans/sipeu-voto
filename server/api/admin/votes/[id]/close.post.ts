import { eq, sql } from 'drizzle-orm'
import { db } from '../../../../db'
import { votes } from '../../../../db/schema'
import { apiError } from '../../../../utils/apiErrorMessages'
import { lockVote } from '../../../../utils/adminVotes'
import { emitVoteChanged } from '../../../../utils/sseManager'
import { getVoteWithResults } from '../../../../utils/voteResults'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw apiError(400, 'requiredId')

  const updated = await db.transaction(async (tx) => {
    const vote = await lockVote(tx, id)
    if (!vote.open) throw apiError(409, 'voteAlreadyClosed')

    const [row] = await tx
      .update(votes)
      .set({ open: false, endedAt: sql`now()` })
      .where(eq(votes.id, id))
      .returning()
    return row!
  })

  emitVoteChanged(updated)
  return { data: await getVoteWithResults(id, { includeHidden: true }) }
})
