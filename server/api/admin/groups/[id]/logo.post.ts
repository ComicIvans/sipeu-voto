import { eq } from 'drizzle-orm'
import { db } from '../../../../db'
import { parliamentaryGroups } from '../../../../db/schema'
import { apiError } from '../../../../utils/apiErrorMessages'
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
  const [target] = await db
    .select({ id: parliamentaryGroups.id })
    .from(parliamentaryGroups)
    .where(eq(parliamentaryGroups.id, id))
  if (!target) throw apiError(404, 'groupNotFound')

  const logo = await replaceEntityImage({
    kind: IMAGE_KINDS.logo,
    ownerId: id,
    data: file.data,
    context: `group:${id}`,
    apply: (path) =>
      db.transaction(async (tx) => {
        const [current] = await tx
          .select({ logo: parliamentaryGroups.logo })
          .from(parliamentaryGroups)
          .where(eq(parliamentaryGroups.id, id))
          .for('update')
        if (!current) throw apiError(404, 'groupNotFound')
        await tx
          .update(parliamentaryGroups)
          .set({ logo: path })
          .where(eq(parliamentaryGroups.id, id))
        return current.logo
      }),
  })

  emitContentChanged('groups')
  return { data: { logo } }
})
