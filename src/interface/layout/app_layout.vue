<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter, RouterLink, RouterView } from 'vue-router'
import { useAuthStore } from '@modules/auth/presentation/controllers/use_auth_store_controller'
import { Domain } from '@/interface/infrastructure/services'
import { getNavIcon } from './nav_icons'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

async function handleLogout() {
  await authStore.logout()
  router.push('/')
}

const showSidebar = computed(() => route.path.startsWith('/app'))

const navItems = [
  { to: '/app/perfil', label: 'Perfil', icon: 'user' },
  { to: '/app/usuarios', label: 'Usuarios', icon: 'users' },
  { to: '/app/transacciones', label: 'Transacciones', icon: 'transactions' },
  { to: '/app/calculator', label: 'Calculadora', icon: 'calc' },
  { to: '/app/calculator?demo=1', label: 'Calculadora Demo', icon: 'demo' },
  { to: '/app/cuentas', label: 'Cuentas', icon: 'bank' },
  { to: '/app/comisiones', label: 'Comisiones', icon: 'folder' },
  { to: '/app/tasas', label: 'Tasas', icon: 'exchange' }
]

const settingsItem = { to: '/app/tasas', label: 'Configuración', icon: 'settings' }

const breadcrumbs = computed(() => {
  const name = (route.name as string) ?? ''
  const meta = (route.meta?.breadcrumb as string) ?? ''
  if (meta) return meta
  if (name === 'calculator' && route.query.demo === '1') return 'Operaciones > Calculadora Demo'
  const map: Record<string, string> = {
    transacciones: 'Operaciones > Transacciones',
    calculator: 'Operaciones > Calculadora',
    comisiones: 'Comercial > Comisiones',
    cuentas: 'Configuración > Cuentas',
    tasas: 'Configuración > Tasas de cambio',
    perfil: 'Cuenta > Perfil',
    usuarios: 'Cuenta > Usuarios'
  }
  return map[name] ?? 'Panel Brasper'
})

const isActive = (to: string | { path: string; query?: Record<string, string> }) => {
  const path = typeof to === 'string' ? to.split('?')[0] : to.path
  const queryDemo = typeof to === 'string' ? to.includes('demo=1') : to.query?.demo === '1'
  const routeDemo = route.query.demo === '1'
  if (path === '/app/calculator' && queryDemo) return route.path === '/app/calculator' && routeDemo
  if (path === '/app/calculator' && !queryDemo) return route.path === '/app/calculator' && !routeDemo
  return route.path === path || route.path.startsWith(path + '/')
}

const userInitial = computed(() => {
  const email = authStore.user?.email
  if (!email) return '?'
  return (email[0] ?? '?').toUpperCase()
})

const profileImageUrl = computed(() => {
  const img = authStore.user?.profile_image
  if (!img) return ''
  return Domain.mediaUrl(img)
})

const navbarImageError = ref(false)
watch(
  () => authStore.user?.profile_image,
  () => { navbarImageError.value = false }
)
</script>

<template>
  <div class="min-h-screen bg-[#f5f7fa]">
    <!-- Sidebar estrecho con iconos (estilo referencia, colores Brasper) -->
    <aside
      v-if="showSidebar"
      class="fixed inset-y-0 left-0 z-20 w-16 flex flex-col border-r border-[#223160] bg-gradient-to-b from-[#0F123E] via-[#1c284c] to-[#232b4d] shadow-xl"
    >
      <div class="flex h-14 items-center justify-center border-b border-white/10 px-2">
        <img
          src="/images/logo_completo.png"
          alt="Brasper"
          class="h-8 w-auto max-w-full object-contain"
        />
      </div>
      <nav class="flex-1 space-y-1 px-2 py-4">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          :title="item.label"
          :class="[
            'flex h-11 w-11 items-center justify-center rounded-lg transition-all',
            isActive(item.to)
              ? 'bg-gradient-to-br from-[#007aff]/50 to-[#4A52D8]/50 text-white shadow-lg'
              : 'text-[#b9c4ef] hover:bg-white/10 hover:text-white'
          ]"
        >
          <component :is="getNavIcon(item.icon)" class="h-5 w-5 shrink-0" />
        </RouterLink>
      </nav>
      <div class="border-t border-white/10 p-2">
        <RouterLink
          :to="settingsItem.to"
          :title="settingsItem.label"
          :class="[
            'flex h-11 w-11 items-center justify-center rounded-lg transition-all',
            isActive(settingsItem.to)
              ? 'bg-gradient-to-br from-[#007aff]/50 to-[#4A52D8]/50 text-white'
              : 'text-[#b9c4ef] hover:bg-white/10 hover:text-white'
          ]"
        >
          <component :is="getNavIcon(settingsItem.icon)" class="h-5 w-5 shrink-0" />
        </RouterLink>
      </div>
    </aside>

    <main
      :class="[
        'min-h-screen transition-all duration-300',
        showSidebar ? 'ml-16' : 'ml-0'
      ]"
    >
      <!-- Header estilo referencia: branding | breadcrumbs | acciones -->
      <header
        v-if="showSidebar"
        class="sticky top-0 z-10 flex items-center justify-between rounded-b-2xl border-b border-[#d7e3fa] bg-white/95 px-8 py-4 backdrop-blur"
      >
        <div class="flex items-center gap-6">
          <h1 class="text-lg font-bold text-[#232b4d]">Brasper</h1>
          <span class="text-sm text-[#666]">{{ breadcrumbs }}</span>
        </div>
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="flex items-center gap-2 rounded-xl border border-[#5ED6B3]/60 bg-white px-4 py-2.5 text-sm font-medium text-[#066ac9] transition hover:bg-[#5ED6B3]/10"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Exportar
          </button>
          <RouterLink
            to="/app/perfil"
            class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#4A52D8]/30 to-[#007aff]/30 text-sm font-bold text-[#232b4d] transition hover:from-[#4A52D8]/50 hover:to-[#007aff]/50"
          >
            <img
              v-if="profileImageUrl && !navbarImageError"
              :src="profileImageUrl"
              :alt="authStore.user?.name ?? ''"
              class="h-full w-full object-cover"
              @error="navbarImageError = true"
            />
            <span v-else>{{ userInitial }}</span>
          </RouterLink>
          <button
            type="button"
            class="flex h-10 w-10 items-center justify-center rounded-xl text-[#666] transition hover:bg-[#dc3545]/10 hover:text-[#dc3545]"
            title="Salir"
            @click="handleLogout"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      <div class="p-8 lg:p-10">
        <RouterView />
      </div>
    </main>
  </div>
</template>
