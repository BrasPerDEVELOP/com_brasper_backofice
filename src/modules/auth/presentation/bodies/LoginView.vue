<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-100">
    <div class="w-full max-w-[400px] rounded-lg bg-white p-8 shadow-md">
      <h1 class="mb-6 text-center text-2xl font-semibold text-slate-800">
        Iniciar sesión
      </h1>
      <form class="flex flex-col gap-4" @submit.prevent="handleLogin">
        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Usuario</label>
          <input
            v-model="username"
            type="text"
            required
            class="w-full rounded border border-slate-300 px-3 py-2 text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">Contraseña</label>
          <input
            v-model="password"
            type="password"
            required
            class="w-full rounded border border-slate-300 px-3 py-2 text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          :disabled="authStore.isLoading"
          class="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {{ authStore.isLoading ? '...' : 'Entrar' }}
        </button>
        <p v-if="authStore.error" class="text-center text-sm text-red-600">
          {{ authStore.error }}
        </p>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { env } from '@/interface/config/env'
import { useAuthStore } from '../controllers/useAuthStore'

const router = useRouter()
const authStore = useAuthStore()

const username = ref(env.username)
const password = ref(env.password)

onMounted(() => {
  if (!username.value) username.value = env.username
  if (!password.value) password.value = env.password
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
    
    console.log('Usuario es admin, redirigiendo a /app/calculator...')
    // Redirigir a la aplicación
    const result = await router.push('/app/calculator')
    console.log('Resultado de router.push:', result)
    console.log('Ruta actual después del push:', router.currentRoute.value.path)
  } catch (error) {
    // Error ya manejado en el store
    console.error('Login error:', error)
  }
}
</script>
