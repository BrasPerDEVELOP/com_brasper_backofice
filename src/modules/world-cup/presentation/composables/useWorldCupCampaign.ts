import { computed, readonly, ref, shallowRef } from 'vue'
import { worldCupApi } from '../../infrastructure/world_cup_api'
import type { AdminNotification, MatchCouponSettings, WorldCupCampaign, WorldCupMatch } from '../../domain/models'

export function useWorldCupCampaign() {
  const campaign = shallowRef<WorldCupCampaign | null>(null)
  const matches = ref<WorldCupMatch[]>([])
  const notifications = ref<AdminNotification[]>([])
  const loading = shallowRef(false)
  const busyId = shallowRef<string | null>(null)
  const error = shallowRef('')
  const success = shallowRef('')
  const unreadCount = computed(() => notifications.value.filter((item) => !item.read_at).length)

  async function load() {
    loading.value = true
    error.value = ''
    try {
      const data = await worldCupApi.load()
      campaign.value = data.campaign
      matches.value = data.matches
      notifications.value = data.notifications
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : 'No se pudo cargar la campaña'
    } finally {
      loading.value = false
    }
  }

  async function run(label: string, action: () => Promise<unknown>, id: string | null = null) {
    busyId.value = id ?? label
    error.value = ''
    success.value = ''
    try {
      await action()
      success.value = label
      await load()
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : 'La operación no pudo completarse'
    } finally {
      busyId.value = null
    }
  }

  async function sync() {
    busyId.value = 'sync'
    error.value = ''
    success.value = ''
    try {
      const response = await worldCupApi.sync()
      const total = response.data.synced
      success.value = total === 1
        ? '1 partido sincronizado; su cupón fue actualizado.'
        : `${total} partidos sincronizados; sus cupones fueron actualizados.`
      await load()
    } catch (reason) {
      error.value = reason instanceof Error
        ? reason.message
        : 'No se pudieron sincronizar los partidos y cupones'
    } finally {
      busyId.value = null
    }
  }

  return {
    campaign,
    matches: readonly(matches),
    notifications: readonly(notifications),
    loading: readonly(loading),
    busyId: readonly(busyId),
    error: readonly(error),
    success: readonly(success),
    unreadCount,
    load,
    saveCampaign: (payload: Omit<WorldCupCampaign, 'id' | 'name' | 'updated_at'>) => run('Configuración guardada', () => worldCupApi.saveCampaign(payload)),
    sync,
    select: (id: string, selected: boolean, settings?: MatchCouponSettings) => run(
      selected ? 'Cupón del partido guardado' : 'Partido retirado',
      () => worldCupApi.selectMatch(id, selected, settings),
      id
    ),
    couponAction: (id: string, action: 'approve' | 'cancel') => run(action === 'approve' ? 'Cupón aprobado' : 'Cupón cancelado', () => worldCupApi.couponAction(id, action), id),
    readNotification: (id: string) => run('Notificación leída', () => worldCupApi.readNotification(id), id)
  }
}
