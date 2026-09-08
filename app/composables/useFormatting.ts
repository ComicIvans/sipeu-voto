export function useFormatting() {
  function formatDateTime(value: string | Date | null | undefined) {
    if (!value) return ''
    try {
      return new Intl.DateTimeFormat('es-ES', {
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
      return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(
        new Date(value)
      )
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
