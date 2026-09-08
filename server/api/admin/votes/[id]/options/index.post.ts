import { count, eq } from 'drizzle-orm'
import { db } from '../../../../../db'
import { voteOptions } from '../../../../../db/schema'
import { apiError } from '../../../../../utils/apiErrorMessages'
import { requireVote } from '../../../../../utils/adminVotes'
import { emitVoteChanged } from '../../../../../utils/sseManager'
import { voteOptionInputSchema } from '../../../../../validation/votes'
import { parseBody } from '../../../../../validation/common'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw apiError(400, 'requiredId')
  const body = parseBody(voteOptionInputSchema, await readBody(event))

  const vote = await requireVote(id)
  if (vote.open) throw apiError(409, 'optionChangeWhileOpen')

  const [existing] = await db
    .select({ total: count() })
    .from(voteOptions)
    .where(eq(voteOptions.voteId, id))

  const [created] = await db
    .insert(voteOptions)
    .values({
      voteId: id,
      label: body.label,
      color: body.color ?? null,
      canWin: body.canWin ?? true,
      order: existing?.total ?? 0,
    })
    .returning()

  emitVoteChanged(vote)
  return { data: created }
})
