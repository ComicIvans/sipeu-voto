import { countUpValue, isCountWorthAnimating } from '~~/shared/utils/countUp'

/**
 * A number that travels to its new value instead of jumping to it.
 *
 * Only worth doing over a distance: a count that goes up by one has nothing in
 * between to show. The first value is taken as-is, since there is nothing to
 * count up from when the page has only just appeared.
 */
export function useCountUp(source: () => number, duration = 500) {
  const displayed = ref(source())
  let frame = 0

  const stop = () => {
    if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(frame)
  }

  watch(source, (target, previous) => {
    stop()
    const from = previous ?? 0
    // No frames to animate over on the server, and none worth spending on a
    // step the reader could not see anyway.
    if (
      typeof requestAnimationFrame === 'undefined' ||
      prefersReducedMotion() ||
      !isCountWorthAnimating(from, target)
    ) {
      displayed.value = target
      return
    }
    const started = performance.now()
    const step = (now: number) => {
      const progress = (now - started) / duration
      displayed.value = countUpValue(from, target, progress)
      if (progress < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
  })

  onScopeDispose(stop)

  return displayed
}
