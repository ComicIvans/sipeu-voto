import { eq } from 'drizzle-orm'
import { db } from '../db'
import { votes } from '../db/schema'
import { apiError } from './apiErrorMessages'

export async function requireVote(id: string) {
  const vote = await db.query.votes.findFirst({ where: eq(votes.id, id) })
  if (!vote) throw apiError(404, 'voteNotFound')
  return vote
}
