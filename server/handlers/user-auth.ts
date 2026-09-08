import { defineEventHandler } from 'h3'
import { requireUser } from '../utils/requireAuth'

export default defineEventHandler(async (event) => {
  if (event.method === 'OPTIONS') return
  await requireUser(event)
})
