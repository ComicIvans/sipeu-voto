import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm'
import { db } from '../../db'
import { ballots, votes } from '../../db/schema'
import { requireUser } from '../../utils/requireAuth'
import { getVoteSummary } from '../../utils/voteResults'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  if (!user.committee) {
    return { data: { votes: [], hasCommittee: false } }
  }

  const rows = await db
    .select({ id: votes.id })
    .from(votes)
    .where(
      and(
        eq(votes.visible, true),
        or(isNull(votes.committeeId), eq(votes.committeeId, user.committee.id))
      )
    )
    .orderBy(desc(votes.open), desc(votes.startedAt), desc(votes.createdAt))

  const voteIds = rows.map((row) => row.id)
  const myBallots =
    voteIds.length > 0
      ? await db
          .select({ voteId: ballots.voteId, optionId: ballots.optionId })
          .from(ballots)
          .where(and(eq(ballots.userId, user.id), inArray(ballots.voteId, voteIds)))
      : []
  const ballotByVote = new Map(myBallots.map((ballot) => [ballot.voteId, ballot.optionId]))

  const includeHidden = user.role === 'admin'
  const summaries = await Promise.all(voteIds.map((id) => getVoteSummary(id, { includeHidden })))

  return {
    data: {
      hasCommittee: true,
      votes: summaries
        .filter((vote) => vote !== null)
        .map((vote) => ({ ...vote, myOptionId: ballotByVote.get(vote.id) ?? null })),
    },
  }
})
