import { defineEventHandler } from 'h3'
import { requireAdmin } from '../utils/requireAuth'

export default defineEventHandler(async (event) => {
  if (event.method === 'OPTIONS') return
  await requireAdmin(event)
})
