/**
 * Fase B — Gate de permisos en templates
 */
import { computed } from 'vue'
import { useAuthStore } from '../controllers/use_auth_store_controller'
import type { PermissionKey } from '../../domain/models/permissions'

export function usePermissionGate() {
  const auth = useAuthStore()

  const can = (permission: PermissionKey) => computed(() => auth.hasPermission(permission))

  return {
    auth,
    can,
    has: (permission: PermissionKey) => auth.hasPermission(permission),
  }
}
