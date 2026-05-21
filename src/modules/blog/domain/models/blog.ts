export interface Blog {
  id: string
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
  created_at?: string
  created_by?: string | null
  updated_at?: string
}
