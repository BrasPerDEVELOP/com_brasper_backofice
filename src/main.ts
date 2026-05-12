import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from '@/interface/router'
import { setAuthCallbacks } from '@/interface/api/client'
import { useAuthStore } from '@modules/auth/presentation/controllers/use_auth_store_controller'
import '@/interface/styles/main.css'

const pinia = createPinia()
const app = createApp(App)
app.use(pinia)
app.use(router)

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
