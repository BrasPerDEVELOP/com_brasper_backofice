import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'
import { parseEffectivePermissions } from '../../domain/models/permissions'
export async function fetchUserAccess(userId: string) {
  const result = await apiClient.get<Record<string, unknown>[]>(Domain.apiPath('user'), {
    params: { user_id: userId }
  })
  const user = result.data[0]
  if (!user) throw new Error('Usuario no encontrado')
  return {
    granted: parseEffectivePermissions(user.permissions_granted),
    revoked: parseEffectivePermissions(user.permissions_revoked)
  }
}
export async function saveUserAccess(userId: string, granted: string[], revoked: string[]) {
  const data = new FormData()
  data.append('id', userId)
  data.append('permissions_granted', JSON.stringify(granted))
  data.append('permissions_revoked', JSON.stringify(revoked))
  await apiClient.put(Domain.apiPath('user'), data)
}
