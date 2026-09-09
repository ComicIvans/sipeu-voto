/**
 * Where an eased travel between two values has got to at `progress` (0 to 1).
 *
 * Eased out: most of the distance is covered early and the last stretch is
 * slow, which is what makes a number look like it is settling rather than
 * stopping dead.
 */
export function countUpValue(from: number, to: number, progress: number) {
  const clamped = Math.min(Math.max(progress, 0), 1)
  const eased = 1 - (1 - clamped) ** 3
  return Math.round(from + (to - from) * eased)
}

/**
 * Whether the travel is worth showing at all. A step of one has no intermediate
 * value to render, and that is the usual step here: one ballot, one vote. Those
 * changes are announced instead of counted.
 */
export function isCountWorthAnimating(from: number, to: number) {
  return Math.abs(to - from) > 1
}
