import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@/interface/styles/main.css'
import View from '@/modules/facturacion/presentation/bodies/facturacion_view.vue'

createApp(View).use(createPinia()).mount('#app')
