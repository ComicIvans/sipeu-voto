import type { SSEEvent } from '~~/shared/types/sseEvents'

export type SSEEventHandler = (type: SSEEvent['type'] | 'connected', data: unknown) => void

export interface UseSSEConnectionOptions {
  url?: string
  onEvent: SSEEventHandler
  onConnectionStateChange?: (connected: boolean) => void
}

const NAMED_EVENTS: SSEEvent['type'][] = ['vote-changed', 'content-changed']

export function makeSSEClient(opts: UseSSEConnectionOptions) {
  let eventSource: EventSource | null = null
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  let reconnectDelay = 1000
  let stopped = false

  function connect() {
    if (stopped) return
    eventSource = new EventSource(opts.url ?? '/api/sse/votes')

    eventSource.addEventListener('connected', (e) => {
      reconnectDelay = 1000
      opts.onConnectionStateChange?.(true)
      try {
        opts.onEvent('connected', JSON.parse((e as MessageEvent).data))
      } catch {
        /* ignore */
      }
    })

    for (const name of NAMED_EVENTS) {
      eventSource.addEventListener(name, (e) => {
        try {
          opts.onEvent(name, JSON.parse((e as MessageEvent).data))
        } catch {
          /* ignore */
        }
      })
    }

    eventSource.onerror = () => {
      opts.onConnectionStateChange?.(false)
      eventSource?.close()
      eventSource = null
      if (stopped) return
      const jitter = 0.75 + Math.random() * 0.5
      reconnectTimeout = setTimeout(() => {
        reconnectDelay = Math.min(reconnectDelay * 2, 30_000)
        connect()
      }, reconnectDelay * jitter)
    }
  }

  /** Drops the current socket and dials again immediately (tab woke up, etc.). */
  function reconnect() {
    if (stopped) return
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
    eventSource?.close()
    eventSource = null
    reconnectDelay = 1000
    connect()
  }

  function disconnect() {
    stopped = true
    opts.onConnectionStateChange?.(false)
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
    eventSource?.close()
    eventSource = null
  }

  return { connect, disconnect, reconnect }
}

/** Opens one SSE connection for the lifetime of the component. */
export function useSSEConnection(opts: UseSSEConnectionOptions) {
  const isConnected = ref(false)

  const client = makeSSEClient({
    url: opts.url,
    onConnectionStateChange(connected) {
      isConnected.value = connected
      opts.onConnectionStateChange?.(connected)
    },
    onEvent: opts.onEvent,
  })

  if (import.meta.server) {
    return { isConnected }
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible' && !isConnected.value) client.reconnect()
  }

  onMounted(() => {
    client.connect()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('online', onVisibilityChange)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('online', onVisibilityChange)
    client.disconnect()
  })

  return { isConnected }
}

/**
 * Refreshes data whenever the server announces a change. Reconnects also refresh,
 * so a tab that was asleep catches up.
 */
export function useLiveRefresh(
  refresh: () => Promise<unknown> | unknown,
  filter?: (event: SSEEvent) => boolean
) {
  let pending: ReturnType<typeof setTimeout> | null = null

  function scheduleRefresh() {
    if (pending) clearTimeout(pending)
    pending = setTimeout(() => {
      pending = null
      void refresh()
    }, 120)
  }

  const { isConnected } = useSSEConnection({
    onEvent(type, data) {
      if (type === 'connected') {
        scheduleRefresh()
        return
      }
      const event = data as SSEEvent
      if (filter && !filter(event)) return
      scheduleRefresh()
    },
  })

  if (import.meta.client) {
    const onVisible = () => {
      if (document.visibilityState === 'visible') scheduleRefresh()
    }
    onMounted(() => document.addEventListener('visibilitychange', onVisible))
    onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisible))
  }

  return { isConnected }
}
