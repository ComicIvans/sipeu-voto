import { eq, sql } from 'drizzle-orm'
import { db } from '../../../../db'
import { voteOptions, votes } from '../../../../db/schema'
import { apiError } from '../../../../utils/apiErrorMessages'
import { lockVote } from '../../../../utils/adminVotes'
import { emitVoteChanged } from '../../../../utils/sseManager'
import { getVoteWithResults } from '../../../../utils/voteResults'
import { scheduleAfterOpen } from '~~/shared/utils/voteSchedule'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw apiError(400, 'requiredId')

  const updated = await db.transaction(async (tx) => {
    const vote = await lockVote(tx, id)
    if (vote.open) throw apiError(409, 'voteAlreadyOpen')
    if (!vote.visible) throw apiError(409, 'voteHiddenOpenBlocked')

    const options = await tx
      .select({ canWin: voteOptions.canWin })
      .from(voteOptions)
      .where(eq(voteOptions.voteId, id))
    if (options.length === 0) throw apiError(409, 'voteMissingOptions')
    if (!options.some((option) => option.canWin)) throw apiError(409, 'voteNoWinningOption')

    const [row] = await tx
      .update(votes)
      .set({
        open: true,
        startedAt: vote.startedAt ?? sql`now()`,
        endedAt: null,
        ...scheduleAfterOpen(vote, new Date()),
      })
      .where(eq(votes.id, id))
      .returning()
    return row!
  })

  emitVoteChanged(updated)
  return { data: await getVoteWithResults(id, { includeHidden: true }) }
})
