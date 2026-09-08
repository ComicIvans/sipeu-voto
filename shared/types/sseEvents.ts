export interface VoteChangedEvent {
  type: 'vote-changed'
  voteId: string
  committeeId: string | null
  open: boolean
}

export interface ContentChangedEvent {
  type: 'content-changed'
  scope: 'committees' | 'votes' | 'groups' | 'users'
  committeeId?: string | null
}

export type SSEEvent = VoteChangedEvent | ContentChangedEvent
