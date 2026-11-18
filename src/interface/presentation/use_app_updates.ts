import {
  computed,
  inject,
  onMounted,
  onScopeDispose,
  onUnmounted,
  provide,
  shallowReactive,
  shallowRef,
  type ComputedRef,
  type InjectionKey,
} from 'vue'
import { watchAppUpdates } from '@/interface/infrastructure/services/app_updates'

const appUpdatesKey: InjectionKey<{
  canRefresh: ComputedRef<boolean>
  refresh: () => void
  deferWhile: (blocked: ComputedRef<boolean>) => void
}> = Symbol('appUpdates')

export function provideAppUpdates() {
  const available = shallowRef(false)
  const blockers = shallowReactive(new Set<ComputedRef<boolean>>())
  const canRefresh = computed(() => available.value && ![...blockers].some((blocked) => blocked.value))

  let stopWatching: (() => void) | undefined
  onMounted(() => {
    if (import.meta.env.PROD) {
      stopWatching = watchAppUpdates(() => {
        available.value = true
      })
    }
  })
  onUnmounted(() => stopWatching?.())

  provide(appUpdatesKey, {
    canRefresh,
    refresh() {
      if (canRefresh.value) window.location.reload()
    },
    deferWhile(blocked) {
      blockers.add(blocked)
      onScopeDispose(() => blockers.delete(blocked))
    },
  })
}

export function useAppUpdates() {
  const updates = inject(appUpdatesKey)
  if (!updates) throw new Error('App updates must be provided by the application.')
  return updates
}
