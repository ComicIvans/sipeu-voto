import { eq } from 'drizzle-orm'
import { db } from '../../../../db'
import { parliamentaryGroups } from '../../../../db/schema'
import { apiError } from '../../../../utils/apiErrorMessages'
import { clearEntityImage } from '../../../../utils/images'
import { emitContentChanged } from '../../../../utils/sseManager'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw apiError(400, 'requiredId')

  await clearEntityImage(() =>
    db.transaction(async (tx) => {
      const [current] = await tx
        .select({ logo: parliamentaryGroups.logo })
        .from(parliamentaryGroups)
        .where(eq(parliamentaryGroups.id, id))
        .for('update')
      if (!current) throw apiError(404, 'groupNotFound')
      await tx.update(parliamentaryGroups).set({ logo: null }).where(eq(parliamentaryGroups.id, id))
      return current.logo
    })
  )

  emitContentChanged('groups')
  return { data: { logo: null } }
})
