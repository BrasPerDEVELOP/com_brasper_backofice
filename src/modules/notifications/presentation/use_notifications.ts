import { shallowRef, onMounted, onUnmounted } from 'vue'
import { notificationsApi } from '../infrastructure/notifications_api_adapter'
import type { Notification, NotificationsRepository } from '../domain/notification'

export function useNotifications(repository: NotificationsRepository = notificationsApi) {
  const items = shallowRef<Notification[]>([])
  const unread = shallowRef(0)
  const total = shallowRef(0)
  const page = shallowRef(1)
  const loading = shallowRef(false)
  const error = shallowRef('')
  let timer: ReturnType<typeof setInterval> | undefined
  let disposed = false
  async function refresh() {
    if (loading.value) return
    loading.value = true
    try {
      const result = await repository.inbox(page.value)
      if (disposed) return
      items.value = result.items
      unread.value = result.unread_count
      total.value = result.total
      error.value = ''
    } catch {
      if (!disposed) error.value = 'No se pudieron cargar los avisos. Intenta nuevamente.'
    } finally {
      loading.value = false
    }
  }
  async function read(notification: Notification) {
    try {
      await repository.read(notification.id)
      await refresh()
      return true
    } catch {
      error.value = 'No se pudo marcar el aviso como leído.'
      return false
    }
  }
  async function readAll() {
    try {
      await repository.readAll()
      await refresh()
    } catch {
      error.value = 'No se pudieron marcar los avisos como leídos.'
    }
  }
  async function changePage(next: number) {
    if (loading.value) return
    page.value = next
    await refresh()
  }
  onMounted(() => {
    void refresh()
    timer = setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
  })
  onUnmounted(() => {
    disposed = true
    clearInterval(timer)
    window.removeEventListener('focus', refresh)
  })
  return { items, unread, total, page, loading, error, refresh, read, readAll, changePage }
}
