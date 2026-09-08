import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { users } from '../../db/schema'
import { apiError } from '../../utils/apiErrorMessages'
import { clearEntityImage } from '../../utils/images'
import { requireUser } from '../../utils/requireAuth'
import { emitContentChanged } from '../../utils/sseManager'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  await clearEntityImage(() =>
    db.transaction(async (tx) => {
      const [current] = await tx
        .select({ image: users.image })
        .from(users)
        .where(eq(users.id, user.id))
        .for('update')
      if (!current) throw apiError(404, 'userNotFound')
      await tx.update(users).set({ image: null }).where(eq(users.id, user.id))
      return current.image
    })
  )

  emitContentChanged('users')
  return { data: { image: null } }
})
