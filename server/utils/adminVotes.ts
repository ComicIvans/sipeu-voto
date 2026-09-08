import { count, eq } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import { db } from '../db'
import { ballots, votes } from '../db/schema'
import { apiError } from './apiErrorMessages'

export type VoteRow = typeof votes.$inferSelect

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = PgTransaction<any, any, any>

export async function requireVote(id: string) {
  const vote = await db.query.votes.findFirst({ where: eq(votes.id, id) })
  if (!vote) throw apiError(404, 'voteNotFound')
  return vote
}

/** Locks the vote row for the rest of the transaction (serialises with ballots). */
export async function lockVote(tx: Tx, id: string): Promise<VoteRow> {
  const [vote] = await tx.select().from(votes).where(eq(votes.id, id)).for('update')
  if (!vote) throw apiError(404, 'voteNotFound')
  return vote
}

export async function countBallots(id: string, tx: Tx | typeof db = db) {
  const [row] = await tx.select({ total: count() }).from(ballots).where(eq(ballots.voteId, id))
  return row?.total ?? 0
}

/**
 * Fields that define what a ballot means. They are frozen while the vote is
 * open and once any ballot exists; duplicate the vote to run it under other
 * conditions, or clear its ballots.
 */
export const LOCKED_VOTE_FIELDS = [
  'committeeId',
  'minimumVotes',
  'maxWinners',
  'allowChange',
] as const

export function assertVoteConditionsEditable(
  vote: VoteRow,
  ballotCount: number,
  patch: Partial<Pick<VoteRow, (typeof LOCKED_VOTE_FIELDS)[number]>>
) {
  const changed = LOCKED_VOTE_FIELDS.filter(
    (field) => patch[field] !== undefined && patch[field] !== vote[field]
  )
  if (changed.length === 0) return
  if (vote.open) throw apiError(409, 'voteOpenLocked')
  if (ballotCount > 0) throw apiError(409, 'voteLocked')
}
