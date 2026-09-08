import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm'
import { db } from '../db'
import { users, voteOptions, votes } from '../db/schema'
import { calculateWinners } from '~~/shared/utils/winnerCalculation'
import { getVoteStatus } from '~~/shared/utils/voteStatus'
import type {
  PublicCommittee,
  PublicGroup,
  PublicVoter,
  VoteResultsGroup,
  VoteResultsUser,
  VoteWithResults,
} from '~~/shared/types/api'

type GroupRow = typeof import('../db/schema').parliamentaryGroups.$inferSelect
type CommitteeRow = typeof import('../db/schema').committees.$inferSelect

type UserRow = typeof users.$inferSelect & {
  group: GroupRow | null
  committee: CommitteeRow | null
}

function toPublicGroup(group: GroupRow | null): PublicGroup | null {
  return group
    ? { id: group.id, name: group.name, abbreviation: group.abbreviation, color: group.color }
    : null
}

function toPublicCommittee(committee: CommitteeRow | null): PublicCommittee | null {
  return committee ? { id: committee.id, name: committee.name, slug: committee.slug } : null
}

function toPublicVoter(user: UserRow): PublicVoter {
  return {
    id: user.id,
    name: user.name,
    image: user.image,
    group: toPublicGroup(user.group),
    committee: toPublicCommittee(user.committee),
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
 *
 * Ballots carry a snapshot of the voter's group and committee, so admin
 * corrections after the fact do not rewrite results. The census used for the
 * participation rate is "everyone eligible now, plus everyone who already
 * voted", which keeps the rate at or below 100% after suspensions or moves.
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
      ballots: { with: { group: true, committee: true } },
    },
  })

  if (!vote) return null

  const eligibleVoters = await getEligibleVoters(vote.committeeId)
  const eligibleById = new Map(eligibleVoters.map((user) => [user.id, user]))

  const missingVoterIds = vote.ballots
    .map((ballot) => ballot.userId)
    .filter((userId) => !eligibleById.has(userId))
  const extraVoters =
    missingVoterIds.length > 0
      ? await db.query.users.findMany({
          where: inArray(users.id, missingVoterIds),
          with: { group: true, committee: true },
        })
      : []
  const usersById = new Map<string, UserRow>(
    [...eligibleVoters, ...extraVoters].map((user) => [user.id, user])
  )

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
    ? {
        winnerIds: new Set<string>(),
        tiedIds: new Set<string>(),
        thresholdReachedIds: new Set<string>(),
      }
    : calculateWinners(
        vote.options.map((option) => ({
          id: option.id,
          count: countsByOption.get(option.id) ?? 0,
          canWin: option.canWin,
        })),
        vote.minimumVotes,
        vote.maxWinners
      )
  const winnerIds = [...winners.winnerIds]
  const tiedOptionIds = [...winners.tiedIds]

  // Voters: current identity, affiliation frozen at ballot time. A null
  // snapshot means "voted without group/committee", never "use the current
  // one": migration 0001 backfilled every ballot cast before the snapshot
  // existed, and the foreign keys are RESTRICT so a snapshot cannot be erased.
  const byUser: VoteResultsUser[] = []
  const votedUserIds = new Set<string>()
  for (const ballot of vote.ballots) {
    const user = usersById.get(ballot.userId)
    if (!user) continue
    votedUserIds.add(ballot.userId)
    byUser.push({
      id: user.id,
      name: user.name,
      image: user.image,
      group: toPublicGroup(ballot.group),
      committee: toPublicCommittee(ballot.committee),
      optionId: resultsVisible ? ballot.optionId : null,
      votedAt: ballot.updatedAt.toISOString(),
    })
  }
  byUser.sort(compareVoters)

  const pendingUsers: PublicVoter[] = eligibleVoters
    .filter((user) => !votedUserIds.has(user.id))
    .map(toPublicVoter)
    .sort(compareVoters)

  const census = new Set<string>([...eligibleVoters.map((user) => user.id), ...votedUserIds])

  // Per group: voters counted under their snapshot group, pending under their current one.
  const groupsMap = new Map<string, VoteResultsGroup>()
  const ensureGroup = (group: PublicGroup | null) => {
    const key = group?.id ?? '__none__'
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

  for (const voter of byUser) {
    const entry = ensureGroup(voter.group)
    entry.voted += 1
    entry.eligible += 1
    if (resultsVisible && voter.optionId) {
      entry.counts[voter.optionId] = (entry.counts[voter.optionId] ?? 0) + 1
    }
  }
  for (const pending of pendingUsers) {
    ensureGroup(pending.group).eligible += 1
  }

  const byGroup = [...groupsMap.values()].sort((a, b) => {
    if (!a.group) return 1
    if (!b.group) return -1
    return a.group.name.localeCompare(b.group.name, 'es')
  })

  return {
    id: vote.id,
    committeeId: vote.committeeId,
    committee: toPublicCommittee(vote.committee),
    name: vote.name,
    description: vote.description,
    status: getVoteStatus(vote),
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
    locked: vote.open || vote.ballots.length > 0,
    ballotCount: vote.ballots.length,
    resultsVisible,
    participation: { voted: vote.ballots.length, eligible: census.size },
    totals: resultsVisible ? totals : [],
    winnerIds: resultsVisible ? winnerIds : [],
    tiedOptionIds: resultsVisible ? tiedOptionIds : [],
    thresholdReachedIds: resultsVisible ? [...winners.thresholdReachedIds] : [],
    tie: resultsVisible ? tiedOptionIds.length > 0 : false,
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
