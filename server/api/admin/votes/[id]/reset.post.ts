import { eq } from 'drizzle-orm'
import { db } from '../../../../db'
import { ballots, votes } from '../../../../db/schema'
import { apiError } from '../../../../utils/apiErrorMessages'
import { requireVote } from '../../../../utils/adminVotes'
import { emitVoteChanged } from '../../../../utils/sseManager'
import { getVoteWithResults } from '../../../../utils/voteResults'

/** Clears every ballot so the vote can be run again from scratch. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw apiError(400, 'requiredId')

  const vote = await requireVote(id)
  await db.delete(ballots).where(eq(ballots.voteId, id))
  await db
    .update(votes)
    .set({ startedAt: null, endedAt: null, open: false })
    .where(eq(votes.id, id))

  emitVoteChanged({ ...vote, open: false })
  return { data: await getVoteWithResults(id, { includeHidden: true }) }
})
