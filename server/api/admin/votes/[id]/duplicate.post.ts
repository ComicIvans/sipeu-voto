import { asc, eq } from 'drizzle-orm'
import { db } from '../../../../db'
import { voteOptions, votes } from '../../../../db/schema'
import { apiError } from '../../../../utils/apiErrorMessages'
import { emitContentChanged } from '../../../../utils/sseManager'
import { getVoteWithResults } from '../../../../utils/voteResults'

/** Creates a fresh pending copy (same options and rules, no ballots). */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw apiError(400, 'requiredId')

  const source = await db.query.votes.findFirst({
    where: eq(votes.id, id),
    with: { options: { orderBy: [asc(voteOptions.order)] } },
  })
  if (!source) throw apiError(404, 'voteNotFound')

  const created = await db.transaction(async (tx) => {
    const [vote] = await tx
      .insert(votes)
      .values({
        name: `${source.name} (repetición)`,
        description: source.description,
        committeeId: source.committeeId,
        visible: source.visible,
        allowChange: source.allowChange,
        showLiveResults: source.showLiveResults,
        minimumVotes: source.minimumVotes,
        maxWinners: source.maxWinners,
        order: source.order,
      })
      .returning()

    if (source.options.length > 0) {
      await tx.insert(voteOptions).values(
        source.options.map((option, index) => ({
          voteId: vote!.id,
          label: option.label,
          color: option.color,
          canWin: option.canWin,
          order: index,
        }))
      )
    }
    return vote!
  })

  emitContentChanged('votes', created.committeeId)
  return { data: await getVoteWithResults(created.id, { includeHidden: true }) }
})
