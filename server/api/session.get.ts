import { getOptionalUser } from '../utils/requireAuth'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const user = await getOptionalUser(event)
  return { data: user }
})
