import { createAuthClient } from 'better-auth/vue'
import type { SessionUser } from '~~/shared/types/api'

export const authClient = createAuthClient()

export function useAuth() {
  const user = useState<SessionUser | null>('session-user', () => null)
  const loaded = useState<boolean>('session-loaded', () => false)
  const requestFetch = useRequestFetch()

  /**
   * Reloads the session. A network failure keeps the last known user so a
   * Wi-Fi hiccup never looks like a lost account; only an explicit answer
   * from the server clears it.
   */
  async function refresh() {
    try {
      const response = await requestFetch<{ data: SessionUser | null }>('/api/session')
      user.value = response.data
    } catch (error) {
      const status =
        (error as { statusCode?: number; status?: number }).statusCode ??
        (error as { status?: number }).status
      if (typeof status === 'number') user.value = null
    } finally {
      loaded.value = true
    }
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    })
    if (error) {
      if (error.code === 'INVALID_PASSWORD') throw new Error('La contraseña actual no es correcta.')
      if (error.code === 'PASSWORD_TOO_SHORT')
        throw new Error('La nueva contraseña es demasiado corta.')
      throw new Error(error.message ?? 'No se ha podido cambiar la contraseña.')
    }
    await refresh()
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

  return { user, loaded, refresh, signIn, signOut, changePassword, isAdmin, isLoggedIn }
}
