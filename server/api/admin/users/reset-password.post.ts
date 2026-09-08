import { inArray } from 'drizzle-orm'
import { db } from '../../../db'
import { users } from '../../../db/schema'
import { logError } from '../../../utils/logger'
import { sendCredentialsEmail } from '../../../utils/mailer'
import { generatePassword, setUserPassword } from '../../../utils/password'
import { userIdsSchema } from '../../../validation/users'
import { parseBody } from '../../../validation/common'

export interface PasswordResetResult {
  id: string
  email: string
  name: string
  /** Password stored and sessions revoked. */
  updated: boolean
  /** Email delivered to the SMTP server. */
  sent: boolean
  /** Only present when the password was stored but could not be emailed. */
  password?: string
  error?: string
}

export default defineEventHandler(async (event) => {
  const { ids } = parseBody(userIdsSchema, await readBody(event))
  const targets = await db.select().from(users).where(inArray(users.id, ids))
  const results: PasswordResetResult[] = []

  for (const user of targets) {
    const password = generatePassword()

    try {
      await setUserPassword(user.id, password)
    } catch (error) {
      logError('users.resetPassword', error, { userId: user.id })
      results.push({
        id: user.id,
        email: user.email,
        name: user.name,
        updated: false,
        sent: false,
        error: 'No se ha podido guardar la nueva contraseña; la anterior sigue activa.',
      })
      continue
    }

    let sent = false
    let error: string | undefined
    try {
      sent = (
        await sendCredentialsEmail({
          to: user.email,
          firstName: user.firstName,
          password,
          isNewAccount: false,
        })
      ).sent
      if (!sent) error = 'Correo no configurado en el servidor.'
    } catch {
      error = 'El servidor de correo ha rechazado el envío.'
    }

    results.push({
      id: user.id,
      email: user.email,
      name: user.name,
      updated: true,
      sent,
      password: sent ? undefined : password,
      error,
    })
  }

  return {
    data: results,
    meta: {
      total: results.length,
      updated: results.filter((r) => r.updated).length,
      sent: results.filter((r) => r.sent).length,
    },
  }
})
