import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
import '@/interface/styles/main.css'
import OmieInvoiceCell from '@/modules/omie/presentation/OmieInvoiceCell.vue'

createApp({ render: () => h(OmieInvoiceCell, { transactionId: 'qa-description', canIssue: true }) })
  .use(createPinia()).mount('#app')
