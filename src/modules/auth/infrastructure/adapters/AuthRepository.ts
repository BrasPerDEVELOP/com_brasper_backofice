import type { User } from '../../domain/models'

export interface LoginResponse {
  user: User
  token: string
}

export interface AuthRepository {
    login(username: string, password: string): Promise<LoginResponse>
  logout(): Promise<void>
  getCurrentUser(): Promise<User | null>
}
