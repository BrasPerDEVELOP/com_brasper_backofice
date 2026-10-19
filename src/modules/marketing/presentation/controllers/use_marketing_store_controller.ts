import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { marketingActions } from '../../application/use_cases/marketing'
import { MarketingApiAdapter } from '../../infrastructure/marketing_api_adapter'
import type { Campaign, CampaignInput, Recipient } from '../../domain/models'
const actions = marketingActions(new MarketingApiAdapter())
export const useMarketingStore = defineStore('marketing', () => {
  const campaigns = ref<Campaign[]>([])
  const recipients = ref<Recipient[]>([])
  const total = shallowRef(0)
  const page = shallowRef(0)
  const busy = shallowRef(false)
  const error = shallowRef('')
  const message = shallowRef('')
  const configuration = ref({ from_email: '', ready: false })
  async function run<T>(action: () => Promise<T>): Promise<T | undefined> {
    if (busy.value) return
    busy.value = true
    error.value = ''
    message.value = ''
    try {
      return await action()
    } catch (e: unknown) {
      const response = (e as { response?: { data?: { detail?: unknown } } }).response
      error.value =
        typeof response?.data?.detail === 'string'
          ? response.data.detail
          : 'No se pudo completar la operación. Revisa los datos y la conexión.'
    } finally {
      busy.value = false
    }
  }
  async function refresh() {
    const data = await actions.list(page.value * 30)
    campaigns.value = data.items
    total.value = data.total
  }
  const load = () =>
    run(async () => {
      configuration.value = await actions.configuration()
      await refresh()
    })
  const create = (input: CampaignInput) =>
    run(async () => {
      const item = await actions.create(input)
      page.value = 0
      await refresh()
      message.value = 'Borrador guardado. Puedes enviar una prueba antes del envío masivo.'
      return item
    })
  const send = (id: string) =>
    run(async () => {
      await actions.send(id)
      await refresh()
      message.value = 'Campaña puesta en cola.'
    })
  const test = (id: string, email: string) =>
    run(async () => {
      await actions.test(id, email)
      message.value = 'Correo de prueba aceptado por SMTP.'
    })
  const history = (id: string, skip = 0) =>
    run(async () => {
      recipients.value = await actions.recipients(id, skip)
    })
  return {
    campaigns,
    recipients,
    total,
    page,
    busy,
    error,
    message,
    configuration,
    load,
    create,
    send,
    test,
    history
  }
})
