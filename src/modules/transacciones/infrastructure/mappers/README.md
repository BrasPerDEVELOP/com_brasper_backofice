# Mappers — transacciones API (Fase C3)

Extraer de `transactions_api_adapter.ts` (609 líneas → <300).

| Archivo | Responsabilidad |
|---------|-----------------|
| `parse_transaction.ts` | JSON → `Transaction` domain model |
| `transaction_form_payload.ts` | Domain → body PUT/POST (id en body PUT) |
| `transaction_list_response.ts` | Normalizar listados paginados |

Tests en `*.test.ts` junto a cada mapper.
