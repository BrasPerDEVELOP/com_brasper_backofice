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
  { to: '/app/calculator', label: 'Calculadora', icon: 'CA' },
  { to: '/app/calculator-demo', label: 'Calculadora Demo', icon: 'DE' },
  { to: '/app/comisiones', label: 'Comisiones', icon: 'CO' },
  { to: '/app/tasas', label: 'Tasas', icon: 'TA' }
]

const isActive = (path: string) => route.path === path || route.path.startsWith(path + '/')
</script>

<template>
  <div
    class="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(163,134,255,0.22),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(0,123,255,0.20),_transparent_35%),linear-gradient(to_bottom,_#f9f9f9,_#f3f4f6)]"
  >
    <aside
      v-if="showSidebar"
      class="fixed inset-y-0 left-0 z-20 w-64 border-r border-[#223160] bg-gradient-to-b from-[#0F123E] via-[#1c284c] to-[#232b4d] text-white shadow-2xl"
    >
      <div class="border-b border-white/10 px-5 py-5">
        <p class="text-xs font-semibold uppercase tracking-[0.25em] text-[#A386FF]">Brasper</p>
        <p class="mt-1 text-xl font-semibold text-white">Backoffice</p>
        <p class="mt-1 text-xs text-[#b9c4ef]">Gestión administrativa</p>
      </div>
      <nav class="flex-1 space-y-1 px-3 py-4">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          :class="[
            'flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all',
            isActive(item.to)
              ? 'border-[#5ED6B3]/60 bg-gradient-to-r from-[#007aff]/45 to-[#4A52D8]/45 text-white'
              : 'border-transparent text-[#c2cff5] hover:border-[#4484f3]/35 hover:bg-[#007aff]/20 hover:text-white'
          ]"
        >
          <span
            class="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-[11px] font-bold tracking-wide text-[#e6ff00]"
            aria-hidden="true"
          >
            {{ item.icon }}
          </span>
          {{ item.label }}
        </RouterLink>
      </nav>
      <div class="border-t border-white/10 p-3">
        <div class="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-[#d3dcfb]">
          {{ authStore.user?.email ?? 'No logueado' }}
        </div>
        <button
          type="button"
          class="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-[#dc3545]/40 bg-[#dc3545]/15 px-3 py-2 text-sm font-medium text-[#ffd6db] transition hover:bg-[#dc3545]/25"
          @click="handleLogout"
        >
          Salir
        </button>
      </div>
    </aside>

    <main
      :class="[
        'min-h-screen transition-all duration-300',
        showSidebar ? 'ml-64' : 'ml-0'
      ]"
    >
      <header
        v-if="showSidebar"
        class="sticky top-0 z-10 border-b border-[#d7e3fa] bg-white/85 px-6 py-3 backdrop-blur"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#066ac9]">Panel Brasper</p>
            <p class="text-sm text-[#555]">Operaciones y configuración</p>
          </div>
          <span class="rounded-full bg-[#e6ff00] px-3 py-1 text-xs font-semibold text-[#232b4d]">
            ADMIN
          </span>
        </div>
      </header>

      <div class="p-6 lg:p-8">
        <RouterView />
      </div>
    </main>
  </div>
</template>
