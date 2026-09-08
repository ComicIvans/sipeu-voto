import { eq } from 'drizzle-orm'
import { db } from '../../../../db'
import { committees } from '../../../../db/schema'
import { apiError } from '../../../../utils/apiErrorMessages'
import { clearEntityImage } from '../../../../utils/images'
import { emitContentChanged } from '../../../../utils/sseManager'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw apiError(400, 'requiredId')

  await clearEntityImage(() =>
    db.transaction(async (tx) => {
      const [current] = await tx
        .select({ cover: committees.cover })
        .from(committees)
        .where(eq(committees.id, id))
        .for('update')
      if (!current) throw apiError(404, 'committeeNotFound')
      await tx.update(committees).set({ cover: null }).where(eq(committees.id, id))
      return current.cover
    })
  )

  emitContentChanged('committees')
  return { data: { cover: null } }
})
