import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@modules/auth/presentation/controllers/use_auth_store_controller'

function firstPermittedAppPath(authStore: ReturnType<typeof useAuthStore>): string {
  const candidates = [
    { path: '/app/dashboard', permission: 'dashboard.view' },
    { path: '/app/metricas', permission: 'metrics.view' },
    { path: '/app/usuarios', permissions: ['users.view', 'bank_accounts.view'] },
    { path: '/app/transacciones', permission: 'transactions.view' },
    { path: '/app/contabilidad', permission: 'accounting.view' },
    { path: '/app/calculator', permission: 'calculator.view' },
    { path: '/app/cupones', permission: 'coupons.view' },
    { path: '/app/comisiones', permission: 'commissions.view' },
    { path: '/app/tasas', permission: 'rates.view' },
    { path: '/app/cuentas-brasper', permission: 'company_bank_accounts.view' },
    { path: '/app/home-banner', permission: 'home_banner.view' },
    { path: '/app/blog', permission: 'blog.view' },
    { path: '/app/roles-permisos', permission: 'roles.permissions.view' },
    { path: '/app/perfil', permission: 'profile.view' }
  ]
  return candidates.find((item) => {
    if ('permissions' in item && item.permissions) {
      return item.permissions.some((permission) => authStore.hasPermission(permission))
    }
    return 'permission' in item && typeof item.permission === 'string'
      ? authStore.hasPermission(item.permission)
      : false
  })?.path ?? '/app/perfil'
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'login',
    component: () => import('@modules/auth/presentation/bodies/login_view.vue'),
    meta: { public: true }
  },
  { path: '/login', redirect: '/' },
  {
    path: '/app',
    component: () => import('@/interface/layout/app_layout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: '/app/dashboard'
      },
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@modules/dashboard/presentation/bodies/dashboard_view.vue'),
        meta: { breadcrumb: 'Panel > Resumen', permission: 'dashboard.view' }
      },
      {
        path: 'metricas',
        name: 'metricas',
        component: () => import('@modules/metrics/presentation/bodies/metrics_view.vue'),
        meta: { breadcrumb: 'Panel > Métricas', permission: 'metrics.view' }
      },
      {
        path: 'transacciones',
        name: 'transacciones',
        component: () => import('@modules/transacciones/presentation/bodies/transacciones_view.vue'),
        meta: { breadcrumb: 'Operaciones > Transacciones', permission: 'transactions.view' }
      },
      {
        path: 'contabilidad',
        name: 'contabilidad',
        component: () => import('@modules/contabilidad/presentation/bodies/contabilidad_view.vue'),
        meta: { breadcrumb: 'Operaciones > Contabilidad', permission: 'accounting.view' }
      },
      {
        path: 'calculator',
        name: 'calculator',
        component: () => import('@modules/calculator/presentation/bodies/calculator_view.vue'),
        meta: { breadcrumb: 'Operaciones > Calculadora', permission: 'calculator.view' }
      },
      {
        path: 'cupones',
        name: 'cupones',
        component: () => import('@modules/cupones/presentation/bodies/cupones_view.vue'),
        meta: { breadcrumb: 'Operaciones > Cupones', permission: 'coupons.view' }
      },
      {
        path: 'comisiones',
        name: 'comisiones',
        component: () => import('@modules/comisiones/presentation/bodies/comisiones_view.vue'),
        meta: { permission: 'commissions.view' }
      },
      {
        path: 'cuentas',
        name: 'cuentas',
        redirect: (to) => ({
          path: '/app/usuarios',
          query: { ...to.query, tab: 'accounts' },
          replace: true
        })
      },
      {
        path: 'tasas',
        name: 'tasas',
        component: () => import('@modules/tasas/presentation/bodies/tasas_view.vue'),
        meta: { permission: 'rates.view' }
      },
      {
        path: 'cuentas-brasper',
        name: 'cuentas-brasper',
        component: () => import('@modules/cuentas-bancarias/presentation/bodies/cuentas_brasper_view.vue'),
        meta: {
          breadcrumb: 'Configuración > Cuentas Brasper',
          permission: 'company_bank_accounts.view'
        }
      },
      {
        path: 'home-banner',
        name: 'home-banner',
        component: () => import('@modules/home-banner/presentation/bodies/banner_view.vue'),
        meta: { breadcrumb: 'Configuración > Banner Home', permission: 'home_banner.view' }
      },
      {
        path: 'blog',
        name: 'blog',
        component: () => import('@modules/blog/presentation/bodies/blog_view.vue'),
        meta: { breadcrumb: 'Configuración > Blog', permission: 'blog.view' }
      },
      {
        path: 'roles-permisos',
        name: 'roles-permisos',
        component: () => import('@modules/auth/presentation/bodies/roles_permissions_view.vue'),
        meta: { breadcrumb: 'Configuración > Permisos de roles', permission: 'roles.permissions.view' }
      },
      {
        path: 'perfil',
        name: 'perfil',
        component: () => import('@modules/auth/presentation/bodies/profile_view.vue'),
        meta: { breadcrumb: 'Cuenta > Perfil', permission: 'profile.view' }
      },
      {
        path: 'usuarios',
        name: 'usuarios',
        component: () => import('@modules/auth/presentation/bodies/usuarios_view.vue'),
        meta: {
          breadcrumb: 'Cuenta > Usuarios y cuentas',
          permissionAny: ['users.view', 'bank_accounts.view']
        }
      }
    ]
  },
  { path: '/transacciones', redirect: '/app/transacciones' },
  { path: '/perfil', redirect: '/app/perfil' },
  { path: '/usuarios', redirect: '/app/usuarios' },
  { path: '/comisiones', redirect: '/app/comisiones' },
  { path: '/cuentas', redirect: (to) => ({ path: '/app/usuarios', query: { ...to.query, tab: 'accounts' } }) },
  { path: '/tasas', redirect: '/app/tasas' },
  { path: '/cuentas-brasper', redirect: '/app/cuentas-brasper' },
  { path: '/home-banner', redirect: '/app/home-banner' },
  { path: '/blog', redirect: '/app/blog' },
  { path: '/roles-permisos', redirect: '/app/roles-permisos' },
  { path: '/calculator', redirect: '/app/calculator' },
  { path: '/cupones', redirect: '/app/cupones' },
  { path: '/contabilidad', redirect: '/app/contabilidad' },
  { path: '/dashboard', redirect: '/app/dashboard' },
  { path: '/metricas', redirect: '/app/metricas' },
  { path: '/calculator-demo', redirect: { path: '/app/calculator', hash: '#calculator-demo' } }
]

