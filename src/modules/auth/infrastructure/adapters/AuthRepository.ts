import type { User } from '../../domain/models'

export interface LoginResponse {
  user: User
  token: string
}

export interface UpdateProfilePayload {
  names?: string | null
  lastnames?: string | null
  document_number?: string | null
}

export interface AuthRepository {
  login(username: string, password: string): Promise<LoginResponse>
  logout(): Promise<void>
  getCurrentUser(): Promise<User | null>
  updateProfile(payload: UpdateProfilePayload): Promise<User | null>
  uploadProfileImage(file: File): Promise<User | null>
}
