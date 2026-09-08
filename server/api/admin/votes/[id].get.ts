import { apiError } from '../../../utils/apiErrorMessages'
import { getVoteWithResults } from '../../../utils/voteResults'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw apiError(400, 'requiredId')

  const vote = await getVoteWithResults(id, { includeHidden: true })
  if (!vote) throw apiError(404, 'voteNotFound')
  return { data: vote }
})
