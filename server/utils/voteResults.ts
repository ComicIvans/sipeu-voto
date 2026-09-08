import { and, asc, eq, isNotNull, or } from 'drizzle-orm'
import { db } from '../db'
import { users, voteOptions, votes } from '../db/schema'
import { calculateWinners } from '~~/shared/utils/winnerCalculation'
import type {
  PublicGroup,
  PublicVoter,
  VoteResultsGroup,
  VoteResultsUser,
  VoteWithResults,
} from '~~/shared/types/api'

type UserRow = typeof users.$inferSelect & {
  group: PublicGroup | null
  committee: PublicCommittee | null
}

function toPublicVoter(user: UserRow): PublicVoter {
  return {
    id: user.id,
    name: user.name,
    image: user.image,
    group: user.group
      ? {
          id: user.group.id,
          name: user.group.name,
          abbreviation: user.group.abbreviation,
          color: user.group.color,
        }
      : null,
    committee: user.committee
      ? { id: user.committee.id, name: user.committee.name, slug: user.committee.slug }
      : null,
  }
}

function compareVoters(a: PublicVoter, b: PublicVoter) {
  const groupA = a.group?.name ?? '￿'
  const groupB = b.group?.name ?? '￿'
  if (groupA !== groupB) return groupA.localeCompare(groupB, 'es')
  return a.name.localeCompare(b.name, 'es')
}

export async function getEligibleVoters(committeeId: string | null) {
  return db.query.users.findMany({
    where: and(
      eq(users.banned, false),
      isNotNull(users.committeeId),
      committeeId ? eq(users.committeeId, committeeId) : undefined
    ),
    with: { group: true, committee: true },
  })
}

export function isUserEligible(
  user: { banned: boolean; committee: { id: string } | null },
  vote: { committeeId: string | null }
) {
  if (user.banned || !user.committee) return false
  return vote.committeeId === null || vote.committeeId === user.committee.id
}

/**
 * Loads a vote with its options, participation and results.
 * `includeHidden` bypasses the "results only after close" setting (admins).
 */
export async function getVoteWithResults(
  voteId: string,
  { includeHidden = false }: { includeHidden?: boolean } = {}
): Promise<VoteWithResults | null> {
  const vote = await db.query.votes.findFirst({
    where: eq(votes.id, voteId),
    with: {
      committee: true,
      options: { orderBy: [asc(voteOptions.order), asc(voteOptions.createdAt)] },
      ballots: true,
    },
  })

  if (!vote) return null

  const eligibleVoters = await getEligibleVoters(vote.committeeId)
  const eligibleById = new Map(eligibleVoters.map((user) => [user.id, user]))

  // Ballots from users who are no longer eligible (suspended, moved) still count as cast
  // votes, so load their profiles too.
  const missingVoterIds = vote.ballots
    .map((ballot) => ballot.userId)
    .filter((userId) => !eligibleById.has(userId))
  const extraVoters =
    missingVoterIds.length > 0
      ? await db.query.users.findMany({
          where: or(...missingVoterIds.map((id) => eq(users.id, id))),
          with: { group: true, committee: true },
        })
      : []
  const votersById = new Map<string, UserRow>([
    ...eligibleVoters.map((user) => [user.id, user] as const),
    ...extraVoters.map((user) => [user.id, user] as const),
  ])

  const resultsVisible = includeHidden || !vote.open || vote.showLiveResults

  const countsByOption = new Map<string, number>(vote.options.map((option) => [option.id, 0]))
  for (const ballot of vote.ballots) {
    countsByOption.set(ballot.optionId, (countsByOption.get(ballot.optionId) ?? 0) + 1)
  }

  const totals = vote.options.map((option) => ({
    optionId: option.id,
    count: countsByOption.get(option.id) ?? 0,
  }))

  const winners = vote.open
    ? { winnerIds: new Set<string>(), thresholdReachedIds: new Set<string>() }
    : calculateWinners(
        vote.options.map((option) => ({
          id: option.id,
          count: countsByOption.get(option.id) ?? 0,
          canWin: option.canWin,
        })),
        vote.minimumVotes,
        vote.maxWinners
      )

  const ballotByUser = new Map(vote.ballots.map((ballot) => [ballot.userId, ballot]))

  const byUser: VoteResultsUser[] = []
  for (const ballot of vote.ballots) {
    const user = votersById.get(ballot.userId)
    if (!user) continue
    byUser.push({
      ...toPublicVoter(user),
      optionId: resultsVisible ? ballot.optionId : null,
      votedAt: ballot.updatedAt.toISOString(),
    })
  }
  byUser.sort(compareVoters)

  const pendingUsers: PublicVoter[] = eligibleVoters
    .filter((user) => !ballotByUser.has(user.id))
    .map(toPublicVoter)
    .sort(compareVoters)

  const groupsMap = new Map<string, VoteResultsGroup>()
  const groupKey = (group: PublicGroup | null) => group?.id ?? '__none__'

  const ensureGroup = (group: PublicGroup | null) => {
    const key = groupKey(group)
    let entry = groupsMap.get(key)
    if (!entry) {
      entry = {
        group,
        counts: Object.fromEntries(vote.options.map((option) => [option.id, 0])),
        voted: 0,
        eligible: 0,
      }
      groupsMap.set(key, entry)
    }
    return entry
  }

  for (const user of eligibleVoters) {
    const voter = toPublicVoter(user)
    ensureGroup(voter.group).eligible += 1
  }

  for (const ballot of vote.ballots) {
    const user = votersById.get(ballot.userId)
    if (!user) continue
    const entry = ensureGroup(toPublicVoter(user).group)
    entry.voted += 1
    if (resultsVisible) {
      entry.counts[ballot.optionId] = (entry.counts[ballot.optionId] ?? 0) + 1
    }
  }

  const byGroup = [...groupsMap.values()].sort((a, b) => {
    if (!a.group) return 1
    if (!b.group) return -1
    return a.group.name.localeCompare(b.group.name, 'es')
  })

  return {
    id: vote.id,
    committeeId: vote.committeeId,
    committee: vote.committee
      ? { id: vote.committee.id, name: vote.committee.name, slug: vote.committee.slug }
      : null,
    name: vote.name,
    description: vote.description,
    open: vote.open,
    visible: vote.visible,
    allowChange: vote.allowChange,
    showLiveResults: vote.showLiveResults,
    startedAt: vote.startedAt?.toISOString() ?? null,
    endedAt: vote.endedAt?.toISOString() ?? null,
    order: vote.order,
    minimumVotes: vote.minimumVotes,
    maxWinners: vote.maxWinners,
    options: vote.options.map((option) => ({
      id: option.id,
      label: option.label,
      color: option.color,
      order: option.order,
      canWin: option.canWin,
    })),
    resultsVisible,
    participation: { voted: vote.ballots.length, eligible: eligibleVoters.length },
    totals: resultsVisible ? totals : [],
    winnerIds: resultsVisible ? [...winners.winnerIds] : [],
    thresholdReachedIds: resultsVisible ? [...winners.thresholdReachedIds] : [],
    byGroup,
    byUser,
    pendingUsers,
  }
}

/** Compact summary for list views (no per-user breakdown). */
export async function getVoteSummary(voteId: string, options?: { includeHidden?: boolean }) {
  const full = await getVoteWithResults(voteId, options)
  if (!full) return null
  const { byUser: _byUser, pendingUsers: _pendingUsers, byGroup: _byGroup, ...summary } = full
  return summary
}
