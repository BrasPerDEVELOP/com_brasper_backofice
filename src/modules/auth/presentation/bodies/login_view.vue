<template>
  <div
    class="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_15%_20%,_rgba(64,196,255,0.28),_transparent_35%),radial-gradient(circle_at_85%_10%,_rgba(63,81,181,0.2),_transparent_38%),linear-gradient(to_bottom,_#f9f9f9,_#f3f4f6)] px-4 py-8"
  >
    <div class="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-[#d8e5fb] bg-white shadow-2xl lg:grid-cols-2">
      <!-- Panel izquierdo: branding -->
      <div
        class="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brasper-darkDeep via-brasper-dark to-brasper-indigoStrong p-10 text-white lg:flex"
      >
        <!-- Formas decorativas -->
        <div class="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rotate-45 rounded-3xl bg-white/[0.04]"></div>
        <div class="pointer-events-none absolute -bottom-10 right-10 h-56 w-56 rotate-45 rounded-3xl bg-brasper-indigo/20"></div>

        <div class="relative z-10">
          <div class="flex items-center gap-3">
            <span class="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brasper-cyanLight to-brasper-indigoStrong shadow-lg shadow-brasper-indigoStrong/40">
              <svg class="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            <span class="text-sm font-semibold uppercase tracking-[0.3em] text-white/90">Brasper</span>
          </div>

          <h2 class="mt-16 text-4xl font-bold leading-tight">
            Backoffice
            <span class="mt-1 block text-[#8ea3ff]">Administración central</span>
          </h2>
          <p class="mt-5 max-w-xs text-sm leading-relaxed text-[#c9d3fb]">
            Controla tasas, comisiones y operaciones desde un panel seguro y moderno.
          </p>
        </div>

        <ul class="relative z-10 mt-16 space-y-3 text-sm text-[#c9d3fb]">
          <li class="flex items-center gap-2.5">
            <svg class="h-4 w-4 shrink-0 text-brasper-cyanLight" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            Conexión cifrada de extremo a extremo
          </li>
          <li class="flex items-center gap-2.5">
            <svg class="h-4 w-4 shrink-0 text-brasper-cyanLight" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="7.5" cy="15.5" r="4.5" />
              <path d="m10.7 12.3 8.6-8.6M17 5l2 2M15 7l2 2" />
            </svg>
            Acceso segmentado por roles
          </li>
        </ul>
      </div>

      <!-- Panel derecho: formulario -->
      <div class="flex flex-col p-8 md:p-10">
        <p class="mb-6 text-right text-sm text-brasper-textSoft">
          ¿Problemas para entrar?
          <a :href="supportMailto" class="font-medium text-brasper-indigoStrong hover:underline">Contacta a soporte</a>
        </p>

        <div class="mb-8">
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-brasper-indigoStrong">Acceso seguro</p>
          <h1 class="mt-2 text-3xl font-bold text-brasper-dark">Iniciar sesión</h1>
          <p class="mt-2 text-sm text-brasper-textSoft">
            Ingresa con tu cuenta del equipo Brasper (admin, asesores u otros roles con permiso).
          </p>
        </div>

        <form class="flex flex-col gap-5" @submit.prevent="handleLogin">
          <div>
            <label for="login-username" class="mb-1.5 block text-sm font-medium text-brasper-text">Usuario</label>
            <div class="relative">
              <span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-brasper-textSoft">
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-10 6L2 7" />
                </svg>
              </span>
              <input
                id="login-username"
                v-model="username"
                type="text"
                required
                autocomplete="username"
                placeholder="tu@correo.com"
                class="w-full rounded-xl border border-[#cfdbef] bg-white py-2.5 pl-10 pr-3 text-brasper-text outline-none transition placeholder:text-[#aab4c8] focus:border-brasper-indigoStrong focus:ring-4 focus:ring-brasper-indigoStrong/20"
              />
            </div>
          </div>

          <div>
            <label for="login-password" class="mb-1.5 block text-sm font-medium text-brasper-text">Contraseña</label>
            <div class="relative">
              <span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-brasper-textSoft">
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                id="login-password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                required
                autocomplete="current-password"
                class="w-full rounded-xl border border-[#cfdbef] bg-white py-2.5 pl-10 pr-24 text-brasper-text outline-none transition focus:border-brasper-indigoStrong focus:ring-4 focus:ring-brasper-indigoStrong/20"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 flex items-center gap-1.5 pr-3 text-sm text-brasper-textSoft transition hover:text-brasper-indigoStrong"
                :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                @click="showPassword = !showPassword"
              >
                <svg v-if="!showPassword" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <svg v-else class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                  <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                  <path d="m2 2 20 20M9.88 9.88a3 3 0 0 0 4.24 4.24" />
                </svg>
                {{ showPassword ? 'Ocultar' : 'Mostrar' }}
              </button>
            </div>
          </div>

          <div class="flex items-center justify-between">
            <label class="flex cursor-pointer select-none items-center gap-2 text-sm text-brasper-text">
              <input
                v-model="rememberSession"
                type="checkbox"
                class="h-4 w-4 rounded border-[#cfdbef] text-brasper-indigoStrong focus:ring-brasper-indigoStrong/30"
              />
              Recordar sesión
            </label>
            <button
              type="button"
              class="text-sm font-medium text-brasper-indigoStrong hover:underline"
              @click="showForgotHint = true"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          <p v-if="showForgotHint" class="rounded-lg bg-brasper-indigoStrong/10 px-3 py-2 text-sm text-brasper-indigoStrong">
            Contacta a un administrador para restablecer tu contraseña.
          </p>

          <button
            type="submit"
            :disabled="isBusy"
            class="mt-1 w-full rounded-xl bg-gradient-to-r from-[#4361EE] via-brasper-indigoStrong to-[#4B2FC4] px-4 py-3 font-semibold text-white shadow-lg shadow-brasper-indigoStrong/30 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {{ authStore.isLoading ? 'Ingresando...' : 'Entrar al panel' }}
          </button>

          <p v-if="authStore.error" class="rounded-lg bg-brasper-danger/10 px-3 py-2 text-center text-sm text-brasper-danger">
            {{ authStore.error }}
          </p>

          <p class="flex items-center justify-center gap-1.5 text-xs text-brasper-textSoft">
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Conexión protegida · SSL 256-bit
          </p>
        </form>

        <template v-if="hasSocialLogin">
          <div class="my-6 flex items-center gap-3">
            <span class="h-px flex-1 bg-[#e5e7eb]"></span>
            <span class="text-xs uppercase tracking-[0.2em] text-brasper-textSoft">o continúa con</span>
            <span class="h-px flex-1 bg-[#e5e7eb]"></span>
          </div>

          <div class="flex flex-col gap-3">
            <!--
              Login con Facebook desactivado. Para reactivarlo hay que descomentar
              también su bloque en el <script setup> (import, refs, callback y handler).
            <button
              v-if="isFacebookEnabled"
              type="button"
              :disabled="isBusy"
              class="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#1877F2] px-4 py-3 font-semibold text-white shadow-lg shadow-[#1877F2]/25 transition hover:bg-[#166FE5] disabled:cursor-not-allowed disabled:opacity-50"
              @click="handleFacebookLogin"
            >
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.412c0-3.017 1.792-4.684 4.533-4.684 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.93-1.956 1.887v2.27h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
              </svg>
              {{ isFacebookProcessing ? 'Validando con Facebook...' : 'Iniciar sesión con Facebook' }}
            </button>
            -->

            <button
              v-if="isGoogleEnabled"
              type="button"
              :disabled="isBusy"
              class="flex w-full items-center justify-center gap-2.5 rounded-xl border border-[#dadce0] bg-white px-4 py-3 font-semibold text-[#3c4043] shadow-sm transition hover:bg-[#f8f9fa] disabled:cursor-not-allowed disabled:opacity-50"
              @click="handleGoogleLogin"
            >
              <svg class="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              {{ isGoogleProcessing ? 'Validando con Google...' : 'Iniciar sesión con Google' }}
            </button>
          </div>

          <p class="mt-2 text-center text-xs text-brasper-textSoft">
            Tu cuenta debe estar vinculada a un usuario del backoffice.
          </p>
        </template>

        <footer class="mt-8 text-center text-xs text-brasper-textSoft">
          © {{ currentYear }} Brasper &nbsp;•&nbsp; Términos &nbsp;•&nbsp; Privacidad
          <span class="mt-1 block text-[10px] text-brasper-textSoft/70">{{ appVersion }}</span>
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { env } from '@/interface/config/env'
import { useAuthStore } from '../controllers/use_auth_store_controller'
import { useGoogleLogin } from '../composables/use_google_login'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
// const {
//   isEnabled: isFacebookEnabled,
//   startLogin: startFacebookLogin,
//   hasPendingCallback: hasFacebookCallback,
//   processFromQuery: processFacebookCallback
// } = useFacebookLogin()
const {
  isEnabled: isGoogleEnabled,
  startLogin: startGoogleLogin,
  hasPendingCallback: hasGoogleCallback,
  processFromQuery: processGoogleCallback
} = useGoogleLogin()

