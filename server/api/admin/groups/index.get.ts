import { asc, count } from 'drizzle-orm'
import { db } from '../../../db'
import { parliamentaryGroups, users } from '../../../db/schema'

export default defineEventHandler(async () => {
  const rows = await db
    .select()
    .from(parliamentaryGroups)
    .orderBy(asc(parliamentaryGroups.order), asc(parliamentaryGroups.name))
  const memberCounts = await db
    .select({ groupId: users.groupId, total: count() })
    .from(users)
    .groupBy(users.groupId)

  return {
    data: rows.map((group) => ({
      ...group,
      members: memberCounts.find((row) => row.groupId === group.id)?.total ?? 0,
    })),
  }
})
