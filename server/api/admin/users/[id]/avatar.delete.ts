import { eq } from 'drizzle-orm'
import { db } from '../../../../db'
import { users } from '../../../../db/schema'
import { apiError } from '../../../../utils/apiErrorMessages'
import { findAdminUser } from '../../../../utils/adminUsers'
import { clearEntityImage } from '../../../../utils/images'
import { emitContentChanged } from '../../../../utils/sseManager'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw apiError(400, 'requiredId')

  await clearEntityImage(
    () =>
      db.transaction(async (tx) => {
        const [current] = await tx
          .select({ image: users.image })
          .from(users)
          .where(eq(users.id, id))
          .for('update')
        if (!current) throw apiError(404, 'userNotFound')
        await tx
          .update(users)
          .set({ image: null, photoRemovedAt: new Date() })
          .where(eq(users.id, id))
        return current.image
      }),
    `user:${id}`
  )

  emitContentChanged('users')
  return { data: await findAdminUser(id) }
})
