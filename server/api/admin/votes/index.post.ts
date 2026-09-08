import { db } from '../../../db'
import { voteOptions, votes } from '../../../db/schema'
import { assertScheduleOrdered } from '../../../utils/adminVotes'
import { emitContentChanged } from '../../../utils/sseManager'
import { getVoteWithResults } from '../../../utils/voteResults'
import { createVoteSchema } from '../../../validation/votes'
import { parseBody } from '../../../validation/common'

export default defineEventHandler(async (event) => {
  const body = parseBody(createVoteSchema, await readBody(event))
  assertScheduleOrdered({ opensAt: null, closesAt: null }, body)

  const created = await db.transaction(async (tx) => {
    const [vote] = await tx
      .insert(votes)
      .values({
        name: body.name,
        description: body.description ?? null,
        committeeId: body.committeeId,
        visible: body.visible ?? true,
        allowChange: body.allowChange ?? false,
        showLiveResults: body.showLiveResults ?? true,
        minimumVotes: body.minimumVotes ?? null,
        maxWinners: body.maxWinners ?? null,
        opensAt: body.opensAt ?? null,
        closesAt: body.closesAt ?? null,
      })
      .returning()

    if (body.options && body.options.length > 0) {
      await tx.insert(voteOptions).values(
        body.options.map((option, index) => ({
          voteId: vote!.id,
          label: option.label,
          color: option.color ?? null,
          canWin: option.canWin ?? true,
          order: index,
        }))
      )
    }

    return vote!
  })

  emitContentChanged('votes', created.committeeId)
  return { data: await getVoteWithResults(created.id, { includeHidden: true }) }
})
