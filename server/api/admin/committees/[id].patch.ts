import { eq } from 'drizzle-orm'
import { db } from '../../../db'
import { committees } from '../../../db/schema'
import { apiError } from '../../../utils/apiErrorMessages'
import { emitContentChanged } from '../../../utils/sseManager'
import { committeeSchema } from '../../../validation/catalog'
import { parseBody } from '../../../validation/common'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw apiError(400, 'requiredId')
  const body = parseBody(committeeSchema.partial(), await readBody(event))

  try {
    const [updated] = await db.update(committees).set(body).where(eq(committees.id, id)).returning()
    if (!updated) throw apiError(404, 'committeeNotFound')
    emitContentChanged('committees')
    return { data: updated }
  } catch (error) {
    if ((error as { code?: string }).code === '23505') throw apiError(409, 'duplicateRecord')
    throw error
  }
})
