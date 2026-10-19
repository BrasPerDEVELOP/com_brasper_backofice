export type TemplateKey = 'brasper_peru_pt_v1' | 'brasper_brasil_es_v1'
export interface EmailTemplate {
  key: TemplateKey
  name: string
  language: string
  default_subject: string
  default_body: string
}
export interface EmailPreviewInput {
  template_key: TemplateKey | null
  subject: string
  body: string
}
export interface Campaign {
  id: string
  name: string
  subject: string
  body: string
  template_key: TemplateKey | null
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
  template_key: TemplateKey | null
  consent_confirmed: boolean
}
export interface Recipient {
  email: string
  status: string
  error: string | null
  sent_at: string | null
}
export interface MarketingRepository {
  templates(): Promise<EmailTemplate[]>
  preview(input: EmailPreviewInput): Promise<string>
  list(skip: number): Promise<{ items: Campaign[]; total: number }>
  create(input: CampaignInput): Promise<Campaign>
  send(id: string): Promise<Campaign>
  test(id: string, email: string): Promise<void>
  recipients(id: string, skip: number): Promise<Recipient[]>
  clients(q: string, skip: number): Promise<string[]>
  configuration(): Promise<{ from_email: string; ready: boolean }>
}
