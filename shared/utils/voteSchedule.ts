import { getVoteStatus } from './voteStatus'

/**
 * A vote can carry an optional schedule. These functions decide what that
 * schedule means; the ticker in `server/plugins/voteSchedule.ts` and the manual
 * open/close endpoints both go through them so the rule cannot drift between
 * "the clock did it" and "an admin did it".
 */
export interface ScheduledVote {
  open: boolean
  startedAt: string | Date | null
  endedAt: string | Date | null
  opensAt: string | Date | null
  closesAt: string | Date | null
}

/**
 * - `open`: it was never opened and its opening time has arrived.
 * - `close`: it is open and its closing time has arrived.
 * - `expire`: the whole window went by without the vote opening, which happens
 *   when the app was down across it. Opening it now, unattended and after its
 *   own deadline, would be worse than leaving it alone.
 */
export type DueVoteAction = 'open' | 'close' | 'expire' | null

function due(value: string | Date | null, now: Date) {
  if (!value) return false
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(time) && time <= now.getTime()
}

export function getDueVoteAction(vote: ScheduledVote, now: Date): DueVoteAction {
  const status = getVoteStatus(vote)
  if (status === 'pending' && due(vote.opensAt, now)) {
    return due(vote.closesAt, now) ? 'expire' : 'open'
  }
  if (status === 'open' && due(vote.closesAt, now)) return 'close'
  return null
}

/**
 * What the schedule should look like once the vote is open, however it got
 * there. The opening time is spent either way. A closing time still in the
 * future survives, which is what makes "open it now but close it at half past"
 * work; one already in the past is dropped, because keeping it would slam the
 * vote shut on the next tick and undo what somebody just did on purpose.
 */
export function scheduleAfterOpen(vote: Pick<ScheduledVote, 'closesAt'>, now: Date) {
  return {
    opensAt: null,
    closesAt: due(vote.closesAt, now) ? null : toDate(vote.closesAt),
  }
}

/** Once it is closed, the closing time has nothing left to do. */
export function scheduleAfterClose() {
  return { opensAt: null, closesAt: null }
}

function toDate(value: string | Date | null) {
  if (!value) return null
  return value instanceof Date ? value : new Date(value)
}
