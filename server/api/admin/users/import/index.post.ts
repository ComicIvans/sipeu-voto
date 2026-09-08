import { inArray } from 'drizzle-orm'
import { db } from '../../../../db'
import { committees, parliamentaryGroups, users } from '../../../../db/schema'
import { apiError } from '../../../../utils/apiErrorMessages'
import { parseUsersCsv } from '../../../../utils/csvImport'
import { sendCredentialsEmail } from '../../../../utils/mailer'
import { createUserWithPassword, generatePassword } from '../../../../utils/password'
import { emitContentChanged } from '../../../../utils/sseManager'

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

export default defineEventHandler(async (event) => {
  const parts = await readMultipartFormData(event)
  const file = parts?.find((part) => part.name === 'file' && part.data?.length)
  if (!file) throw apiError(400, 'csvMissingFile')

  const sendCredentials =
    (parts?.find((part) => part.name === 'sendCredentials')?.data?.toString('utf8') ?? 'true') !==
    'false'
  const dryRun = parts?.find((part) => part.name === 'dryRun')?.data?.toString('utf8') === 'true'

  const { rows, errors } = parseUsersCsv(file.data.toString('utf8'))
  if (rows.length === 0 && errors.length === 0) throw apiError(400, 'csvEmpty')

  const [committeeRows, groupRows] = await Promise.all([
    db.select().from(committees),
    db.select().from(parliamentaryGroups),
  ])

  const committeeLookup = new Map<string, string>()
  for (const committee of committeeRows) {
    committeeLookup.set(normalize(committee.name), committee.id)
    committeeLookup.set(normalize(committee.slug), committee.id)
  }
  const groupLookup = new Map<string, string>()
  for (const group of groupRows) {
    groupLookup.set(normalize(group.name), group.id)
    groupLookup.set(normalize(group.abbreviation), group.id)
  }

  const existingEmails = new Set(
    rows.length > 0
      ? (
          await db
            .select({ email: users.email })
            .from(users)
            .where(
              inArray(
                users.email,
                rows.map((row) => row.email)
              )
            )
        ).map((row) => row.email)
      : []
  )

  const resolved: Array<{
    row: (typeof rows)[number]
    committeeId: string | null
    groupId: string | null
  }> = []

  for (const row of rows) {
    if (existingEmails.has(row.email)) {
      errors.push({ line: row.line, message: `Ya existe un usuario con el correo ${row.email}.` })
      continue
    }

    let committeeId: string | null = null
    if (row.committee) {
      committeeId = committeeLookup.get(normalize(row.committee)) ?? null
      if (!committeeId) {
        errors.push({ line: row.line, message: `Comisión desconocida: ${row.committee}` })
        continue
      }
    }

    let groupId: string | null = null
    if (row.group) {
      groupId = groupLookup.get(normalize(row.group)) ?? null
      if (!groupId) {
        errors.push({ line: row.line, message: `Grupo parlamentario desconocido: ${row.group}` })
        continue
      }
    }

    resolved.push({ row, committeeId, groupId })
  }

  errors.sort((a, b) => a.line - b.line)

  if (dryRun || errors.length > 0) {
    return {
      data: {
        imported: 0,
        valid: resolved.length,
        errors,
        preview: resolved.map(({ row }) => ({
          line: row.line,
          name: `${row.firstName} ${row.lastName}`,
          email: row.email,
          committee: row.committee,
          group: row.group,
          role: row.role,
        })),
      },
    }
  }

  const created: Array<{ email: string; name: string; sent: boolean; password?: string }> = []

  for (const { row, committeeId, groupId } of resolved) {
    const password = generatePassword()
    const user = await createUserWithPassword({
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      password,
      role: row.role,
      committeeId,
      groupId,
    })

    let sent = false
    if (sendCredentials) {
      try {
        sent = (
          await sendCredentialsEmail({
            to: user.email,
            firstName: user.firstName,
            password,
            isNewAccount: true,
          })
        ).sent
      } catch {
        sent = false
      }
    }

    created.push({
      email: user.email,
      name: user.name,
      sent,
      password: sent ? undefined : password,
    })
  }

  emitContentChanged('users')

  return { data: { imported: created.length, valid: resolved.length, errors: [], created } }
})
