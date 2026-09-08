import { getRequestHeader } from 'h3'
import { databasePool } from '../db'

const LOOPBACK = /^(127\.\d+\.\d+\.\d+|::1|::ffff:127\.\d+\.\d+\.\d+)$/

/**
 * Health check for Docker/NGINX-local probes. Requests proxied from the
 * outside carry a non-loopback X-Forwarded-For and get a 404, so the
 * endpoint is never reachable through the public proxy.
 */
export default defineEventHandler(async (event) => {
  const forwardedFor = getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
  if (forwardedFor && !LOOPBACK.test(forwardedFor)) {
    throw createError({ statusCode: 404, message: 'Not found' })
  }

  let database: 'ok' | 'error' = 'ok'
  try {
    await Promise.race([
      databasePool.query('SELECT 1'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ])
  } catch {
    database = 'error'
  }

  const status = database === 'ok' ? 'ok' : 'error'
  setResponseStatus(event, status === 'ok' ? 200 : 503)

  return { status, timestamp: new Date().toISOString(), checks: { database } }
})
