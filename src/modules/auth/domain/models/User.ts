/** Usuario tal como lo devuelve el backend (login / me). */
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
  profile_image: string | null
  role: string | null
}
