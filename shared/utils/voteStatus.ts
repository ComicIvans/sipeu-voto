export type VoteStatus = 'pending' | 'open' | 'closed'

export function getVoteStatus(vote: {
  open: boolean
  startedAt: string | Date | null
  endedAt: string | Date | null
}): VoteStatus {
  if (vote.open) return 'open'
  if (vote.endedAt || vote.startedAt) return 'closed'
  return 'pending'
}

export const VOTE_STATUS_LABELS: Record<VoteStatus, string> = {
  pending: 'Pendiente',
  open: 'Abierta',
  closed: 'Finalizada',
}
