import { and, eq } from 'drizzle-orm'
import { db } from '../../../../db'
import { ballots, users, voteOptions, votes } from '../../../../db/schema'
import { apiError } from '../../../../utils/apiErrorMessages'
import { requireUser } from '../../../../utils/requireAuth'
import { emitVoteChanged } from '../../../../utils/sseManager'
import { castBallotSchema } from '../../../../validation/votes'
import { parseBody } from '../../../../validation/common'

/**
 * Casts (or changes) the caller's ballot. The vote row is locked for the whole
 * transaction so closing/resetting the vote and casting a ballot serialise:
 * either the ballot lands before the close, or it is rejected afterwards.
 * Double submissions are idempotent thanks to the unique (vote, user) index.
 */
export default defineEventHandler(async (event) => {
  const voteId = getRouterParam(event, 'id')
  if (!voteId) throw apiError(400, 'requiredId')

  const sessionUser = await requireUser(event)
  const { optionId } = parseBody(castBallotSchema, await readBody(event))

  const result = await db.transaction(async (tx) => {
    const [vote] = await tx.select().from(votes).where(eq(votes.id, voteId)).for('update')
    if (!vote || !vote.visible) throw apiError(404, 'voteNotFound')
    if (!vote.open) throw apiError(409, 'voteNotOpen')

    const [user] = await tx
      .select({ banned: users.banned, committeeId: users.committeeId, groupId: users.groupId })
      .from(users)
      .where(eq(users.id, sessionUser.id))
      .for('share')
    if (!user || user.banned) throw apiError(403, 'suspended')
    if (!user.committeeId) throw apiError(403, 'voteNoCommittee')
    if (vote.committeeId !== null && vote.committeeId !== user.committeeId) {
      throw apiError(403, 'voteNotEligible')
    }

    const [option] = await tx
      .select({ id: voteOptions.id })
      .from(voteOptions)
      .where(and(eq(voteOptions.id, optionId), eq(voteOptions.voteId, voteId)))
    if (!option) throw apiError(404, 'optionNotFound')

    const inserted = await tx
      .insert(ballots)
      .values({
        voteId,
        userId: sessionUser.id,
        optionId,
        groupId: user.groupId,
        committeeId: user.committeeId,
      })
      .onConflictDoNothing({ target: [ballots.voteId, ballots.userId] })
      .returning({ id: ballots.id })

    if (inserted.length > 0) {
      return { vote, optionId, created: true, changed: false }
    }

    const [existing] = await tx
      .select({ id: ballots.id, optionId: ballots.optionId })
      .from(ballots)
      .where(and(eq(ballots.voteId, voteId), eq(ballots.userId, sessionUser.id)))
      .for('update')
    if (!existing) throw apiError(409, 'voteNotOpen')

    if (existing.optionId === optionId) {
      return { vote, optionId, created: false, changed: false }
    }

    if (!vote.allowChange) {
      throw apiError(409, 'voteChangeNotAllowed', { currentOptionId: existing.optionId })
    }

    await tx.update(ballots).set({ optionId }).where(eq(ballots.id, existing.id))
    return { vote, optionId, created: false, changed: true }
  })

  if (result.created || result.changed) emitVoteChanged(result.vote)

  return {
    data: { voteId, optionId: result.optionId, created: result.created, changed: result.changed },
  }
})
