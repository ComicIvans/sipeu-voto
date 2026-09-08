export interface WinnerInput {
  id: string
  count: number
  canWin: boolean
}

export interface WinnerResult {
  winnerIds: Set<string>
  thresholdReachedIds: Set<string>
}

function topNWithTies(eligible: WinnerInput[], n: number): Set<string> {
  if (n <= 0) return new Set()
  const sorted = [...eligible].sort((a, b) => b.count - a.count)
  if (sorted.length === 0) return new Set()

  const nthCount = sorted[n - 1]?.count ?? 0
  const result = new Set<string>()
  for (const opt of sorted) {
    if (opt.count >= nthCount) result.add(opt.id)
  }
  return result
}

export function calculateWinners(
  options: WinnerInput[],
  minimumVotes: number | null,
  maxWinners: number | null
): WinnerResult {
  const thresholdReachedIds = new Set<string>()

  if (minimumVotes !== null) {
    for (const opt of options) {
      if (opt.canWin && opt.count >= minimumVotes) {
        thresholdReachedIds.add(opt.id)
      }
    }
  }

  let winnerIds: Set<string>

  if (minimumVotes !== null) {
    const pool = options.filter((o) => thresholdReachedIds.has(o.id))
    if (maxWinners !== null && pool.length > maxWinners) {
      winnerIds = topNWithTies(pool, maxWinners)
    } else {
      winnerIds = new Set(pool.map((o) => o.id))
    }
  } else {
    const eligible = options.filter((o) => o.canWin)
    const eligibleWithVotes = eligible.filter((o) => o.count > 0)

    if (eligibleWithVotes.length === 0) {
      winnerIds = new Set()
    } else if (maxWinners !== null) {
      winnerIds = topNWithTies(eligibleWithVotes, maxWinners)
    } else {
      const maxCount = Math.max(...eligibleWithVotes.map((o) => o.count))
      winnerIds = new Set(eligibleWithVotes.filter((o) => o.count === maxCount).map((o) => o.id))
    }
  }

  return { winnerIds, thresholdReachedIds }
}
