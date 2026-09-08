/** Event timezone: every clock in the UI shows Canary time, whatever the device. */
export const EVENT_TIME_ZONE = 'Atlantic/Canary'

export function useFormatting() {
  function formatDateTime(value: string | Date | null | undefined) {
    if (!value) return ''
    try {
      return new Intl.DateTimeFormat('es-ES', {
        timeZone: EVENT_TIME_ZONE,
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
        timeZone: EVENT_TIME_ZONE,
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
