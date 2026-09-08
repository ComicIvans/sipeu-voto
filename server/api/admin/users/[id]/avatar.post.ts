import { eq } from 'drizzle-orm'
import { db } from '../../../../db'
import { users } from '../../../../db/schema'
import { apiError } from '../../../../utils/apiErrorMessages'
import { findAdminUser } from '../../../../utils/adminUsers'
import { IMAGE_KINDS, replaceEntityImage } from '../../../../utils/images'
import { emitContentChanged } from '../../../../utils/sseManager'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw apiError(400, 'requiredId')

  const parts = await readMultipartFormData(event)
  const file = parts?.find((part) => part.name === 'file' && part.data?.length)
  if (!file) throw apiError(400, 'imageMissingFile')

  // Cheap existence check first: resizing and writing a file for a row that is
  // not there wastes the work and turns a 404 into whatever the write fails
  // with. The transaction below re-checks under a lock.
  const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, id))
  if (!target) throw apiError(404, 'userNotFound')

  await replaceEntityImage({
    kind: IMAGE_KINDS.avatar,
    ownerId: id,
    data: file.data,
    context: `user:${id}`,
    apply: (path) =>
      db.transaction(async (tx) => {
        const [current] = await tx
          .select({ image: users.image })
          .from(users)
          .where(eq(users.id, id))
          .for('update')
        if (!current) throw apiError(404, 'userNotFound')
        // Clearing photoRemovedAt retires the "an admin removed your photo"
        // notice on the profile page: they no longer need to upload one.
        await tx.update(users).set({ image: path, photoRemovedAt: null }).where(eq(users.id, id))
        return current.image
      }),
  })

  emitContentChanged('users')
  return { data: await findAdminUser(id) }
})