const username = ref(env.username)
const password = ref(env.password)
// const isFacebookProcessing = ref(false)
const isGoogleProcessing = ref(false)
const showPassword = ref(false)
const rememberSession = ref(true)
const showForgotHint = ref(false)

const isBusy = computed(() => authStore.isLoading || isGoogleProcessing.value)
const hasSocialLogin = computed(() => isGoogleEnabled.value)

const currentYear = new Date().getFullYear()
const supportMailto = 'mailto:soporte@brasper.com?subject=Ayuda%20para%20acceder%20al%20backoffice'
/** Versión (commit) para soporte: qué build está corriendo el usuario. */
const appVersion = env.appVersion.flavor

/** Cierra el flujo de Google: la vuelta del diálogo trae el `code` en la query. */
async function tryGoogleCallback() {
  const query = new URLSearchParams(window.location.search)
  if (!hasGoogleCallback(query)) return

  isGoogleProcessing.value = true
  authStore.setError(null)
  try {
    const success = await processGoogleCallback(query)
    if (success) {
      await router.replace('/app/transacciones')
      return
    }
  } catch (error) {
    authStore.clearSession()
    authStore.setError(
      error instanceof Error ? error.message : 'No se pudo iniciar sesión con Google.'
    )
  } finally {
    isGoogleProcessing.value = false
  }

  await router.replace({ path: route.path, query: {} })
}

