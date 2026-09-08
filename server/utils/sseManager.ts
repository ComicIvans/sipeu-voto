import { EventEmitter } from 'node:events'
import type { SSEEvent } from '~~/shared/types/sseEvents'

export interface SerializedSSEEvent {
  type: SSEEvent['type']
  json: string
}

const emitter = new EventEmitter()
emitter.setMaxListeners(0)

export function emitSSE(event: SSEEvent) {
  emitter.emit('sse', {
    type: event.type,
    json: JSON.stringify(event),
  } satisfies SerializedSSEEvent)
}

export function emitVoteChanged(vote: { id: string; committeeId: string | null; open: boolean }) {
  emitSSE({ type: 'vote-changed', voteId: vote.id, committeeId: vote.committeeId, open: vote.open })
}

export function emitContentChanged(
  scope: 'committees' | 'votes' | 'groups' | 'users',
  committeeId?: string | null
) {
  emitSSE({ type: 'content-changed', scope, committeeId })
}

export function onSSEEvent(handler: (data: SerializedSSEEvent) => void) {
  emitter.on('sse', handler)
  return () => {
    emitter.off('sse', handler)
  }
}

const shutdownHandlers = new Set<() => void>()

export function onSSEShutdown(handler: () => void) {
  shutdownHandlers.add(handler)
  return () => shutdownHandlers.delete(handler)
}

export function broadcastSSEShutdown() {
  for (const handler of shutdownHandlers) handler()
  shutdownHandlers.clear()
}
