import { eq } from 'drizzle-orm'
import { db } from '../../../../db'
import { committees } from '../../../../db/schema'
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
    .select({ id: committees.id })
    .from(committees)
    .where(eq(committees.id, id))
  if (!target) throw apiError(404, 'committeeNotFound')

  const cover = await replaceEntityImage({
    kind: IMAGE_KINDS.cover,
    ownerId: id,
    data: file.data,
    context: `committee:${id}`,
    apply: (path) =>
      db.transaction(async (tx) => {
        const [current] = await tx
          .select({ cover: committees.cover })
          .from(committees)
          .where(eq(committees.id, id))
          .for('update')
        if (!current) throw apiError(404, 'committeeNotFound')
        await tx.update(committees).set({ cover: path }).where(eq(committees.id, id))
        return current.cover
      }),
  })

  emitContentChanged('committees')
  return { data: { cover } }
})
