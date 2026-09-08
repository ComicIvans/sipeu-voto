import { inArray } from 'drizzle-orm'
import { db } from '../../../db'
import { users } from '../../../db/schema'
import { sendCredentialsEmail } from '../../../utils/mailer'
import { generatePassword, setUserPassword } from '../../../utils/password'
import { userIdsSchema } from '../../../validation/users'
import { parseBody } from '../../../validation/common'

export default defineEventHandler(async (event) => {
  const { ids } = parseBody(userIdsSchema, await readBody(event))

  const targets = await db.select().from(users).where(inArray(users.id, ids))

  const results: Array<{
    id: string
    email: string
    name: string
    sent: boolean
    password?: string
    error?: string
  }> = []

  for (const user of targets) {
    const password = generatePassword()
    try {
      await setUserPassword(user.id, password)
      const mail = await sendCredentialsEmail({
        to: user.email,
        firstName: user.firstName,
        password,
        isNewAccount: false,
      })
      results.push({
        id: user.id,
        email: user.email,
        name: user.name,
        sent: mail.sent,
        password: mail.sent ? undefined : password,
      })
    } catch (error) {
      results.push({
        id: user.id,
        email: user.email,
        name: user.name,
        sent: false,
        password,
        error: error instanceof Error ? error.message : 'Error desconocido',
      })
    }
  }

  return {
    data: results,
    meta: { total: results.length, sent: results.filter((r) => r.sent).length },
  }
})
