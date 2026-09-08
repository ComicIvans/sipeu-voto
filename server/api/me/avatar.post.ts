import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { users } from '../../db/schema'
import { apiError } from '../../utils/apiErrorMessages'
import { IMAGE_KINDS, replaceEntityImage } from '../../utils/images'
import { requireUser } from '../../utils/requireAuth'
import { emitContentChanged } from '../../utils/sseManager'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  const parts = await readMultipartFormData(event)
  const file = parts?.find((part) => part.name === 'file' && part.data?.length)
  if (!file) throw apiError(400, 'imageMissingFile')

  const publicPath = await replaceEntityImage({
    kind: IMAGE_KINDS.avatar,
    ownerId: user.id,
    data: file.data,
    context: `user:${user.id}`,
    apply: (path) =>
      db.transaction(async (tx) => {
        const [current] = await tx
          .select({ image: users.image })
          .from(users)
          .where(eq(users.id, user.id))
          .for('update')
        if (!current) throw apiError(404, 'userNotFound')
        await tx
          .update(users)
          .set({ image: path, photoRemovedAt: null })
          .where(eq(users.id, user.id))
        return current.image
      }),
  })

  emitContentChanged('users')

  return { data: { image: publicPath } }
})
