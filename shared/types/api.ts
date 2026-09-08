export interface PublicGroup {
  id: string
  name: string
  abbreviation: string
  color: string
}

export interface PublicCommittee {
  id: string
  name: string
  slug: string
}

export interface PublicVoter {
  id: string
  name: string
  image: string | null
  group: PublicGroup | null
  committee: PublicCommittee | null
}

export interface VoteOption {
  id: string
  label: string
  color: string | null
  order: number
  canWin: boolean
}

export interface VoteResultsUser extends PublicVoter {
  optionId: string | null
  votedAt: string | null
}

export interface VoteResultsGroup {
  group: PublicGroup | null
  counts: Record<string, number>
  voted: number
  eligible: number
}

export interface VoteResultsOptionTotal {
  optionId: string
  count: number
}

export interface VoteSummary {
  id: string
  committeeId: string | null
  committee: PublicCommittee | null
  name: string
  description: string | null
  open: boolean
  visible: boolean
  allowChange: boolean
  showLiveResults: boolean
  startedAt: string | null
  endedAt: string | null
  order: number
  minimumVotes: number | null
  maxWinners: number | null
  options: VoteOption[]
  resultsVisible: boolean
  participation: { voted: number; eligible: number }
  totals: VoteResultsOptionTotal[]
  winnerIds: string[]
  thresholdReachedIds: string[]
}

export interface VoteWithResults extends VoteSummary {
  byGroup: VoteResultsGroup[]
  byUser: VoteResultsUser[]
  pendingUsers: PublicVoter[]
}

export interface VoteDetail extends VoteWithResults {
  myBallot: { optionId: string; updatedAt: string } | null
  canVote: boolean
}

export interface SessionUser {
  id: string
  email: string
  name: string
  firstName: string
  lastName: string
  image: string | null
  role: 'admin' | 'delegate'
  banned: boolean
  photoRemovedAt: string | Date | null
  committee: PublicCommittee | null
  group: PublicGroup | null
}

export interface AdminUser {
  id: string
  name: string
  firstName: string
  lastName: string
  email: string
  image: string | null
  role: 'admin' | 'delegate'
  banned: boolean
  photoRemovedAt: string | null
  committeeId: string | null
  groupId: string | null
  committee: PublicCommittee | null
  group: PublicGroup | null
  createdAt: string
}

export interface AdminCommittee {
  id: string
  name: string
  slug: string
  order: number
  members: number
  votes: number
}

export interface AdminGroup extends PublicGroup {
  order: number
  members: number
}

export interface CommitteeListItem {
  id: string | null
  name: string
  slug: string
  order?: number
  members: number
  votesTotal: number
  votesOpen: number
}

export interface OpenVoteItem {
  id: string
  name: string
  committeeId: string | null
  committee: PublicCommittee | null
  startedAt: string | null
}
