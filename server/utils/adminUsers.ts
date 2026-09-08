import { eq } from 'drizzle-orm'
import { db } from '../db'
import { users } from '../db/schema'

export function toAdminUser(
  user: typeof users.$inferSelect & {
    committee?: { id: string; name: string; slug: string } | null
    group?: {
      id: string
      name: string
      abbreviation: string
      color: string
      logo: string | null
    } | null
  }
) {
  return {
    id: user.id,
    name: user.name,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    image: user.image,
    role: user.role === 'admin' ? ('admin' as const) : ('delegate' as const),
    banned: user.banned,
    photoRemovedAt: user.photoRemovedAt?.toISOString() ?? null,
    committeeId: user.committeeId,
    groupId: user.groupId,
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
    createdAt: user.createdAt.toISOString(),
  }
}

export async function findAdminUser(id: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
    with: { committee: true, group: true },
  })
  return user ? toAdminUser(user) : null
}
