import { asc } from 'drizzle-orm'
import { db } from '../../../db'
import { users } from '../../../db/schema'
import { toAdminUser } from '../../../utils/adminUsers'

export default defineEventHandler(async () => {
  const rows = await db.query.users.findMany({
    with: { committee: true, group: true },
    orderBy: [asc(users.lastName), asc(users.firstName)],
  })
  return { data: rows.map(toAdminUser) }
})
