import { PLENARY_FIRST_KEY, setSetting } from '../../../utils/settings'
import { emitContentChanged } from '../../../utils/sseManager'
import { plenaryPositionSchema } from '../../../validation/catalog'
import { parseBody } from '../../../validation/common'

/**
 * The plenary is not a committee and has no `order` to reorder. It sits either
 * above every committee or below every one of them, never among them, so its
 * position is this one flag rather than a place in the committees list.
 */
export default defineEventHandler(async (event) => {
  const { first } = parseBody(plenaryPositionSchema, await readBody(event))
  await setSetting(PLENARY_FIRST_KEY, first ? 'true' : 'false')
  emitContentChanged('committees')
  return { data: { first } }
})
