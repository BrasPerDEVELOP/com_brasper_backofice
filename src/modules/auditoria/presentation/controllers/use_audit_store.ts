import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { AuditEvent, AuditFilters, LoginEvent } from '../../domain/models'
import { AuditApiAdapter } from '../../infrastructure/adapters/audit_api_adapter'

export const useAuditStore = defineStore('audit', () => {
  const events = ref<AuditEvent[]>([])
  const logins = ref<LoginEvent[]>([])
  const selectedEvent = ref<AuditEvent | null>(null)
  const filters = ref<AuditFilters>({})
  const activeTab = ref<'events' | 'logins'>('events')
  const total = ref(0)
  const skip = ref(0)
  const limit = ref(50)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const api = new AuditApiAdapter()

  const page = computed(() => Math.floor(skip.value / limit.value) + 1)
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit.value)))

  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const result = activeTab.value === 'events'
        ? await api.listEvents(filters.value, skip.value, limit.value)
        : await api.listLogins(filters.value, skip.value, limit.value)
      total.value = result.total
      if (activeTab.value === 'events') events.value = result.items as AuditEvent[]
      else logins.value = result.items as LoginEvent[]
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'No se pudo cargar la auditoría'
    } finally {
      loading.value = false
    }
  }

  async function applyFilters(value: AuditFilters): Promise<void> {
    filters.value = value
    skip.value = 0
    await load()
  }

  async function selectTab(tab: 'events' | 'logins'): Promise<void> {
    activeTab.value = tab
    skip.value = 0
    await load()
  }

  async function nextPage(): Promise<void> {
    if (page.value >= totalPages.value) return
    skip.value += limit.value
    await load()
  }

  async function previousPage(): Promise<void> {
    if (skip.value === 0) return
    skip.value = Math.max(0, skip.value - limit.value)
    await load()
  }

  async function openEvent(event: AuditEvent): Promise<void> {
    selectedEvent.value = await api.getEvent(event.id)
  }

  return {
    events, logins, selectedEvent, filters, activeTab, total, loading, error,
    page, totalPages, load, applyFilters, selectTab, nextPage, previousPage, openEvent
  }
})
