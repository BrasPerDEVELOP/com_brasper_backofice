import type {
  AuthRepository,
  GoogleLoginPayload,
  LoginResponse
} from '../../infrastructure/adapters/auth_repository'

export class GoogleLoginUseCase {
  constructor(private authRepository: AuthRepository) {}

  async execute(payload: GoogleLoginPayload): Promise<LoginResponse> {
    return await this.authRepository.loginWithGoogle(payload)
  }
}
