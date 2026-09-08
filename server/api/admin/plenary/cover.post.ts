import { eq } from 'drizzle-orm'
import { db } from '../../../db'
import { appSettings } from '../../../db/schema'
import { apiError } from '../../../utils/apiErrorMessages'
import { IMAGE_KINDS, replaceEntityImage } from '../../../utils/images'
import { PLENARY_COVER_KEY } from '../../../utils/settings'
import { emitContentChanged } from '../../../utils/sseManager'

/** The plenary has no committees row, so its cover lives in app_settings. */
export default defineEventHandler(async (event) => {
  const parts = await readMultipartFormData(event)
  const file = parts?.find((part) => part.name === 'file' && part.data?.length)
  if (!file) throw apiError(400, 'imageMissingFile')

  const cover = await replaceEntityImage({
    kind: IMAGE_KINDS.cover,
    ownerId: 'pleno',
    data: file.data,
    context: 'plenary',
    apply: (path) =>
      db.transaction(async (tx) => {
        const [current] = await tx
          .select({ value: appSettings.value })
          .from(appSettings)
          .where(eq(appSettings.key, PLENARY_COVER_KEY))
          .for('update')
        await tx
          .insert(appSettings)
          .values({ key: PLENARY_COVER_KEY, value: path })
          .onConflictDoUpdate({ target: appSettings.key, set: { value: path } })
        return current?.value ?? null
      }),
  })

  emitContentChanged('committees')
  return { data: { cover } }
})
