export interface WinnerInput {
  id: string
  count: number
  canWin: boolean
}

export interface WinnerResult {
  /** Options that definitely won a seat. */
  winnerIds: Set<string>
  /** Options tied for the seats that are left; nobody among them has won. */
  tiedIds: Set<string>
  /** Options that reached `minimumVotes` (empty when no threshold is set). */
  thresholdReachedIds: Set<string>
}

interface Selection {
  winners: Set<string>
  tied: Set<string>
}

const EMPTY: Selection = { winners: new Set(), tied: new Set() }

/**
 * Picks the `n` most voted options. When more than `n` options qualify because
 * several share the count at the cut, the ones strictly above the cut win and
 * the ones sitting on it are returned as tied: with A=9, B=7, C=7 and n=2, A
 * takes the first seat and B and C dispute the second.
 */
function topN(eligible: WinnerInput[], n: number): Selection {
  if (n <= 0) return { winners: new Set(), tied: new Set() }
  const sorted = [...eligible].sort((a, b) => b.count - a.count)
  if (sorted.length <= n) return { winners: new Set(sorted.map((o) => o.id)), tied: new Set() }

  const cut = sorted[n - 1]!.count
  const above = sorted.filter((o) => o.count > cut)
  const atCut = sorted.filter((o) => o.count === cut)
  if (above.length + atCut.length <= n) {
    return { winners: new Set([...above, ...atCut].map((o) => o.id)), tied: new Set() }
  }
  return { winners: new Set(above.map((o) => o.id)), tied: new Set(atCut.map((o) => o.id)) }
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

  let selection: Selection

  if (minimumVotes !== null) {
    // With a threshold, several winners are the expected outcome, not a tie:
    // only the cut imposed by `maxWinners` can leave a seat undecided.
    const pool = options.filter((o) => thresholdReachedIds.has(o.id))
    selection =
      maxWinners !== null && pool.length > maxWinners
        ? topN(pool, maxWinners)
        : { winners: new Set(pool.map((o) => o.id)), tied: new Set() }
  } else {
    const eligibleWithVotes = options.filter((o) => o.canWin && o.count > 0)

    if (eligibleWithVotes.length === 0) {
      selection = EMPTY
    } else if (maxWinners !== null) {
      selection = topN(eligibleWithVotes, maxWinners)
    } else {
      // "Most voted" with no rules: two options on top means no winner at all.
      const maxCount = Math.max(...eligibleWithVotes.map((o) => o.count))
      const top = eligibleWithVotes.filter((o) => o.count === maxCount).map((o) => o.id)
      selection =
        top.length > 1
          ? { winners: new Set(), tied: new Set(top) }
          : { winners: new Set(top), tied: new Set() }
    }
  }

  return { winnerIds: selection.winners, tiedIds: selection.tied, thresholdReachedIds }
}
