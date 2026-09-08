import { and, eq } from 'drizzle-orm'
import { db } from '../../../../db'
import { ballots, voteOptions, votes } from '../../../../db/schema'
import { apiError } from '../../../../utils/apiErrorMessages'
import { requireUser } from '../../../../utils/requireAuth'
import { emitVoteChanged } from '../../../../utils/sseManager'
import { isUserEligible } from '../../../../utils/voteResults'
import { castBallotSchema } from '../../../../validation/votes'
import { parseBody } from '../../../../validation/common'

export default defineEventHandler(async (event) => {
  const voteId = getRouterParam(event, 'id')
  if (!voteId) throw apiError(400, 'requiredId')

  const user = await requireUser(event)
  if (!user.committee) throw apiError(403, 'voteNoCommittee')

  const { optionId } = parseBody(castBallotSchema, await readBody(event))

  const vote = await db.query.votes.findFirst({ where: eq(votes.id, voteId) })
  if (!vote || !vote.visible) throw apiError(404, 'voteNotFound')
  if (!vote.open) throw apiError(409, 'voteNotOpen')
  if (!isUserEligible(user, vote)) throw apiError(403, 'voteNotEligible')

  const option = await db.query.voteOptions.findFirst({
    where: and(eq(voteOptions.id, optionId), eq(voteOptions.voteId, voteId)),
  })
  if (!option) throw apiError(404, 'optionNotFound')

  const existing = await db.query.ballots.findFirst({
    where: and(eq(ballots.voteId, voteId), eq(ballots.userId, user.id)),
  })

  if (existing) {
    if (!vote.allowChange) throw apiError(409, 'voteChangeNotAllowed')
    if (existing.optionId !== optionId) {
      await db.update(ballots).set({ optionId }).where(eq(ballots.id, existing.id))
    }
  } else {
    await db.insert(ballots).values({ voteId, userId: user.id, optionId })
  }

  emitVoteChanged(vote)

  return { data: { voteId, optionId, changed: Boolean(existing) } }
})
