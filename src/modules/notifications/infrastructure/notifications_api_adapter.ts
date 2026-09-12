import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'
import type {
  Inbox,
  StaffMember,
  NoticeInput,
  NotificationsRepository
} from '../domain/notification'

export const notificationsApi: NotificationsRepository = {
  async inbox(page) {
    return (
      await apiClient.get<Inbox>(Domain.apiPath('notifications'), {
        params: { page, page_size: 20 }
      })
    ).data
  },
  async read(id) {
    await apiClient.post(Domain.apiPath(`notifications/${encodeURIComponent(id)}/read`))
  },
  async readAll() {
    await apiClient.post(Domain.apiPath('notifications/read-all'))
  },
  async staff() {
    return (await apiClient.get<StaffMember[]>(Domain.apiPath('notifications/staff'))).data
  },
  async create(input: NoticeInput) {
    await apiClient.post(Domain.apiPath('notifications/avisos'), input)
  }
}
