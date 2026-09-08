import { eq } from 'drizzle-orm'
import { db } from '../../../db'
import { votes } from '../../../db/schema'
import { apiError } from '../../../utils/apiErrorMessages'
import { assertVoteConditionsEditable, countBallots, lockVote } from '../../../utils/adminVotes'
import { emitContentChanged, emitVoteChanged } from '../../../utils/sseManager'
import { getVoteWithResults } from '../../../utils/voteResults'
import { updateVoteSchema } from '../../../validation/votes'
import { parseBody } from '../../../validation/common'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw apiError(400, 'requiredId')
  const body = parseBody(updateVoteSchema, await readBody(event))

  const { previous, updated } = await db.transaction(async (tx) => {
    const current = await lockVote(tx, id)
    // Only an actual change is refused. `open.post.ts` will not open a hidden
    // vote, so this is belt and braces, but a patch that merely resubmits the
    // current value must never be rejected.
    if (current.open && current.visible && body.visible === false) {
      throw apiError(409, 'voteVisibleOpenLocked')
    }
    assertVoteConditionsEditable(current, await countBallots(id, tx), body)

    const [row] = await tx.update(votes).set(body).where(eq(votes.id, id)).returning()
    return { previous: current, updated: row! }
  })

  emitContentChanged('votes', updated.committeeId)
  if (previous.committeeId !== updated.committeeId)
    emitContentChanged('votes', previous.committeeId)
  emitVoteChanged(updated)

  return { data: await getVoteWithResults(id, { includeHidden: true }) }
})
