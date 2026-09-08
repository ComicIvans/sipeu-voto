import { eq } from 'drizzle-orm'
import { db } from '../../../db'
import { votes } from '../../../db/schema'
import { apiError } from '../../../utils/apiErrorMessages'
import { emitContentChanged } from '../../../utils/sseManager'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw apiError(400, 'requiredId')

  const [deleted] = await db.delete(votes).where(eq(votes.id, id)).returning()
  if (!deleted) throw apiError(404, 'voteNotFound')

  emitContentChanged('votes', deleted.committeeId)
  return { data: { id } }
})
