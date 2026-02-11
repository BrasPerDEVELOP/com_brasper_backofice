import type { LoginResponse } from '../../infrastructure/adapters/AuthRepository'
import type { AuthRepository } from '../../infrastructure/adapters/AuthRepository'

export class LoginUseCase {
  constructor(private authRepository: AuthRepository) {}

  async execute(username: string, password: string): Promise<LoginResponse> {
    return await this.authRepository.login(username, password)
  }
}
