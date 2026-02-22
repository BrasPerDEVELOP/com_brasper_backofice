import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@modules/auth/presentation/controllers/use_auth_store_controller'

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
        redirect: '/app/transacciones'
      },
      {
        path: 'transacciones',
        name: 'transacciones',
        component: () => import('@modules/transacciones/presentation/bodies/transacciones_view.vue'),
        meta: { breadcrumb: 'Operaciones > Transacciones' }
      },
      {
        path: 'calculator',
        name: 'calculator',
        component: () => import('@modules/calculator/presentation/bodies/calculator_view.vue'),
        meta: { breadcrumb: 'Operaciones > Calculadora' }
      },
      {
        path: 'comisiones',
        name: 'comisiones',
        component: () => import('@modules/comisiones/presentation/bodies/comisiones_view.vue')
      },
      {
        path: 'cuentas',
        name: 'cuentas',
        component: () => import('@modules/cuentas-bancarias/presentation/bodies/cuentas_bancarias_view.vue')
      },
      {
        path: 'tasas',
        name: 'tasas',
        component: () => import('@modules/tasas/presentation/bodies/tasas_view.vue')
      },
      {
        path: 'perfil',
        name: 'perfil',
        component: () => import('@modules/auth/presentation/bodies/profile_view.vue')
      }
    ]
  },
  { path: '/transacciones', redirect: '/app/transacciones' },
  { path: '/perfil', redirect: '/app/perfil' },
  { path: '/comisiones', redirect: '/app/comisiones' },
  { path: '/cuentas', redirect: '/app/cuentas' },
  { path: '/tasas', redirect: '/app/tasas' },
  { path: '/calculator', redirect: '/app/calculator' },
  { path: '/calculator-demo', redirect: { path: '/app/calculator', query: { demo: '1' } } }
]

export const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  
  if (import.meta.env.DEV) {
    console.log('Router guard - Navegando a:', to.path, 'Meta:', to.meta)
  }
  
  if (to.meta.public) {
    if (import.meta.env.DEV) {
      console.log('Ruta pública, permitiendo acceso')
    }
    return true
  }
  
  if (to.meta.requiresAuth) {
    if (import.meta.env.DEV) {
      console.log('Ruta requiere autenticación, verificando...')
    }
    
    authStore.restoreUser()
    
    if (import.meta.env.DEV) {
      console.log('Después de restoreUser:', {
        token: authStore.token ? 'existe' : 'no existe',
        user: authStore.user ? { id: authStore.user.id, role: authStore.user.role } : null
      })
    }
    
    if (!authStore.token) {
      if (import.meta.env.DEV) {
        console.log('No hay token, redirigiendo a login')
      }
      return { path: '/' }
    }
    
    // Verificar que el usuario tenga rol 'admin'
    const user = authStore.user
    if (!user || user.role !== 'admin') {
      // Si no es admin, cerrar sesión y redirigir al login
      if (import.meta.env.DEV) {
        console.warn('Acceso denegado: usuario sin rol admin', { 
          user: user ? { id: user.id, role: user.role } : null,
          isAdmin: authStore.isAdmin
        })
      }
      await authStore.logout()
      return { path: '/' }
    }
    
    if (import.meta.env.DEV) {
      console.log('Usuario autenticado y es admin, permitiendo acceso')
    }
  }
  
  return true
})
