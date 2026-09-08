import { and, eq } from 'drizzle-orm'
import { db } from '../../../../../db'
import { voteOptions } from '../../../../../db/schema'
import { apiError } from '../../../../../utils/apiErrorMessages'
import { requireVote } from '../../../../../utils/adminVotes'
import { emitVoteChanged } from '../../../../../utils/sseManager'
import { reorderOptionsSchema } from '../../../../../validation/votes'
import { parseBody } from '../../../../../validation/common'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw apiError(400, 'requiredId')
  const { optionIds } = parseBody(reorderOptionsSchema, await readBody(event))

  const vote = await requireVote(id)

  await db.transaction(async (tx) => {
    for (const [index, optionId] of optionIds.entries()) {
      await tx
        .update(voteOptions)
        .set({ order: index })
        .where(and(eq(voteOptions.id, optionId), eq(voteOptions.voteId, id)))
    }
  })

  emitVoteChanged(vote)
  return { data: { ok: true } }
})
