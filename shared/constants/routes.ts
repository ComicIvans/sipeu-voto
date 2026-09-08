export const ADMIN_ROUTES = {
  dashboard: '/admin',
  users: '/admin/usuarios',
  committees: '/admin/comisiones',
  groups: '/admin/grupos',
  votes: '/admin/votaciones',
} as const

export const USER_ROUTES = {
  vote: '/votar',
  profile: '/perfil',
  login: '/login',
} as const

export const PLENARY_SLUG = 'pleno'
