<template>
  <div
    class="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_15%_20%,_rgba(163,134,255,0.28),_transparent_35%),radial-gradient(circle_at_85%_10%,_rgba(0,123,255,0.22),_transparent_38%),linear-gradient(to_bottom,_#f9f9f9,_#f3f4f6)] px-4 py-8"
  >
    <div class="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-[#d8e5fb] bg-white shadow-2xl lg:grid-cols-2">
      <div class="hidden bg-gradient-to-br from-[#0F123E] via-[#232b4d] to-[#4A52D8] p-10 text-white lg:block">
        <p class="text-xs font-semibold uppercase tracking-[0.3em] text-[#e6ff00]">Brasper</p>
        <h2 class="mt-3 text-3xl font-semibold leading-tight">
          Backoffice
          <span class="block text-[#5ED6B3]">Administración central</span>
        </h2>
        <p class="mt-5 max-w-xs text-sm text-[#d3dcfb]">
          Controla tasas, comisiones y operaciones desde un panel seguro y moderno.
        </p>
      </div>

      <div class="p-8 md:p-10">
        <div class="mb-8">
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#066ac9]">Acceso seguro</p>
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
              class="w-full rounded-xl border border-[#cfdbef] bg-white px-3 py-2.5 text-[#333] outline-none transition focus:border-[#007bff] focus:ring-4 focus:ring-[#007bff]/20"
            />
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-[#333]">Contraseña</label>
            <input
              v-model="password"
              type="password"
              required
              class="w-full rounded-xl border border-[#cfdbef] bg-white px-3 py-2.5 text-[#333] outline-none transition focus:border-[#007bff] focus:ring-4 focus:ring-[#007bff]/20"
            />
          </div>

          <button
            type="submit"
            :disabled="authStore.isLoading || isSsoProcessing"
            class="mt-2 w-full rounded-xl bg-gradient-to-r from-[#007bff] to-[#3b82f6] px-4 py-2.5 font-semibold text-white shadow-lg shadow-[#007bff]/30 transition hover:from-[#007aff] hover:to-[#4484f3] disabled:opacity-50"
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
import { useAuthStore } from '../controllers/useAuthStore'
import { useAdminSso } from '../composables/useAdminSso'

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
  authStore.error = null
  try {
    const success = await processFromQuery(query)
    if (success) {
      await router.replace('/app/transacciones')
      return
    }
  } catch (error) {
    authStore.clearSession()
    authStore.error = error instanceof Error ? error.message : 'SSO inválido o expirado.'
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
    console.log('Iniciando login...')
    await authStore.login(username.value, password.value)
    
    console.log('Login completado, verificando usuario...')
    console.log('Usuario en store:', authStore.user)
    console.log('Token en store:', authStore.token ? 'existe' : 'no existe')
    
    // Verificar que el usuario tenga rol 'admin' antes de redirigir
    // Usar el usuario del store después del login
    const user = authStore.user
    console.log('Usuario verificado:', user)
    console.log('Rol del usuario:', user?.role)
    console.log('isAdmin getter:', authStore.isAdmin)
    
    // Verificar también desde localStorage para asegurar consistencia
    const storedUser = localStorage.getItem('auth_user')
    console.log('Usuario en localStorage:', storedUser)
    
    if (!user) {
      console.error('No hay usuario después del login')
      authStore.error = 'Error: No se pudo obtener información del usuario'
      return
    }
    
    if (user.role !== 'admin') {
      console.warn('Usuario sin rol admin:', user.role)
      authStore.error = 'Solo usuarios con rol admin pueden acceder'
      await authStore.logout()
      return
    }
    
    console.log('Usuario es admin, redirigiendo a /app/transacciones...')
    // Redirigir a la aplicación
    const result = await router.push('/app/transacciones')
    console.log('Resultado de router.push:', result)
    console.log('Ruta actual después del push:', router.currentRoute.value.path)
  } catch (error) {
    // Error ya manejado en el store
    console.error('Login error:', error)
  }
}
</script>
