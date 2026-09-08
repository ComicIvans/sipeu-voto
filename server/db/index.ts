import 'dotenv/config'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { requireConfigString } from '../../shared/utils/config'
import { logError } from '../utils/logger'
import * as schema from './schema'

const connectionString = requireConfigString(process.env.DATABASE_URL, 'DATABASE_URL')
const databaseTimeZone = process.env.TZ?.trim() || 'Atlantic/Canary'

export const databasePool = new Pool({
  connectionString,
  options: `-c statement_timeout=30000 -c timezone=${databaseTimeZone}`,
  max: 10,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 30_000,
})

let poolErrorCount = 0

databasePool.on('error', (error) => {
  poolErrorCount += 1
  logError('db.pool', error)
})

export function getDatabasePoolErrorCount() {
  return poolErrorCount
}

export const db = drizzle(databasePool, { schema })

export type Database = typeof db
