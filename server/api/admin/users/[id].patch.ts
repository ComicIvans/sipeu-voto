import { eq } from 'drizzle-orm'
import { db } from '../../../db'
import { users } from '../../../db/schema'
import { apiError } from '../../../utils/apiErrorMessages'
import { findAdminUser } from '../../../utils/adminUsers'
import { requireAdmin } from '../../../utils/requireAuth'
import { emitContentChanged } from '../../../utils/sseManager'
import { updateUserSchema } from '../../../validation/users'
import { parseBody } from '../../../validation/common'
import { buildFullName } from '~~/shared/utils/names'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw apiError(400, 'requiredId')
  const admin = await requireAdmin(event)
  const body = parseBody(updateUserSchema, await readBody(event))

  const current = await db.query.users.findFirst({ where: eq(users.id, id) })
  if (!current) throw apiError(404, 'userNotFound')

  if (id === admin.id && body.role && body.role !== 'admin') throw apiError(409, 'cannotDemoteSelf')

  const firstName = body.firstName ?? current.firstName
  const lastName = body.lastName ?? current.lastName
  const role = body.role ?? current.role
  const committeeId = body.committeeId === undefined ? current.committeeId : body.committeeId
  const groupId = body.groupId === undefined ? current.groupId : body.groupId
  if (role === 'delegate' && (!committeeId || !groupId)) {
    throw apiError(400, 'delegateNeedsCommitteeAndGroup')
  }

  try {
    await db
      .update(users)
      .set({
        ...body,
        firstName,
        lastName,
        name: buildFullName(firstName, lastName),
      })
      .where(eq(users.id, id))
  } catch (error) {
    if ((error as { code?: string }).code === '23505') throw apiError(409, 'emailAlreadyExists')
    throw error
  }

  emitContentChanged('users')
  return { data: await findAdminUser(id) }
})
