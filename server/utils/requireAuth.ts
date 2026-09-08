import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { users } from '../db/schema'
import { auth } from './auth'
import { apiError } from './apiErrorMessages'
import type { SessionUser } from '~~/shared/types/api'

async function loadSessionUser(event: H3Event): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session) return null

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    with: {
      committee: true,
      group: true,
    },
  })

  if (!user) return null

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    firstName: user.firstName,
    lastName: user.lastName,
    image: user.image,
    role: user.role === 'admin' ? ('admin' as const) : ('delegate' as const),
    banned: user.banned,
    photoRemovedAt: user.photoRemovedAt,
    committee: user.committee
      ? { id: user.committee.id, name: user.committee.name, slug: user.committee.slug }
      : null,
    group: user.group
      ? {
          id: user.group.id,
          name: user.group.name,
          abbreviation: user.group.abbreviation,
          color: user.group.color,
          logo: user.group.logo,
        }
      : null,
  }
}

export async function getOptionalUser(event: H3Event) {
  if (event.context.sessionUser !== undefined) return event.context.sessionUser

  const user = await loadSessionUser(event)
  event.context.sessionUser = user && !user.banned ? user : null
  return event.context.sessionUser
}

export async function requireUser(event: H3Event) {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session) throw apiError(401, 'unauthorized')

  const user = await loadSessionUser(event)
  if (!user) throw apiError(401, 'unauthorized')
  if (user.banned) throw apiError(403, 'suspended')

  event.context.sessionUser = user
  return user
}

export async function requireAdmin(event: H3Event) {
  const user = await requireUser(event)
  if (user.role !== 'admin') throw apiError(403, 'forbidden')
  return user
}
