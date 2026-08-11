import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VueApexCharts from 'vue3-apexcharts'
import App from './App.vue'
import { router } from '@/interface/router'
import { setAuthCallbacks } from '@/interface/api/client'
import { useAuthStore } from '@modules/auth/presentation/controllers/use_auth_store_controller'
import { purgeLegacySession } from '@modules/auth/infrastructure/purge_legacy_session'
import { env } from '@/interface/config/env'
import '@/interface/styles/main.css'

// Deja la versión (commit) en consola para soporte/depuración.
console.info(
  `Brasper Backoffice ${env.appVersion.flavor} · ${env.appVersion.branch}@${env.appVersion.commit}`
)

if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    return Promise.all(registrations.map((registration) => registration.unregister()))
  })
  if ('caches' in window) {
    void caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
  }
}

// Antes de montar: retira el token y el perfil que dejaron versiones previas.
purgeLegacySession()

const pinia = createPinia()
const app = createApp(App)
app.use(pinia)
app.use(router)
app.use(VueApexCharts)

setAuthCallbacks(
  () => {
    const store = useAuthStore()
    return store.token ?? null
  },
  (token) => useAuthStore().setAccessToken(token),
  () => {
    useAuthStore().clearSession()
    router.push('/')
  }
)

app.mount('#app')
