import { db } from '../../../db'
import { committees } from '../../../db/schema'
import { apiError } from '../../../utils/apiErrorMessages'
import { emitContentChanged } from '../../../utils/sseManager'
import { committeeSchema } from '../../../validation/catalog'
import { parseBody } from '../../../validation/common'
import { slugify } from '~~/shared/utils/names'
import { PLENARY_SLUG } from '~~/shared/constants/routes'

export default defineEventHandler(async (event) => {
  const body = parseBody(committeeSchema, await readBody(event))
  const slug = body.slug ?? slugify(body.name)
  if (!slug || slug === PLENARY_SLUG) throw apiError(400, 'reservedSlug')

  try {
    const [created] = await db
      .insert(committees)
      .values({ name: body.name, slug, order: body.order ?? 0 })
      .returning()
    emitContentChanged('committees')
    return { data: created }
  } catch (error) {
    if ((error as { code?: string }).code === '23505') throw apiError(409, 'duplicateRecord')
    throw error
  }
})
