import { eq } from 'drizzle-orm'
import { db } from '../../../../db'
import { users } from '../../../../db/schema'
import { apiError } from '../../../../utils/apiErrorMessages'
import { findAdminUser } from '../../../../utils/adminUsers'
import { emitContentChanged } from '../../../../utils/sseManager'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw apiError(400, 'requiredId')

  const [updated] = await db
    .update(users)
    .set({ banned: false, banReason: null, banExpires: null })
    .where(eq(users.id, id))
    .returning()
  if (!updated) throw apiError(404, 'userNotFound')

  emitContentChanged('users')
  return { data: await findAdminUser(id) }
})
