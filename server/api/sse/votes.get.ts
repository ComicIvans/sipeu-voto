import type { SerializedSSEEvent } from '../../utils/sseManager'
import { onSSEEvent, onSSEShutdown } from '../../utils/sseManager'

export default defineEventHandler(async (event) => {
  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  const writer = event.node.res
  writer.write(`event: connected\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`)

  const heartbeat = setInterval(() => {
    try {
      writer.write(`: heartbeat ${Date.now()}\n\n`)
    } catch {
      clearInterval(heartbeat)
    }
  }, 25_000)

  const handler = (data: SerializedSSEEvent) => {
    try {
      writer.write(`event: ${data.type}\ndata: ${data.json}\n\n`)
    } catch {
      // Client disconnected
    }
  }

  const unsubscribe = onSSEEvent(handler)

  await new Promise<void>((resolve) => {
    const unsubscribeShutdown = onSSEShutdown(() => {
      clearInterval(heartbeat)
      unsubscribe()
      try {
        writer.end()
      } catch {
        // Already closed
      }
      resolve()
    })

    event.node.req.once('close', () => {
      clearInterval(heartbeat)
      unsubscribe()
      unsubscribeShutdown()
      resolve()
    })
  })
})
