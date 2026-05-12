/** Usuario tal como lo devuelve el backend (login / user). */
export interface User {
  id: string
  email: string
  /** Nombres (backend: names). */
  names: string | null
  /** Apellidos (backend: lastnames). */
  lastnames: string | null
  /** Nombre para mostrar: names + lastnames, o email si no hay. */
  name: string
  document_number: string | null
  document_type: string | null
  profile_image: string | null
  is_agent: boolean
  role: string | null
  phone: number | null
  code_phone: string | null
  permissions: string[]
  must_change_password: boolean
}
