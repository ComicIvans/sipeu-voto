import { desc, eq } from 'drizzle-orm'
import { db } from '../../db'
import { votes } from '../../db/schema'

export default defineEventHandler(async () => {
  const rows = await db.query.votes.findMany({
    where: eq(votes.open, true),
    with: { committee: true },
    orderBy: [desc(votes.startedAt)],
  })

  return {
    data: rows
      .filter((vote) => vote.visible)
      .map((vote) => ({
        id: vote.id,
        name: vote.name,
        committeeId: vote.committeeId,
        committee: vote.committee
          ? { id: vote.committee.id, name: vote.committee.name, slug: vote.committee.slug }
          : null,
        startedAt: vote.startedAt?.toISOString() ?? null,
      })),
  }
})
