/**
 * Whether the visitor asked the system for less movement. The stylesheet already
 * neutralises CSS animations and transitions, but an animation driven from
 * JavaScript is not covered by it and has to ask.
 */
export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Slides things from where they were to where they end up (the FLIP trick).
 *
 * Reordering replaces the list and the browser paints the new one in place, so a
 * row that moves two positions simply appears two positions away. This measures
 * every box first, applies the change, and then plays each box back from its old
 * position to its new one, which is what the eye needs to follow the move.
 *
 * Boxes are matched by key rather than by node, because the row that ends up at
 * a given place may be a recycled element rather than the same one that moved.
 */
export async function animateFlip(
  collect: () => Map<string, HTMLElement>,
  mutate: () => Promise<void> | void,
  duration = 260
) {
  if (prefersReducedMotion() || typeof window === 'undefined') {
    await mutate()
    return
  }

  const before = new Map<string, DOMRect>()
  for (const [key, element] of collect()) before.set(key, element.getBoundingClientRect())

  await mutate()
  await nextTick()

  for (const [key, element] of collect()) {
    const from = before.get(key)
    if (!from) continue
    const to = element.getBoundingClientRect()
    const dx = from.left - to.left
    const dy = from.top - to.top
    // Anything under a pixel is a rounding artefact, not a move.
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue
    element.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
      // Decelerating: fast off the mark, settling into place.
      { duration, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
    )
  }
}

/** The boxes of a reorderable list, keyed by row id. */
export function collectReorderRows(ids: string[], root: ParentNode = document) {
  const boxes = new Map<string, HTMLElement>()
  for (const id of ids) {
    const anchor = root.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"]`)
    if (!anchor) continue
    boxes.set(id, anchor.closest<HTMLElement>('tr, [data-reorder-row]') ?? anchor)
  }
  return boxes
}
