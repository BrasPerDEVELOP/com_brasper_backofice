import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
import '@/interface/styles/main.css'
import UsuarioCreateFormModal from '@/interface/components/UsuarioCreateFormModal.vue'

createApp({ render: () => h(UsuarioCreateFormModal, { modelValue: true, showRoleField: true }) })
  .use(createPinia()).mount('#app')
