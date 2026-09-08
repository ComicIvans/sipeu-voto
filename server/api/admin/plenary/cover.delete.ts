import { eq } from 'drizzle-orm'
import { db } from '../../../db'
import { appSettings } from '../../../db/schema'
import { clearEntityImage } from '../../../utils/images'
import { PLENARY_COVER_KEY } from '../../../utils/settings'
import { emitContentChanged } from '../../../utils/sseManager'

export default defineEventHandler(async () => {
  await clearEntityImage(
    () =>
      db.transaction(async (tx) => {
        const [current] = await tx
          .select({ value: appSettings.value })
          .from(appSettings)
          .where(eq(appSettings.key, PLENARY_COVER_KEY))
          .for('update')
        if (!current) return null
        await tx.delete(appSettings).where(eq(appSettings.key, PLENARY_COVER_KEY))
        return current.value
      }),
    'plenary'
  )

  emitContentChanged('committees')
  return { data: { cover: null } }
})
