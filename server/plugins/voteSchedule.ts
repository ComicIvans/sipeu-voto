import { eq, isNotNull, or, sql } from 'drizzle-orm'
import { db } from '../db'
import { voteOptions, votes } from '../db/schema'
import { logError, logInfo } from '../utils/logger'
import { emitVoteChanged } from '../utils/sseManager'
import {
  getDueVoteAction,
  scheduleAfterClose,
  scheduleAfterOpen,
} from '~~/shared/utils/voteSchedule'

const TICK_MS = 10_000

/**
 * One advisory lock for the whole tick. The deployment runs a single container,
 * so this is only insurance against two processes overlapping during a restart;
 * per-vote locks would be more machinery than that is worth.
 */
const LOCK_KEY = 'vote-schedule'

/**
 * Reruns the checks `open.post.ts` makes. Nobody is watching a scheduled open,
 * so a vote that cannot be opened has its opening time cleared and the reason
 * logged once, instead of failing silently every ten seconds until the event is
 * over.
 */
async function canOpen(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], voteId: string) {
  const options = await tx
    .select({ canWin: voteOptions.canWin })
    .from(voteOptions)
    .where(eq(voteOptions.voteId, voteId))
  if (options.length === 0) return 'no tiene opciones'
  if (!options.some((option) => option.canWin)) return 'ninguna opción computa'
  return null
}

export async function runVoteSchedule(now = new Date()) {
  const changed: Array<{ id: string; committeeId: string | null; open: boolean }> = []

  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${LOCK_KEY}))`)

    const candidates = await tx
      .select()
      .from(votes)
      .where(or(isNotNull(votes.opensAt), isNotNull(votes.closesAt)))
      .for('update')

    for (const vote of candidates) {
      const action = getDueVoteAction(vote, now)
      if (!action) continue

      if (action === 'expire') {
        await tx.update(votes).set(scheduleAfterClose()).where(eq(votes.id, vote.id))
        logInfo('voteSchedule.expired', {
          voteId: vote.id,
          reason: 'la ventana pasó entera sin que la votación llegase a abrirse',
        })
        continue
      }

      if (action === 'open') {
        if (!vote.visible) {
          await tx.update(votes).set({ opensAt: null }).where(eq(votes.id, vote.id))
          logInfo('voteSchedule.openSkipped', { voteId: vote.id, reason: 'está oculta' })
          continue
        }
        const blocked = await canOpen(tx, vote.id)
        if (blocked) {
          await tx.update(votes).set({ opensAt: null }).where(eq(votes.id, vote.id))
          logInfo('voteSchedule.openSkipped', { voteId: vote.id, reason: blocked })
          continue
        }

        const [row] = await tx
          .update(votes)
          .set({
            open: true,
            startedAt: vote.startedAt ?? sql`now()`,
            endedAt: null,
            ...scheduleAfterOpen(vote, now),
          })
          .where(eq(votes.id, vote.id))
          .returning()
        if (row) changed.push(row)
        continue
      }

      const [row] = await tx
        .update(votes)
        .set({ open: false, endedAt: sql`now()`, ...scheduleAfterClose() })
        .where(eq(votes.id, vote.id))
        .returning()
      if (row) changed.push(row)
    }
  })

  // Outside the transaction: subscribers must not be told about a state that is
  // still uncommitted.
  for (const vote of changed) {
    logInfo('voteSchedule.applied', { voteId: vote.id, open: vote.open })
    emitVoteChanged(vote)
  }

  return changed.length
}

export default defineNitroPlugin((nitro) => {
  if (import.meta.prerender) return

  let running = false
  const timer = setInterval(() => {
    // A tick that outlasts the interval must not stack on the next one.
    if (running) return
    running = true
    runVoteSchedule()
      .catch((error) => logError('voteSchedule.tick', error, {}))
      .finally(() => {
        running = false
      })
  }, TICK_MS)

  // Node keeps the process alive for pending timers; this one must never be the
  // reason a container refuses to exit.
  timer.unref?.()

  nitro.hooks.hook('close', () => {
    clearInterval(timer)
  })
})
