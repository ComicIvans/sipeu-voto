import { count, eq, inArray } from 'drizzle-orm'
import { db } from '../../../db'
import { parliamentaryGroups } from '../../../db/schema'
import { apiError } from '../../../utils/apiErrorMessages'
import { emitContentChanged } from '../../../utils/sseManager'
import { reorderSchema } from '../../../validation/catalog'
import { parseBody } from '../../../validation/common'

/** See `committees/reorder.post.ts`: the whole ordering, or nothing. */
export default defineEventHandler(async (event) => {
  const { ids } = parseBody(reorderSchema, await readBody(event))
  if (new Set(ids).size !== ids.length) throw apiError(400, 'reorderMismatch')

  await db.transaction(async (tx) => {
    const found = await tx
      .select({ id: parliamentaryGroups.id })
      .from(parliamentaryGroups)
      .where(inArray(parliamentaryGroups.id, ids))
      .for('update')
    const [totals] = await tx.select({ total: count() }).from(parliamentaryGroups)
    if (found.length !== ids.length || (totals?.total ?? 0) !== ids.length) {
      throw apiError(400, 'reorderMismatch')
    }

    for (const [index, id] of ids.entries()) {
      await tx
        .update(parliamentaryGroups)
        .set({ order: index })
        .where(eq(parliamentaryGroups.id, id))
    }
  })

  emitContentChanged('groups')
  return { data: { ids } }
})
