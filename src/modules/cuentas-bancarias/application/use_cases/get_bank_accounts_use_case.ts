import type { BankAccount } from '../../domain/models'
import type { CuentasBancariasRepository, GetBankAccountsParams } from '../../infrastructure/adapters/cuentas_bancarias_repository'

export class GetBankAccountsUseCase {
  constructor(private readonly repository: CuentasBancariasRepository) {}

  async execute(params?: GetBankAccountsParams): Promise<BankAccount[]> {
    return this.repository.getBankAccounts(params)
  }
}
