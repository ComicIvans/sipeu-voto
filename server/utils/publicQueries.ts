import { and, asc, count, desc, eq, isNull } from 'drizzle-orm'
import { db } from '../db'
import { committees, users, votes } from '../db/schema'
import { getSetting, PLENARY_COVER_KEY } from './settings'
import type { parliamentaryGroups } from '../db/schema'
import { PLENARY_SLUG } from '~~/shared/constants/routes'

export function toPublicCommittee(committee: typeof committees.$inferSelect) {
  return { id: committee.id, name: committee.name, slug: committee.slug, order: committee.order }
}

export function toPublicGroup(group: typeof parliamentaryGroups.$inferSelect) {
  return {
    id: group.id,
    name: group.name,
    abbreviation: group.abbreviation,
    color: group.color,
    logo: group.logo,
    order: group.order,
  }
}

export async function listCommitteesWithCounts() {
  const rows = await db
    .select()
    .from(committees)
    .orderBy(asc(committees.order), asc(committees.name))

  const memberCounts = await db
    .select({ committeeId: users.committeeId, total: count() })
    .from(users)
    .where(eq(users.banned, false))
    .groupBy(users.committeeId)

  const voteCounts = await db
    .select({ committeeId: votes.committeeId, open: votes.open, total: count() })
    .from(votes)
    .where(eq(votes.visible, true))
    .groupBy(votes.committeeId, votes.open)

  const summarize = (committeeId: string | null) => {
    const members = memberCounts.find((row) => row.committeeId === committeeId)?.total ?? 0
    const relevant = voteCounts.filter((row) => row.committeeId === committeeId)
    return {
      members,
      votesTotal: relevant.reduce((sum, row) => sum + row.total, 0),
      votesOpen: relevant.filter((row) => row.open).reduce((sum, row) => sum + row.total, 0),
    }
  }

  const plenaryMembers = memberCounts
    .filter((row) => row.committeeId !== null)
    .reduce((sum, row) => sum + row.total, 0)

  return {
    committees: rows.map((committee) => ({
      ...toPublicCommittee(committee),
      cover: committee.cover,
      ...summarize(committee.id),
    })),
    plenary: {
      id: null,
      name: 'Pleno',
      slug: PLENARY_SLUG,
      cover: await getSetting(PLENARY_COVER_KEY),
      ...summarize(null),
      members: plenaryMembers,
    },
  }
}

export async function findCommitteeBySlug(slug: string) {
  return db.query.committees.findFirst({ where: eq(committees.slug, slug) })
}

export async function listVisibleVoteIds(committeeId: string | null) {
  const rows = await db
    .select({ id: votes.id })
    .from(votes)
    .where(
      and(
        eq(votes.visible, true),
        committeeId ? eq(votes.committeeId, committeeId) : isNull(votes.committeeId)
      )
    )
    .orderBy(desc(votes.open), desc(votes.startedAt), desc(votes.createdAt))
  return rows.map((row) => row.id)
}
