import { and, eq } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'
import { generateRandomString, hashPassword } from 'better-auth/crypto'
import { db } from '../db'
import { accounts, sessions, users } from '../db/schema'
import { buildFullName } from '~~/shared/utils/names'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = PgTransaction<any, any, any>

export function generatePassword(length = 12) {
  return generateRandomString(length, 'a-z', 'A-Z', '0-9')
}

/** Stores a new password and revokes every session, atomically. */
export async function setUserPassword(userId: string, password: string) {
  const hashed = await hashPassword(password)

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'credential')))
      .limit(1)

    if (existing) {
      await tx.update(accounts).set({ password: hashed }).where(eq(accounts.id, existing.id))
    } else {
      await tx.insert(accounts).values({
        id: createId(),
        accountId: userId,
        providerId: 'credential',
        userId,
        password: hashed,
      })
    }

    await tx.delete(sessions).where(eq(sessions.userId, userId))
  })
}

export interface CreateUserInput {
  firstName: string
  lastName: string
  email: string
  password: string
  role?: 'admin' | 'delegate'
  committeeId?: string | null
  groupId?: string | null
}

export async function insertUserWithPassword(tx: Tx | typeof db, input: CreateUserInput) {
  const id = createId()
  const hashed = await hashPassword(input.password)

  const [user] = await tx
    .insert(users)
    .values({
      id,
      name: buildFullName(input.firstName, input.lastName),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email.trim().toLowerCase(),
      emailVerified: true,
      role: input.role ?? 'delegate',
      committeeId: input.committeeId ?? null,
      groupId: input.groupId ?? null,
    })
    .returning()

  await tx.insert(accounts).values({
    id: createId(),
    accountId: id,
    providerId: 'credential',
    userId: id,
    password: hashed,
  })

  return user!
}

export async function createUserWithPassword(input: CreateUserInput) {
  return db.transaction((tx) => insertUserWithPassword(tx, input))
}
