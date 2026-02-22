import type { TransactionsRepository } from '../../infrastructure/adapters/TransactionsRepository'

export class ImportTransactionsFromExcelUseCase {
  constructor(private readonly repository: TransactionsRepository) {}

  async execute(file: File): Promise<unknown> {
    return this.repository.importFromExcel(file)
  }
}
