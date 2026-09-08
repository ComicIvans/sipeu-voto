import { broadcastSSEShutdown } from '../utils/sseManager'

export default defineNitroPlugin(() => {
  process.once('SIGTERM', broadcastSSEShutdown)
  process.once('SIGINT', broadcastSSEShutdown)
})
