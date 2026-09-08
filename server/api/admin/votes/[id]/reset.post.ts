import { eq } from 'drizzle-orm'
import { db } from '../../../../db'
import { ballots, votes } from '../../../../db/schema'
import { apiError } from '../../../../utils/apiErrorMessages'
import { lockVote } from '../../../../utils/adminVotes'
import { emitVoteChanged } from '../../../../utils/sseManager'
import { getVoteWithResults } from '../../../../utils/voteResults'

/** Clears every ballot so the vote goes back to "pending". Only while closed. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw apiError(400, 'requiredId')

  const updated = await db.transaction(async (tx) => {
    const vote = await lockVote(tx, id)
    if (vote.open) throw apiError(409, 'voteResetWhileOpen')

    await tx.delete(ballots).where(eq(ballots.voteId, id))
    const [row] = await tx
      .update(votes)
      .set({ startedAt: null, endedAt: null, open: false })
      .where(eq(votes.id, id))
      .returning()
    return row!
  })

  emitVoteChanged(updated)
  return { data: await getVoteWithResults(id, { includeHidden: true }) }
})
