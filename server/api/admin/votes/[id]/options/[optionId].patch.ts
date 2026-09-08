import { and, eq } from 'drizzle-orm'
import { db } from '../../../../../db'
import { voteOptions } from '../../../../../db/schema'
import { apiError } from '../../../../../utils/apiErrorMessages'
import { requireVote } from '../../../../../utils/adminVotes'
import { emitVoteChanged } from '../../../../../utils/sseManager'
import { updateOptionSchema } from '../../../../../validation/votes'
import { parseBody } from '../../../../../validation/common'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const optionId = getRouterParam(event, 'optionId')
  if (!id || !optionId) throw apiError(400, 'requiredId')
  const body = parseBody(updateOptionSchema, await readBody(event))

  const vote = await requireVote(id)
  if (vote.open && body.label !== undefined) throw apiError(409, 'optionChangeWhileOpen')

  const [updated] = await db
    .update(voteOptions)
    .set(body)
    .where(and(eq(voteOptions.id, optionId), eq(voteOptions.voteId, id)))
    .returning()
  if (!updated) throw apiError(404, 'optionNotFound')

  emitVoteChanged(vote)
  return { data: updated }
})
