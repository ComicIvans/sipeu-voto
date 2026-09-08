import { getRequestHeader } from 'h3'
import { getDatabasePoolErrorCount } from '../db'

export default defineEventHandler(async (event) => {
  if (getRequestHeader(event, 'x-forwarded-for')) {
    throw createError({ statusCode: 404, message: 'Not found' })
  }

  const status = getDatabasePoolErrorCount() > 0 ? 'error' : 'ok'
  setResponseStatus(event, status === 'error' ? 503 : 200)

  return { status, timestamp: new Date().toISOString() }
})
