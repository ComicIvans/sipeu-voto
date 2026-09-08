import { and, asc, eq } from 'drizzle-orm'
import { db } from '../../db'
import { users } from '../../db/schema'
import { requireUser } from '../../utils/requireAuth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (!user.committee) return { data: [] }

  const members = await db.query.users.findMany({
    where: and(eq(users.committeeId, user.committee.id), eq(users.banned, false)),
    with: { group: true },
    orderBy: [asc(users.lastName), asc(users.firstName)],
  })

  return {
    data: members.map((member) => ({
      id: member.id,
      name: member.name,
      firstName: member.firstName,
      lastName: member.lastName,
      image: member.image,
      role: member.role,
      group: member.group
        ? {
            id: member.group.id,
            name: member.group.name,
            abbreviation: member.group.abbreviation,
            color: member.group.color,
          }
        : null,
    })),
  }
})
