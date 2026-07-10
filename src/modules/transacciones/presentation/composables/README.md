# Composables — módulo transacciones (Fase C1)

## Archivos a implementar

| Archivo | Responsabilidad |
|---------|-----------------|
| `use_transaction_page_context.ts` | Facade: stores transacciones, tasas, cuentas, cupones, calculator |
| `use_transaction_filters.ts` | Estado filtros + apply/reset |
| `use_transaction_status_labels.ts` | Labels/badges de estado (mover de view) |

## Plantilla

```typescript
import { computed } from 'vue'
import { useTransactionsStore } from '../controllers/use_transactions_store_controller'

export function useTransactionPageContext() {
  const txStore = useTransactionsStore()
  // ...
  return { txStore /* ... */ }
}
```

Ver [docs/plans/FASE-C.md](../../../../docs/plans/FASE-C.md).
