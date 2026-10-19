import type { CampaignInput, MarketingRepository, EmailPreviewInput } from '../../domain/models'
export const marketingActions = (repository: MarketingRepository) => ({
  templates: () => repository.templates(),
  preview: (input: EmailPreviewInput) => repository.preview(input),
  list: (skip = 0) => repository.list(skip),
  create: (input: CampaignInput) => repository.create(input),
  send: (id: string) => repository.send(id),
  test: (id: string, email: string) => repository.test(id, email),
  recipients: (id: string, skip = 0) => repository.recipients(id, skip),
  clients: (q: string, skip = 0) => repository.clients(q, skip),
  configuration: () => repository.configuration()
})