export const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to) => {
  if (to.path === '/app/calculator' && to.query.demo === '1') {
    return { path: '/app/calculator', query: {}, hash: '#calculator-demo', replace: true }
  }

  const authStore = useAuthStore()

  if (to.meta.public) {
    return true
  }
  
  if (to.meta.requiresAuth) {
    authStore.restoreUser()

    if (!authStore.token) {
      return { path: '/' }
    }

    if (!authStore.user) {
      await authStore.logout()
      return { path: '/' }
    }

    // B1 (Fase B) — el rol `client` (o cuentas sin permisos de backoffice) se
    // bloquea también cuando la sesión se restaura desde localStorage, no solo
    // en el login. Preservamos el motivo para mostrarlo en la pantalla de login.
    if (!authStore.validateBackofficeAccess()) {
      const reason = authStore.error
      await authStore.logout()
      authStore.setError(reason)
      return { path: '/' }
    }

    const permission = to.meta.permission
    if (typeof permission === 'string' && !authStore.hasPermission(permission)) {
      return { path: firstPermittedAppPath(authStore), replace: true }
    }
    const permissionAny = to.meta.permissionAny
    if (
      Array.isArray(permissionAny) &&
      !permissionAny.some((item) => typeof item === 'string' && authStore.hasPermission(item))
    ) {
      return { path: firstPermittedAppPath(authStore), replace: true }
    }
  }
  
  return true
})
