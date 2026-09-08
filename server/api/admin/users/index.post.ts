import { eq } from 'drizzle-orm'
import { db } from '../../../db'
import { users } from '../../../db/schema'
import { apiError } from '../../../utils/apiErrorMessages'
import { findAdminUser } from '../../../utils/adminUsers'
import { sendCredentialsEmail } from '../../../utils/mailer'
import { createUserWithPassword, generatePassword } from '../../../utils/password'
import { emitContentChanged } from '../../../utils/sseManager'
import { createUserSchema } from '../../../validation/users'
import { parseBody } from '../../../validation/common'

export default defineEventHandler(async (event) => {
  const body = parseBody(createUserSchema, await readBody(event))

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, body.email))
    .limit(1)
  if (existing) throw apiError(409, 'emailAlreadyExists')

  const password = body.password ?? generatePassword()
  const created = await createUserWithPassword({
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    password,
    role: body.role,
    committeeId: body.committeeId ?? null,
    groupId: body.groupId ?? null,
  })

  let mailSent = false
  if (body.sendCredentials) {
    try {
      const result = await sendCredentialsEmail({
        to: created.email,
        firstName: created.firstName,
        password,
        isNewAccount: true,
      })
      mailSent = result.sent
    } catch {
      mailSent = false
    }
  }

  emitContentChanged('users')

  return {
    data: await findAdminUser(created.id),
    meta: { mailSent, password: body.sendCredentials && mailSent ? undefined : password },
  }
})
