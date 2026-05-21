import type { Blog } from '../../domain/models/blog'

export interface BlogPayload {
  title: string
  slug: string
  excerpt?: string | null
  content: string
  category?: string | null
  public_id?: string | null
  read_time?: number | null
  date?: string | null
  language: string
  enable: boolean
}

export interface BlogUpdatePayload extends BlogPayload {
  id: string
}

export interface BlogRepository {
  listBlogs(skip?: number, limit?: number): Promise<{ items: Blog[]; total: number }>
  getBlogById(id: string): Promise<Blog>
  createBlog(payload: BlogPayload): Promise<Blog>
  updateBlog(payload: BlogUpdatePayload): Promise<Blog>
  deleteBlog(id: string): Promise<void>
}
