import { asc, desc } from 'drizzle-orm'
import { db } from '../../../db'
import { votes } from '../../../db/schema'
import { getVoteSummary } from '../../../utils/voteResults'

export default defineEventHandler(async () => {
  const rows = await db
    .select({ id: votes.id })
    .from(votes)
    .orderBy(desc(votes.open), asc(votes.order), desc(votes.createdAt))

  const summaries = await Promise.all(
    rows.map((row) => getVoteSummary(row.id, { includeHidden: true }))
  )

  return { data: summaries.filter((vote) => vote !== null) }
})
