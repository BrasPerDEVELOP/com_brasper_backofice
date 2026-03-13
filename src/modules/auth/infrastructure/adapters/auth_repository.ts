import type { User } from '../../domain/models'

export interface LoginResponse {
  user: User
  token: string
}

<<<<<<< Updated upstream:src/modules/auth/infrastructure/adapters/auth_repository.ts
/** Payload para PUT /user/ (FormData). profile_image puede ser File para subir nueva imagen. */
=======
/** Payload para PUT /user/ (FormData). id requerido; resto opcionales. profile_image puede ser File para subir nueva imagen. */
>>>>>>> Stashed changes:src/modules/auth/infrastructure/adapters/AuthRepository.ts
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
