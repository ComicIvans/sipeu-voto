import { createAuthClient } from 'better-auth/vue'
import type { SessionUser } from '~~/shared/types/api'

export const authClient = createAuthClient()

export function useAuth() {
  const user = useState<SessionUser | null>('session-user', () => null)
  const loaded = useState<boolean>('session-loaded', () => false)
  const requestFetch = useRequestFetch()

  async function refresh() {
    try {
      const response = await requestFetch<{ data: SessionUser | null }>('/api/session')
      user.value = response.data
    } catch {
      user.value = null
    } finally {
      loaded.value = true
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await authClient.signIn.email({ email, password })
    if (error) {
      const code = error.code ?? ''
      if (code === 'BANNED_USER') {
        throw new Error('Tu cuenta está suspendida. Contacta con la organización.')
      }
      throw new Error('Correo o contraseña incorrectos.')
    }
    await refresh()
  }

  async function signOut() {
    await authClient.signOut()
    user.value = null
    await navigateTo('/login')
  }

  const isAdmin = computed(() => user.value?.role === 'admin')
  const isLoggedIn = computed(() => Boolean(user.value))

  return { user, loaded, refresh, signIn, signOut, isAdmin, isLoggedIn }
}
