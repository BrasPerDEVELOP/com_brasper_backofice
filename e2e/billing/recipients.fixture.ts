import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
import '@/interface/styles/main.css'
import { useAuthStore } from '@/modules/auth/presentation/controllers/use_auth_store_controller'
import InvoiceDetailDialog from '@/modules/facturacion/presentation/components/InvoiceDetailDialog.vue'

const pinia = createPinia()
useAuthStore(pinia).user = { role: 'admin', permissions: ['billing.view', 'billing.issue'] } as never
createApp({ render: () => h(InvoiceDetailDialog, { modelValue: true, invoiceId: 'qa-invoice' }) })
  .use(pinia).mount('#app')
