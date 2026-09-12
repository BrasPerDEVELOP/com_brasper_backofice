export interface Notification {
  id: string
  type: 'aviso' | 'mention'
  title: string
  body: string
  entity_type: string | null
  entity_id: string | null
  read_at: string | null
  created_at: string
}
export interface Inbox {
  items: Notification[]
  total: number
  unread_count: number
}
export interface StaffMember {
  id: string
  name: string
  role: string
}
export interface NoticeInput {
  title: string
  body: string
  recipient_user_ids: string[]
}
export interface NotificationsRepository {
  inbox(page: number): Promise<Inbox>
  read(id: string): Promise<void>
  readAll(): Promise<void>
  staff(): Promise<StaffMember[]>
  create(input: NoticeInput): Promise<void>
}
