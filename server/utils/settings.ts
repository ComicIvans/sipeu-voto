import { eq } from 'drizzle-orm'
import { db } from '../db'
import { appSettings } from '../db/schema'

/** Cover of the plenary session, which has no `committees` row of its own. */
export const PLENARY_COVER_KEY = 'plenaryCover'

/**
 * Whether the plenary is listed before the committees instead of after them.
 * It has no row among them, so it has no `order` either: the only positions it
 * can take are the two ends, and one flag says which.
 */
export const PLENARY_FIRST_KEY = 'plenaryFirst'

export async function getSetting(key: string) {
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, key) })
  return row?.value ?? null
}

export async function setSetting(key: string, value: string) {
  await db
    .insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value } })
}
