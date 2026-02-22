import type { TransactionsRepository } from '../../infrastructure/adapters/transactions_repository'

export class ImportTransactionsFromExcelUseCase {
  constructor(private readonly repository: TransactionsRepository) {}

  async execute(file: File): Promise<unknown> {
    return this.repository.importFromExcel(file)
  }
}
