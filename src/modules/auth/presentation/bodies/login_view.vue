<template>
  <div
    class="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_15%_20%,_rgba(64,196,255,0.28),_transparent_35%),radial-gradient(circle_at_85%_10%,_rgba(63,81,181,0.2),_transparent_38%),linear-gradient(to_bottom,_#f9f9f9,_#f3f4f6)] px-4 py-8"
  >
    <div class="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-[#d8e5fb] bg-white shadow-2xl lg:grid-cols-2">
      <div class="hidden bg-gradient-to-br from-[#0F123E] via-[#232b4d] to-brasper-indigoStrong p-10 text-white lg:block">
        <p class="text-xs font-semibold uppercase tracking-[0.3em] text-brasper-cyanLight">Brasper</p>
        <h2 class="mt-3 text-3xl font-semibold leading-tight">
          Backoffice
          <span class="block text-brasper-indigo">Administración central</span>
        </h2>
        <p class="mt-5 max-w-xs text-sm text-[#d3dcfb]">
          Controla tasas, comisiones y operaciones desde un panel seguro y moderno.
        </p>
      </div>

      <div class="p-8 md:p-10">
        <div class="mb-8">
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-brasper-indigoStrong">Acceso seguro</p>
          <h1 class="mt-2 text-3xl font-semibold text-[#232b4d]">Iniciar sesión</h1>
          <p class="mt-2 text-sm text-[#666]">Ingresa con tu cuenta de administrador de Brasper.</p>
        </div>

        <form class="flex flex-col gap-5" @submit.prevent="handleLogin">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-[#333]">Usuario</label>
            <input
              v-model="username"
              type="text"
              required
              class="w-full rounded-xl border border-[#cfdbef] bg-white px-3 py-2.5 text-[#333] outline-none transition focus:border-brasper-indigoStrong focus:ring-4 focus:ring-brasper-indigoStrong/20"
            />
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-[#333]">Contraseña</label>
            <input
              v-model="password"
              type="password"
              required
              class="w-full rounded-xl border border-[#cfdbef] bg-white px-3 py-2.5 text-[#333] outline-none transition focus:border-brasper-indigoStrong focus:ring-4 focus:ring-brasper-indigoStrong/20"
            />
          </div>

          <button
            type="submit"
            :disabled="authStore.isLoading || isSsoProcessing"
            class="mt-2 w-full rounded-xl bg-gradient-to-r from-brasper-cyanLight to-brasper-indigoStrong px-4 py-2.5 font-semibold text-white shadow-lg shadow-brasper-indigoStrong/25 transition hover:opacity-95 disabled:opacity-50"
          >
            {{ isSsoProcessing ? 'Validando SSO...' : authStore.isLoading ? 'Ingresando...' : 'Entrar al panel' }}
          </button>

          <p v-if="authStore.error" class="rounded-lg bg-[#dc3545]/10 px-3 py-2 text-center text-sm text-[#dc3545]">
            {{ authStore.error }}
          </p>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { env } from '@/interface/config/env'
import { useAuthStore } from '../controllers/use_auth_store_controller'
import { useAdminSso } from '../composables/use_admin_sso'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { processFromQuery } = useAdminSso()

const username = ref(env.username)
const password = ref(env.password)
const isSsoProcessing = ref(false)

async function tryAdminSsoLogin() {
  const query = new URLSearchParams(window.location.search)
  const hasSsoSignal = ['data', 'iv', 'salt', 'v'].some((key) => query.has(key))
  if (!hasSsoSignal) return

  isSsoProcessing.value = true
  authStore.setError(null)
  try {
    const success = await processFromQuery(query)
    if (success) {
      await router.replace('/app/transacciones')
      return
    }
  } catch (error) {
    authStore.clearSession()
    authStore.setError(error instanceof Error ? error.message : 'SSO inválido o expirado.')
  } finally {
    isSsoProcessing.value = false
  }

  await router.replace({ path: route.path, query: {} })
}

onMounted(() => {
  if (!username.value) username.value = env.username
  if (!password.value) password.value = env.password
  void tryAdminSsoLogin()
})

const handleLogin = async () => {
  try {
    await authStore.login(username.value, password.value)
    if (!authStore.validateAdminAccess()) {
      if (authStore.user && authStore.user.role !== 'admin') {
        await authStore.logout()
      }
      return
    }
    await router.push('/app/transacciones')
  } catch {
    // Error ya manejado en el store
  }
}
</script>
