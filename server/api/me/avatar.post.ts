import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { users } from '../../db/schema'
import { apiError } from '../../utils/apiErrorMessages'
import { deleteAvatarFile, saveAvatarImage } from '../../utils/avatars'
import { requireUser } from '../../utils/requireAuth'
import { emitContentChanged } from '../../utils/sseManager'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  const parts = await readMultipartFormData(event)
  const file = parts?.find((part) => part.name === 'file' && part.data?.length)
  if (!file) throw apiError(400, 'avatarMissingFile')

  const publicPath = await saveAvatarImage(user.id, file.data, file.filename ?? 'avatar')
  await deleteAvatarFile(user.image)

  await db
    .update(users)
    .set({ image: publicPath, photoRemovedAt: null })
    .where(eq(users.id, user.id))

  emitContentChanged('users')

  return { data: { image: publicPath } }
})
