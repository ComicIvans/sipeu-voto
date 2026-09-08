import type { SessionUser } from '../../shared/types/api'

declare module 'h3' {
  interface H3EventContext {
    sessionUser?: SessionUser | null
  }
}

export {}
