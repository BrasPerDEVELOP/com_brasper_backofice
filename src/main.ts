import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VueApexCharts from 'vue3-apexcharts'
import App from './App.vue'
import { router } from '@/interface/router'
import { setAuthCallbacks } from '@/interface/api/client'
import { useAuthStore } from '@modules/auth/presentation/controllers/use_auth_store_controller'
import '@/interface/styles/main.css'

if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    return Promise.all(registrations.map((registration) => registration.unregister()))
  })
  if ('caches' in window) {
    void caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
  }
}

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
  () => {
    useAuthStore().clearSession()
    router.push('/')
  }
)

app.mount('#app')
