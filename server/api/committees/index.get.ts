import { listCommitteesWithCounts } from '../../utils/publicQueries'

export default defineEventHandler(async () => {
  const data = await listCommitteesWithCounts()
  return { data }
})
