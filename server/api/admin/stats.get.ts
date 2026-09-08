import { count, eq } from 'drizzle-orm'
import { db } from '../../db'
import { committees, parliamentaryGroups, users, votes } from '../../db/schema'

export default defineEventHandler(async () => {
  const [
    [usersTotal],
    [usersSuspended],
    [committeesTotal],
    [groupsTotal],
    [votesTotal],
    [votesOpen],
  ] = await Promise.all([
    db.select({ total: count() }).from(users),
    db.select({ total: count() }).from(users).where(eq(users.banned, true)),
    db.select({ total: count() }).from(committees),
    db.select({ total: count() }).from(parliamentaryGroups),
    db.select({ total: count() }).from(votes),
    db.select({ total: count() }).from(votes).where(eq(votes.open, true)),
  ])

  const openVotes = await db.query.votes.findMany({
    where: eq(votes.open, true),
    with: { committee: true },
  })

  return {
    data: {
      users: usersTotal?.total ?? 0,
      suspended: usersSuspended?.total ?? 0,
      committees: committeesTotal?.total ?? 0,
      groups: groupsTotal?.total ?? 0,
      votes: votesTotal?.total ?? 0,
      openVotes: votesOpen?.total ?? 0,
      openVoteList: openVotes.map((vote) => ({
        id: vote.id,
        name: vote.name,
        committee: vote.committee ? { name: vote.committee.name, slug: vote.committee.slug } : null,
      })),
    },
  }
})
