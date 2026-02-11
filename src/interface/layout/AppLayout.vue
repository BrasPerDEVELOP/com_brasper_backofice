<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter, RouterLink, RouterView } from 'vue-router'
import { useAuthStore } from '@modules/auth/presentation/controllers/useAuthStore'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

async function handleLogout() {
  await authStore.logout()
  router.push('/')
}

const showSidebar = computed(() => route.path.startsWith('/app'))

const navItems = [
  { to: '/app/calculator', label: 'Calculadora', icon: '🧮' },
  { to: '/app/calculator-demo', label: 'Calculadora Demo', icon: '🔬' },
  { to: '/app/comisiones', label: 'Comisiones', icon: '💰' },
  { to: '/app/tasas', label: 'Tasas', icon: '📊' }
]

const isActive = (path: string) => route.path === path || route.path.startsWith(path + '/')
</script>

<template>
  <div class="flex min-h-screen bg-slate-100">
    <!-- Sidebar: solo en rutas /app -->
    <aside
      v-if="showSidebar"
      class="fixed inset-y-0 left-0 z-20 w-56 flex flex-col border-r border-slate-200 bg-white shadow-sm"
    >
      <div class="flex h-14 items-center border-b border-slate-200 px-4">
        <span class="text-lg font-semibold text-slate-800">Backoffice</span>
      </div>
      <nav class="flex-1 space-y-0.5 p-3">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          :class="[
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            isActive(item.to)
              ? 'bg-blue-50 text-blue-700'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          ]"
        >
          <span class="text-lg" aria-hidden="true">{{ item.icon }}</span>
          {{ item.label }}
        </RouterLink>
      </nav>
      <div class="border-t border-slate-200 p-3">
        <div class="rounded-lg px-3 py-2 text-sm text-slate-500">
          {{ authStore.user?.email ?? 'No logueado' }}
        </div>
        <button
          type="button"
          class="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          @click="handleLogout"
        >
          Salir
        </button>
      </div>
    </aside>

    <!-- Contenido principal -->
    <main
      :class="[
        'flex-1 transition-all duration-200',
        showSidebar ? 'ml-56' : 'ml-0'
      ]"
    >
      <div class="p-6">
        <RouterView />
      </div>
    </main>
  </div>
</template>
