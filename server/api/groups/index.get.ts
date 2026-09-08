import { asc } from 'drizzle-orm'
import { db } from '../../db'
import { parliamentaryGroups } from '../../db/schema'
import { toPublicGroup } from '../../utils/publicQueries'

export default defineEventHandler(async () => {
  const rows = await db
    .select()
    .from(parliamentaryGroups)
    .orderBy(asc(parliamentaryGroups.order), asc(parliamentaryGroups.name))
  return { data: rows.map(toPublicGroup) }
})
