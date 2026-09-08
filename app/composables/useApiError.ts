export function getApiErrorMessage(error: unknown, fallback = 'Ha ocurrido un error.') {
  const err = error as {
    data?: { message?: string; statusMessage?: string }
    statusMessage?: string
    message?: string
  }
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
      icon: 'i-lucide-alert-circle',
    })
  }

  function info(title: string, description?: string) {
    toast.add({ title, description, color: 'info', icon: 'i-lucide-info' })
  }

  return { success, error, info }
}
