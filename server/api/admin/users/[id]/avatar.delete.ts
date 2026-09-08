import { eq } from 'drizzle-orm'
import { db } from '../../../../db'
import { users } from '../../../../db/schema'
import { apiError } from '../../../../utils/apiErrorMessages'
import { findAdminUser } from '../../../../utils/adminUsers'
import { deleteAvatarFile } from '../../../../utils/avatars'
import { emitContentChanged } from '../../../../utils/sseManager'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw apiError(400, 'requiredId')

  const current = await db.query.users.findFirst({ where: eq(users.id, id) })
  if (!current) throw apiError(404, 'userNotFound')

  await deleteAvatarFile(current.image)
  await db.update(users).set({ image: null, photoRemovedAt: new Date() }).where(eq(users.id, id))

  emitContentChanged('users')
  return { data: await findAdminUser(id) }
})
