import { eq } from 'drizzle-orm'
import { db } from '../db'
import { appSettings } from '../db/schema'

/** Cover of the plenary session, which has no `committees` row of its own. */
export const PLENARY_COVER_KEY = 'plenaryCover'

export async function getSetting(key: string) {
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, key) })
  return row?.value ?? null
}
