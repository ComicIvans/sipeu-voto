import { db } from '../../../db'
import { parliamentaryGroups } from '../../../db/schema'
import { apiError } from '../../../utils/apiErrorMessages'
import { emitContentChanged } from '../../../utils/sseManager'
import { groupSchema } from '../../../validation/catalog'
import { parseBody } from '../../../validation/common'

export default defineEventHandler(async (event) => {
  const body = parseBody(groupSchema, await readBody(event))

  try {
    const [created] = await db
      .insert(parliamentaryGroups)
      .values({ ...body, order: body.order ?? 0 })
      .returning()
    emitContentChanged('groups')
    return { data: created }
  } catch (error) {
    if ((error as { code?: string }).code === '23505') throw apiError(409, 'duplicateRecord')
    throw error
  }
})
