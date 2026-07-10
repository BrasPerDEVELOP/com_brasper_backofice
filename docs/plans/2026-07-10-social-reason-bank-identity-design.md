# Identidad de razón social en transacciones

## Problema

El selector de razón social usa el UUID de una fila de `transaction.banks`, pero la
transacción solo persistía `company_name`. Dos filas como `Brasper 21 · Santander ·
BRL` y `Brasper 21 · PicPay · BRL` comparten empresa y moneda, por lo que el frontend
no podía reconstruir la selección exacta al reabrir.

`bank_id` no puede reutilizarse: pertenece al banco de `bank_account_destination`.

## Diseño

- La API agrega `social_reason_bank_id`, FK nullable e independiente hacia
  `transaction.banks.id`.
- `bank_id` y `bank_name` continúan siendo el snapshot de la cuenta destino.
- Cuando llega `social_reason_bank_id`, la API valida que el banco exista y deriva
  `company_name` desde esa fila para mantener ambos campos coherentes.
- POST, PUT, multipart, JSON y `TransactionReadDTO` exponen el nuevo campo.
- El frontend envía el UUID seleccionado y, al editar, lo usa como fuente
  autoritativa del dropdown.
- Para registros históricos sin UUID, solo se infiere una selección cuando
  empresa y moneda producen una única coincidencia. Si hay varias, el selector
  queda vacío en vez de mostrar un banco incorrecto.

## Compatibilidad y pruebas

La columna es nullable, así que el despliegue de la migración es compatible con los
registros existentes. Las pruebas cubren JSON/multipart, validación del banco,
persistencia del snapshot y el caso regresivo Santander/PicPay con empresa y moneda
duplicadas.
