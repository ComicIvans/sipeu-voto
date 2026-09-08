import { ADMIN_ROUTES, USER_ROUTES } from '~~/shared/constants/routes'

export default defineNuxtRouteMiddleware(async (to) => {
  const { user, loaded, refresh } = useAuth()

  if (!loaded.value) await refresh()

  const isAdminRoute = to.path.startsWith(ADMIN_ROUTES.dashboard)
  const isUserRoute =
    to.path.startsWith(USER_ROUTES.vote) || to.path.startsWith(USER_ROUTES.profile)

  if ((isAdminRoute || isUserRoute) && !user.value) {
    return navigateTo({ path: USER_ROUTES.login, query: { redirect: to.fullPath } })
  }

  if (isAdminRoute && user.value?.role !== 'admin') {
    return navigateTo(USER_ROUTES.vote)
  }

  if (to.path === USER_ROUTES.login && user.value) {
    return navigateTo(user.value.role === 'admin' ? ADMIN_ROUTES.dashboard : USER_ROUTES.vote)
  }
})
