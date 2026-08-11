import type {
  AuthRepository,
  FacebookLoginPayload,
  LoginResponse
} from '../../infrastructure/adapters/auth_repository'

export class FacebookLoginUseCase {
  constructor(private authRepository: AuthRepository) {}

  async execute(payload: FacebookLoginPayload): Promise<LoginResponse> {
    return await this.authRepository.loginWithFacebook(payload)
  }
}
