import type { LoginResponse } from '../../infrastructure/adapters/auth_repository'
import type { AuthRepository } from '../../infrastructure/adapters/auth_repository'

export class LoginUseCase {
  constructor(private authRepository: AuthRepository) {}

  async execute(username: string, password: string): Promise<LoginResponse> {
    return await this.authRepository.login(username, password)
  }
}
