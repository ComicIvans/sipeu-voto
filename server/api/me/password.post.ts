import { auth } from '../../utils/auth'
import { requireUser } from '../../utils/requireAuth'
import { changePasswordSchema } from '../../validation/users'
import { parseBody } from '../../validation/common'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const body = parseBody(changePasswordSchema, await readBody(event))

  try {
    await auth.api.changePassword({
      headers: event.headers,
      body: {
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
        revokeOtherSessions: true,
      },
    })
  } catch (error) {
    const status = (error as { status?: number | string }).status
    const code = typeof status === 'number' ? status : 400
    throw createError({
      statusCode: code === 401 || code === 400 ? 400 : code,
      message: 'La contraseña actual no es correcta.',
    })
  }

  return { data: { ok: true } }
})
