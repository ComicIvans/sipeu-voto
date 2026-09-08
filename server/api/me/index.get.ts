import { requireUser } from '../../utils/requireAuth'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const user = await requireUser(event)
  return { data: user }
})
