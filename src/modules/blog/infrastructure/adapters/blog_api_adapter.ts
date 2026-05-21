import { apiClient } from '@/interface/api/client'
import { Domain } from '@/interface/infrastructure/services'
import type { Blog } from '../../domain/models'
import type { BlogPayload, BlogUpdatePayload, BlogRepository } from './blog_repository'

function parseBlog(item: unknown): Blog {
  if (item == null || typeof item !== 'object') {
    return {
      id: '',
      title: '',
      slug: '',
      content: '',
      language: '',
      enable: false
    }
  }

  const o = item as Record<string, unknown>
  return {
    id: String(o.id ?? ''),
    title: String(o.title ?? ''),
    slug: String(o.slug ?? ''),
    excerpt: o.excerpt ? String(o.excerpt) : null,
    content: String(o.content ?? ''),
    category: o.category ? String(o.category) : null,
    public_id: o.public_id ? String(o.public_id) : null,
    read_time: o.read_time !== undefined && o.read_time !== null ? Number(o.read_time) : null,
    date: o.date ? String(o.date) : null,
    language: String(o.language ?? ''),
    enable: Boolean(o.enable),
    created_at: typeof o.created_at === 'string' ? o.created_at : undefined,
    created_by: typeof o.created_by === 'string' ? o.created_by : null,
    updated_at: typeof o.updated_at === 'string' ? o.updated_at : undefined
  }
}

export class BlogApiAdapter implements BlogRepository {
  private endpoint(path = ''): string {
    const p = path.replace(/^\/+/, '')
    return p ? Domain.apiPath(`blog/${p}`) : Domain.apiPath('blog/')
  }

  async listBlogs(skip = 0, limit = 20): Promise<{ items: Blog[]; total: number }> {
    const response = await apiClient.get<unknown>(this.endpoint(), {
      params: { skip, limit }
    })
    const data = response.data as Record<string, unknown>
    const items = Array.isArray(data.items) ? data.items.map(parseBlog) : []
    const total = typeof data.total === 'number' ? data.total : 0
    return { items, total }
  }

  async getBlogById(id: string): Promise<Blog> {
    const response = await apiClient.get<unknown>(this.endpoint(id))
    return parseBlog(response.data)
  }

  async createBlog(payload: BlogPayload): Promise<Blog> {
    const response = await apiClient.post<unknown>(this.endpoint(), payload)
    return parseBlog(response.data)
  }

  async updateBlog(payload: BlogUpdatePayload): Promise<Blog> {
    const response = await apiClient.put<unknown>(this.endpoint(), payload)
    return parseBlog(response.data)
  }

  async deleteBlog(id: string): Promise<void> {
    await apiClient.delete(this.endpoint(id))
  }
}
