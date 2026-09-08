import { eq } from 'drizzle-orm'
import { db } from '../../../db'
import { parliamentaryGroups } from '../../../db/schema'
import { apiError } from '../../../utils/apiErrorMessages'
import { emitContentChanged } from '../../../utils/sseManager'
import { groupSchema } from '../../../validation/catalog'
import { parseBody } from '../../../validation/common'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw apiError(400, 'requiredId')
  const body = parseBody(groupSchema.partial(), await readBody(event))

  try {
    const [updated] = await db
      .update(parliamentaryGroups)
      .set(body)
      .where(eq(parliamentaryGroups.id, id))
      .returning()
    if (!updated) throw apiError(404, 'groupNotFound')
    emitContentChanged('groups')
    return { data: updated }
  } catch (error) {
    if ((error as { code?: string }).code === '23505') throw apiError(409, 'duplicateRecord')
    throw error
  }
})
