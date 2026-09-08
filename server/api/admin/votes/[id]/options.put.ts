import { and, asc, count, eq, inArray } from 'drizzle-orm'
import { db } from '../../../../db'
import { ballots, voteOptions } from '../../../../db/schema'
import { apiError } from '../../../../utils/apiErrorMessages'
import { countBallots, lockVote } from '../../../../utils/adminVotes'
import { emitVoteChanged } from '../../../../utils/sseManager'
import { getVoteWithResults } from '../../../../utils/voteResults'
import { replaceOptionsSchema } from '../../../../validation/votes'
import { parseBody } from '../../../../validation/common'

/**
 * Replaces the whole option list in one transaction. While the vote has
 * ballots only colour and order may change; while open nothing may change.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw apiError(400, 'requiredId')
  const { options } = parseBody(replaceOptionsSchema, await readBody(event))

  const vote = await db.transaction(async (tx) => {
    const current = await lockVote(tx, id)
    if (current.open) throw apiError(409, 'optionChangeWhileOpen')

    const existing = await tx
      .select()
      .from(voteOptions)
      .where(eq(voteOptions.voteId, id))
      .orderBy(asc(voteOptions.order))
    const existingById = new Map(existing.map((option) => [option.id, option]))
    const ballotCount = await countBallots(id, tx)

    const keptIds = new Set(options.map((option) => option.id).filter(Boolean) as string[])
    for (const optionId of keptIds) {
      if (!existingById.has(optionId)) throw apiError(404, 'optionNotFound')
    }
    const removed = existing.filter((option) => !keptIds.has(option.id))

    if (ballotCount > 0) {
      const added = options.some((option) => !option.id)
      const meaningChanged = options.some((option) => {
        if (!option.id) return false
        const before = existingById.get(option.id)!
        return before.label !== option.label || before.canWin !== (option.canWin ?? true)
      })
      if (added || removed.length > 0 || meaningChanged) throw apiError(409, 'voteLocked')
    }

    if (removed.length > 0) {
      const [usage] = await tx
        .select({ total: count() })
        .from(ballots)
        .where(
          and(
            eq(ballots.voteId, id),
            inArray(
              ballots.optionId,
              removed.map((option) => option.id)
            )
          )
        )
      if ((usage?.total ?? 0) > 0) throw apiError(409, 'optionHasBallots')
      await tx.delete(voteOptions).where(
        inArray(
          voteOptions.id,
          removed.map((option) => option.id)
        )
      )
    }

    for (const [index, option] of options.entries()) {
      if (option.id) {
        await tx
          .update(voteOptions)
          .set({
            label: option.label,
            color: option.color ?? null,
            canWin: option.canWin ?? true,
            order: index,
          })
          .where(and(eq(voteOptions.id, option.id), eq(voteOptions.voteId, id)))
      } else {
        await tx.insert(voteOptions).values({
          voteId: id,
          label: option.label,
          color: option.color ?? null,
          canWin: option.canWin ?? true,
          order: index,
        })
      }
    }

    return current
  })

  emitVoteChanged(vote)
  return { data: await getVoteWithResults(id, { includeHidden: true }) }
})
