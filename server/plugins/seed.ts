import { eq } from 'drizzle-orm'
import { db } from '../db'
import { committees, parliamentaryGroups, users } from '../db/schema'
import { createUserWithPassword } from '../utils/password'
import { logError, logInfo } from '../utils/logger'
import { getOptionalConfigString } from '~~/shared/utils/config'

const DEFAULT_COMMITTEES = [
  { name: 'LIBE', slug: 'libe', order: 1 },
  { name: 'SEDE', slug: 'sede', order: 2 },
  { name: 'ECON', slug: 'econ', order: 3 },
  { name: 'INV', slug: 'inv', order: 4 },
]

const DEFAULT_GROUPS = [
  { name: 'Alianza Popular Europea', abbreviation: 'APE', color: '#2563eb', order: 1 },
  { name: 'Socialistas', abbreviation: 'SD', color: '#dc2626', order: 2 },
  { name: 'Frente de Patriotas', abbreviation: 'FPE', color: '#312e81', order: 3 },
  { name: 'Reformistas y Conservadores', abbreviation: 'RCE', color: '#0d9488', order: 4 },
  { name: 'Unión Demócrata Liberal', abbreviation: 'UDL', color: '#f59e0b', order: 5 },
  { name: 'Europa Verde', abbreviation: 'EV', color: '#16a34a', order: 6 },
  { name: 'Izquierda Federalista', abbreviation: 'IFed', color: '#9333ea', order: 7 },
  { name: 'Soberanía Europea', abbreviation: 'SEN', color: '#78350f', order: 8 },
]

async function seedCommitteesAndGroups() {
  const [existingCommittee] = await db.select({ id: committees.id }).from(committees).limit(1)
  if (!existingCommittee) {
    await db.insert(committees).values(DEFAULT_COMMITTEES)
    logInfo('seed.committees', { count: DEFAULT_COMMITTEES.length })
  }

  const [existingGroup] = await db
    .select({ id: parliamentaryGroups.id })
    .from(parliamentaryGroups)
    .limit(1)
  if (!existingGroup) {
    await db.insert(parliamentaryGroups).values(DEFAULT_GROUPS)
    logInfo('seed.groups', { count: DEFAULT_GROUPS.length })
  }
}

async function seedAdmin() {
  const [existingAdmin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'admin'))
    .limit(1)
  if (existingAdmin) return

  const email = getOptionalConfigString(process.env.ADMIN_EMAIL)
  const password = getOptionalConfigString(process.env.ADMIN_PASSWORD)
  if (!email || !password) {
    logInfo('seed.admin.skipped', { reason: 'ADMIN_EMAIL or ADMIN_PASSWORD missing' })
    return
  }

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1)

  if (existingUser) {
    await db.update(users).set({ role: 'admin' }).where(eq(users.id, existingUser.id))
    logInfo('seed.admin.promoted', { userId: existingUser.id })
    return
  }

  await createUserWithPassword({
    firstName: getOptionalConfigString(process.env.ADMIN_FIRST_NAME) ?? 'Organización',
    lastName: getOptionalConfigString(process.env.ADMIN_LAST_NAME) ?? 'SIPEU',
    email,
    password,
    role: 'admin',
  })
  logInfo('seed.admin.created', {})
}

export default defineNitroPlugin(async () => {
  try {
    await seedCommitteesAndGroups()
    await seedAdmin()
  } catch (error) {
    logError('seed', error)
  }
})
