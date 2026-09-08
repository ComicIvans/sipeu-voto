import { eq } from 'drizzle-orm'
import { db } from '../../../db'
import { votes } from '../../../db/schema'
import { apiError } from '../../../utils/apiErrorMessages'
import { requireVote } from '../../../utils/adminVotes'
import { emitContentChanged, emitVoteChanged } from '../../../utils/sseManager'
import { getVoteWithResults } from '../../../utils/voteResults'
import { updateVoteSchema } from '../../../validation/votes'
import { parseBody } from '../../../validation/common'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw apiError(400, 'requiredId')
  const body = parseBody(updateVoteSchema, await readBody(event))

  const current = await requireVote(id)

  if (current.open && body.visible === false) throw apiError(409, 'voteHiddenOpenBlocked')

  const [updated] = await db.update(votes).set(body).where(eq(votes.id, id)).returning()

  emitContentChanged('votes', updated!.committeeId)
  if (current.committeeId !== updated!.committeeId) emitContentChanged('votes', current.committeeId)
  emitVoteChanged(updated!)

  return { data: await getVoteWithResults(id, { includeHidden: true }) }
})
