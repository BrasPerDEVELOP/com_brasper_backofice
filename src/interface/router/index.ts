import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@modules/auth/presentation/controllers/useAuthStore'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'login',
    component: () => import('@modules/auth/presentation/bodies/LoginView.vue'),
    meta: { public: true }
  },
  { path: '/login', redirect: '/' },
  {
    path: '/app',
    component: () => import('@/interface/layout/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: '/app/dashboard'
      },
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/interface/views/DashboardView.vue'),
        meta: { breadcrumb: 'Inicio > Dashboard' }
      },
      {
        path: 'calculator',
        name: 'calculator',
        component: () => import('@modules/calculator/presentation/bodies/CalculatorView.vue')
      },
      {
        path: 'calculator-demo',
        name: 'calculator-demo',
        component: () => import('@modules/calculator/presentation/bodies/CalculatorView.vue')
      },
      {
        path: 'comisiones',
        name: 'comisiones',
        component: () => import('@modules/comisiones/presentation/bodies/ComisionesView.vue')
      },
      {
        path: 'tasas',
        name: 'tasas',
        component: () => import('@modules/tasas/presentation/bodies/TasasView.vue')
      },
      {
        path: 'perfil',
        name: 'perfil',
        component: () => import('@modules/auth/presentation/bodies/ProfileView.vue')
      }
    ]
  },
  { path: '/dashboard', redirect: '/app/dashboard' },
  { path: '/perfil', redirect: '/app/perfil' },
  { path: '/comisiones', redirect: '/app/comisiones' },
  { path: '/tasas', redirect: '/app/tasas' },
  { path: '/calculator', redirect: '/app/calculator' },
  { path: '/calculator-demo', redirect: '/app/calculator-demo' }
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
