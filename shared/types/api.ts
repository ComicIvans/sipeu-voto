import type { VoteStatus } from '../utils/voteStatus'

export interface PublicGroup {
  id: string
  name: string
  abbreviation: string
  color: string
  /** Public path of the logo, or null when the group has none. */
  logo: string | null
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

// `VoteStatus` lives in shared/utils/voteStatus.ts next to the logic that derives it.

export interface VoteSummary {
  id: string
  committeeId: string | null
  committee: PublicCommittee | null
  name: string
  description: string | null
  status: VoteStatus
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
  /** Open or already has ballots: conditions cannot change any more. */
  locked: boolean
  ballotCount: number
  resultsVisible: boolean
  /** `eligible` is the census: people eligible now plus everyone who already voted. */
  participation: { voted: number; eligible: number }
  totals: VoteResultsOptionTotal[]
  /** Options that definitely won. Never contains an option that is still tied. */
  winnerIds: string[]
  /** Options tied for the seats left over; none of them has won. */
  tiedOptionIds: string[]
  thresholdReachedIds: string[]
  /** Shorthand for `tiedOptionIds.length > 0`: some seat is still undecided. */
  tie: boolean
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
  /** Public path of the 16:9 cover, or null when the committee has none. */
  cover: string | null
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
  /**
   * Cover of this committee, or of the plenary session when `id` is null.
   * Deliberately absent from `PublicCommittee`, which travels inside every
   * vote payload and is never rendered with an image.
   */
  cover: string | null
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
