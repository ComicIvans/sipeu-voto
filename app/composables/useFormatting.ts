/**
 * Fallback timezone for the server render. Every clock in the UI shows the time
 * on the reader's own device; the server has no way to know which that is, so it
 * renders the event's timezone and the browser corrects it on mount.
 */
export const EVENT_TIME_ZONE = 'Atlantic/Canary'

/**
 * Module scope on purpose: it is only ever written inside `onMounted`, so it
 * stays null on the server and cannot carry one request's value into another.
 */
const viewerTimeZone = ref<string | null>(null)

export function useFormatting() {
  onMounted(() => {
    if (viewerTimeZone.value) return
    try {
      viewerTimeZone.value = Intl.DateTimeFormat().resolvedOptions().timeZone || null
    } catch {
      viewerTimeZone.value = null
    }
  })

  // Read during render, so every timestamp on the page re-renders once the
  // browser's timezone is known.
  const timeZone = computed(() => viewerTimeZone.value ?? EVENT_TIME_ZONE)

  function formatDateTime(value: string | Date | null | undefined) {
    if (!value) return ''
    try {
      return new Intl.DateTimeFormat('es-ES', {
        timeZone: timeZone.value,
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value))
    } catch {
      return String(value)
    }
  }

  function formatTime(value: string | Date | null | undefined) {
    if (!value) return ''
    try {
      return new Intl.DateTimeFormat('es-ES', {
        timeZone: timeZone.value,
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value))
    } catch {
      return String(value)
    }
  }

  function formatNumber(value: number) {
    return new Intl.NumberFormat('es-ES').format(value)
  }

  function formatPercent(part: number, total: number) {
    if (total === 0) return '0%'
    return `${Math.round((part / total) * 100)}%`
  }

  return { formatDateTime, formatTime, formatNumber, formatPercent }
}
