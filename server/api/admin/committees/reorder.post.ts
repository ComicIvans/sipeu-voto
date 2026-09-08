import { count, eq, inArray } from 'drizzle-orm'
import { db } from '../../../db'
import { committees } from '../../../db/schema'
import { apiError } from '../../../utils/apiErrorMessages'
import { emitContentChanged } from '../../../utils/sseManager'
import { reorderSchema } from '../../../validation/catalog'
import { parseBody } from '../../../validation/common'

/**
 * Takes the whole ordering rather than the row that moved. A drag only means
 * anything against the list the admin was looking at, and a partial list would
 * renumber some rows while leaving the rest pointing at positions that no
 * longer exist.
 */
export default defineEventHandler(async (event) => {
  const { ids } = parseBody(reorderSchema, await readBody(event))
  if (new Set(ids).size !== ids.length) throw apiError(400, 'reorderMismatch')

  await db.transaction(async (tx) => {
    const found = await tx
      .select({ id: committees.id })
      .from(committees)
      .where(inArray(committees.id, ids))
      .for('update')
    const [totals] = await tx.select({ total: count() }).from(committees)
    if (found.length !== ids.length || (totals?.total ?? 0) !== ids.length) {
      throw apiError(400, 'reorderMismatch')
    }

    for (const [index, id] of ids.entries()) {
      await tx.update(committees).set({ order: index }).where(eq(committees.id, id))
    }
  })

  emitContentChanged('committees')
  return { data: { ids } }
})
