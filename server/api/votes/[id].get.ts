import { and, eq } from 'drizzle-orm'
import { db } from '../../db'
import { ballots } from '../../db/schema'
import { apiError } from '../../utils/apiErrorMessages'
import { getOptionalUser } from '../../utils/requireAuth'
import { getVoteWithResults, isUserEligible } from '../../utils/voteResults'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw apiError(400, 'requiredId')

  const user = await getOptionalUser(event)
  const isAdmin = user?.role === 'admin'

  const vote = await getVoteWithResults(id, { includeHidden: isAdmin })
  if (!vote || (!vote.visible && !isAdmin)) throw apiError(404, 'voteNotFound')

  let myBallot: { optionId: string; updatedAt: string } | null = null
  let canVote = false

  if (user) {
    canVote = isUserEligible(user, vote)
    const [ballot] = await db
      .select({ optionId: ballots.optionId, updatedAt: ballots.updatedAt })
      .from(ballots)
      .where(and(eq(ballots.voteId, vote.id), eq(ballots.userId, user.id)))
      .limit(1)
    if (ballot) myBallot = { optionId: ballot.optionId, updatedAt: ballot.updatedAt.toISOString() }
  }

  return { data: { ...vote, myBallot, canVote } }
})
