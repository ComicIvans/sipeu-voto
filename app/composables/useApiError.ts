interface FetchLikeError {
  data?: { message?: string; statusMessage?: string; data?: unknown }
  statusCode?: number
  status?: number
  statusMessage?: string
  message?: string
  response?: unknown
}

export function getApiErrorStatus(error: unknown): number | null {
  const err = error as FetchLikeError
  const status = err?.statusCode ?? err?.status
  return typeof status === 'number' ? status : null
}

/** True when the request never got an HTTP answer (offline, timeout, server down). */
export function isNetworkError(error: unknown) {
  return getApiErrorStatus(error) === null
}

export function getApiErrorMessage(error: unknown, fallback = 'Ha ocurrido un error.') {
  const err = error as FetchLikeError
  if (isNetworkError(error))
    return 'Sin conexión con el servidor. Comprueba la red e inténtalo de nuevo.'
  return err?.data?.message || err?.data?.statusMessage || err?.statusMessage || fallback
}

export function useApiToast() {
  const toast = useToast()

  function success(title: string, description?: string) {
    toast.add({ title, description, color: 'success', icon: 'i-lucide-check-circle-2' })
  }

  function error(err: unknown, fallback = 'Ha ocurrido un error.') {
    toast.add({
      title: getApiErrorMessage(err, fallback),
      color: 'error',
      icon: isNetworkError(err) ? 'i-lucide-wifi-off' : 'i-lucide-alert-circle',
    })
  }

  function info(title: string, description?: string) {
    toast.add({ title, description, color: 'info', icon: 'i-lucide-info' })
  }

  function warning(title: string, description?: string) {
    toast.add({ title, description, color: 'warning', icon: 'i-lucide-alert-triangle' })
  }

  return { success, error, info, warning }
}
