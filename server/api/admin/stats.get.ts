import { and, asc, count, eq, isNull, or } from 'drizzle-orm'
import { db } from '../../db'
import { committees, parliamentaryGroups, users, votes } from '../../db/schema'
import { getVoteStatus } from '~~/shared/utils/voteStatus'

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

  const incompleteDelegates = await db.query.users.findMany({
    where: and(
      eq(users.role, 'delegate'),
      eq(users.banned, false),
      or(isNull(users.committeeId), isNull(users.groupId))
    ),
    columns: { id: true, name: true, email: true, committeeId: true, groupId: true },
    orderBy: [asc(users.lastName), asc(users.firstName)],
  })

  const allVotes = await db.query.votes.findMany({
    with: { committee: true, options: true },
    orderBy: [asc(votes.order), asc(votes.createdAt)],
  })

  const describeVote = (vote: (typeof allVotes)[number]) => ({
    id: vote.id,
    name: vote.name,
    committee: vote.committee ? { name: vote.committee.name, slug: vote.committee.slug } : null,
    status: getVoteStatus(vote),
    options: vote.options.length,
    winnable: vote.options.filter((option) => option.canWin).length,
    allowChange: vote.allowChange,
    showLiveResults: vote.showLiveResults,
    visible: vote.visible,
    minimumVotes: vote.minimumVotes,
    maxWinners: vote.maxWinners,
  })

  const voteChecks = allVotes.map(describeVote)

  return {
    data: {
      users: usersTotal?.total ?? 0,
      suspended: usersSuspended?.total ?? 0,
      committees: committeesTotal?.total ?? 0,
      groups: groupsTotal?.total ?? 0,
      votes: votesTotal?.total ?? 0,
      openVotes: votesOpen?.total ?? 0,
      openVoteList: voteChecks.filter((vote) => vote.status === 'open'),
      pendingVoteList: voteChecks.filter((vote) => vote.status === 'pending'),
      incompleteDelegates,
      votesWithoutOptions: voteChecks.filter((v) => v.status !== 'closed' && v.options === 0),
      votesWithoutWinnable: voteChecks.filter(
        (v) => v.status !== 'closed' && v.options > 0 && v.winnable === 0
      ),
    },
  }
})
