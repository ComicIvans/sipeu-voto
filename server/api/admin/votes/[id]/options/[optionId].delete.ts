import { and, count, eq } from 'drizzle-orm'
import { db } from '../../../../../db'
import { ballots, voteOptions } from '../../../../../db/schema'
import { apiError } from '../../../../../utils/apiErrorMessages'
import { requireVote } from '../../../../../utils/adminVotes'
import { emitVoteChanged } from '../../../../../utils/sseManager'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const optionId = getRouterParam(event, 'optionId')
  if (!id || !optionId) throw apiError(400, 'requiredId')

  const vote = await requireVote(id)
  if (vote.open) throw apiError(409, 'optionChangeWhileOpen')

  const [usage] = await db
    .select({ total: count() })
    .from(ballots)
    .where(eq(ballots.optionId, optionId))
  if ((usage?.total ?? 0) > 0) throw apiError(409, 'optionHasBallots')

  const [deleted] = await db
    .delete(voteOptions)
    .where(and(eq(voteOptions.id, optionId), eq(voteOptions.voteId, id)))
    .returning()
  if (!deleted) throw apiError(404, 'optionNotFound')

  emitVoteChanged(vote)
  return { data: { id: optionId } }
})