onMounted(() => {
  if (!username.value) username.value = env.username
  if (!password.value) password.value = env.password
  void (async () => {
    if (!authStore.isAuthenticated) await tryGoogleCallback()
  })()
})

/** Entra al panel si la cuenta tiene acceso; si no, cierra sesión y deja el motivo visible. */
async function enterPanel(): Promise<boolean> {
  if (!authStore.validateBackofficeAccess()) {
    const reason = authStore.error
    await authStore.logout()
    authStore.setError(reason)
    return false
  }
  await router.push('/app/transacciones')
  return true
}

const handleLogin = async () => {
  try {
    await authStore.login(username.value, password.value)
    await enterPanel()
    await enterPanel()
  } catch {
    // Error ya manejado en el store
  }
}

/*
const handleFacebookLogin = () => {
  authStore.setError(null)
  try {
    startFacebookLogin()
  } catch (error) {
    authStore.setError(
      error instanceof Error ? error.message : 'No se pudo abrir el inicio con Facebook.'
    )
  }
}
*/

const handleGoogleLogin = () => {
  authStore.setError(null)
  try {
    startGoogleLogin()
  } catch (error) {
    authStore.setError(
      error instanceof Error ? error.message : 'No se pudo abrir el inicio con Google.'
    )
  }
}
</script>
