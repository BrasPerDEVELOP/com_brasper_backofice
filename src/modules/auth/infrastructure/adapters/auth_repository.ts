import type { User } from '../../domain/models'

export interface LoginResponse {
  user: User
  token: string
}

/** Payload para PUT /user/ (FormData). profile_image puede ser File para subir nueva imagen. */
export interface UpdateProfilePayload {
  id: string
  names?: string
  lastnames?: string
  email?: string
  profile_image?: string | File | null
  document_number?: string | null
  document_type?: string | null
  is_agent?: boolean
  role?: string | null
  phone?: number | null
  code_phone?: string | null
}

export interface AuthRepository {
  login(username: string, password: string): Promise<LoginResponse>
  logout(): Promise<void>
  getCurrentUser(userId: string): Promise<User | null>
  updateProfile(payload: UpdateProfilePayload): Promise<User | null>
}
