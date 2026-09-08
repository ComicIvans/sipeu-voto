import { eq, sql } from 'drizzle-orm'
import { db } from '../../../../db'
import { voteOptions, votes } from '../../../../db/schema'
import { apiError } from '../../../../utils/apiErrorMessages'
import { requireVote } from '../../../../utils/adminVotes'
import { emitVoteChanged } from '../../../../utils/sseManager'
import { getVoteWithResults } from '../../../../utils/voteResults'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw apiError(400, 'requiredId')

  const vote = await requireVote(id)
  if (vote.open) throw apiError(409, 'voteAlreadyOpen')
  if (!vote.visible) throw apiError(409, 'voteHiddenOpenBlocked')

  const options = await db
    .select({ canWin: voteOptions.canWin })
    .from(voteOptions)
    .where(eq(voteOptions.voteId, id))
  if (options.length === 0) throw apiError(409, 'voteMissingOptions')
  if (!options.some((option) => option.canWin)) throw apiError(409, 'voteNoWinningOption')

  const [updated] = await db
    .update(votes)
    .set({ open: true, startedAt: sql`now()`, endedAt: null })
    .where(eq(votes.id, id))
    .returning()

  emitVoteChanged(updated!)
  return { data: await getVoteWithResults(id, { includeHidden: true }) }
})
