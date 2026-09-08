import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { users } from '../../db/schema'
import { deleteAvatarFile } from '../../utils/avatars'
import { requireUser } from '../../utils/requireAuth'
import { emitContentChanged } from '../../utils/sseManager'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await deleteAvatarFile(user.image)
  await db.update(users).set({ image: null }).where(eq(users.id, user.id))
  emitContentChanged('users')
  return { data: { image: null } }
})
