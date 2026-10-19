export interface Campaign {
  id: string
  name: string
  subject: string
  body: string
  status: string
  created_at: string
  counts: Record<string, number>
  total: number
}
export interface CampaignInput {
  name: string
  subject: string
  body: string
  emails: string[]
  consent_confirmed: boolean
}
export interface Recipient {
  email: string
  status: string
  error: string | null
  sent_at: string | null
}
export interface MarketingRepository {
  list(skip: number): Promise<{ items: Campaign[]; total: number }>
  create(input: CampaignInput): Promise<Campaign>
  send(id: string): Promise<Campaign>
  test(id: string, email: string): Promise<void>
  recipients(id: string, skip: number): Promise<Recipient[]>
  clients(q: string, skip: number): Promise<string[]>
  configuration(): Promise<{ from_email: string; ready: boolean }>
}
