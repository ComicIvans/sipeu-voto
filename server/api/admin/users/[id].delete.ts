import { count, eq } from 'drizzle-orm'
import { db } from '../../../db'
import { ballots, users } from '../../../db/schema'
import { apiError } from '../../../utils/apiErrorMessages'
import { discardEntityImage } from '../../../utils/images'
import { requireAdmin } from '../../../utils/requireAuth'
import { emitContentChanged } from '../../../utils/sseManager'

/**
 * Deleting a user cascades to their ballots, so the "has ballots" check and the
 * delete run in one transaction that first locks the user row FOR UPDATE. The
 * ballot endpoint locks the same row FOR SHARE before inserting, so a ballot
 * being cast right now either lands before this lock (and the delete is
 * rejected) or after it (and finds no user).
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw apiError(400, 'requiredId')
  const admin = await requireAdmin(event)
  if (id === admin.id) throw apiError(409, 'cannotDeleteSelf')

  const deleted = await db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, id))
      .for('update')
    if (!locked) throw apiError(404, 'userNotFound')

    const [usage] = await tx.select({ total: count() }).from(ballots).where(eq(ballots.userId, id))
    if ((usage?.total ?? 0) > 0) throw apiError(409, 'userHasBallots')

    const [row] = await tx.delete(users).where(eq(users.id, id)).returning()
    if (!row) throw apiError(404, 'userNotFound')
    return row
  })

  await discardEntityImage(deleted.image, `user:${id}`)

  emitContentChanged('users')
  return { data: { id } }
})
