import { createApp, h, ref } from 'vue'
import { createPinia } from 'pinia'
import '@/interface/styles/main.css'
import OmieInvoiceCell from '@/modules/omie/presentation/OmieInvoiceCell.vue'
import InvoiceCell from '@/modules/facturacion/presentation/components/InvoiceCell.vue'
import { billingDateDisabledReason } from '@/modules/facturacion/domain/models'

createApp({
  setup() {
    const date = ref<string | null>('2026-11-23')
    const issued = new URLSearchParams(window.location.search).has('issued')
    const record = issued ? {status: 'issued', total: '10', os_id: 1, nfse_number: '42', error: null} : null
    return () => h('main', [
      h('button', {onClick: () => { date.value = null }}, 'Quitar fecha'),
      h(OmieInvoiceCell, {transactionId: 'qa-date', transactionCode: 'BxP-002749', canIssue: true, record,
        disabledReason: billingDateDisabledReason(date.value, !!record)}),
      h(InvoiceCell, {invoice: null, canIssue: true, disabledReason: billingDateDisabledReason(date.value, false)})
    ])
  }
}).use(createPinia()).mount('#app')
