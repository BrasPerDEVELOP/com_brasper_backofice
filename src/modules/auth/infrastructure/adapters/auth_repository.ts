import type { User } from '../../domain/models'

export interface LoginResponse {
  user: User
  token: string
}

/** Payload para PUT /user/ (FormData). id requerido; resto opcionales. profile_image puede ser File para subir nueva imagen. */
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

/**
 * Canje del `code` de Facebook por una sesión Brasper.
 * `redirectUri` debe ser idéntico al usado en el diálogo OAuth (lo exige Facebook).
 */
export interface FacebookLoginPayload {
  code: string
  redirectUri: string
}

/**
 * Canje del `code` de Google por una sesión Brasper.
 * `redirectUri` debe ser idéntico al usado en el diálogo OAuth (lo exige Google).
 */
export interface GoogleLoginPayload {
  code: string
  redirectUri: string
}

export interface AuthRepository {
  login(username: string, password: string): Promise<LoginResponse>
  loginWithFacebook(payload: FacebookLoginPayload): Promise<LoginResponse>
  loginWithGoogle(payload: GoogleLoginPayload): Promise<LoginResponse>
  logout(): Promise<void>
  getCurrentUser(userId: string): Promise<User | null>
  updateProfile(payload: UpdateProfilePayload): Promise<User | null>
  changePassword(payload: ChangePasswordPayload): Promise<void>
}

export interface ChangePasswordPayload {
  current_password: string
  new_password: string
}
