import { asc, count } from 'drizzle-orm'
import { db } from '../../../db'
import { committees, users, votes } from '../../../db/schema'

export default defineEventHandler(async () => {
  const rows = await db
    .select()
    .from(committees)
    .orderBy(asc(committees.order), asc(committees.name))
  const memberCounts = await db
    .select({ committeeId: users.committeeId, total: count() })
    .from(users)
    .groupBy(users.committeeId)
  const voteCounts = await db
    .select({ committeeId: votes.committeeId, total: count() })
    .from(votes)
    .groupBy(votes.committeeId)

  return {
    data: rows.map((committee) => ({
      ...committee,
      members: memberCounts.find((row) => row.committeeId === committee.id)?.total ?? 0,
      votes: voteCounts.find((row) => row.committeeId === committee.id)?.total ?? 0,
    })),
  }
})
