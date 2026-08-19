# Detalle seguro de cuentas destino en la previsualización

## Problema

La fila recibida por WebSocket contiene la transacción y la distribución de
destinos, pero cada destino sólo incluye `bank_account_id`, `amount` y
`position`. La previsualización intenta resolver banco, identificadores y
titular contra catálogos locales. Cuando otro operador todavía no tiene esas
cuentas en memoria, la interfaz conserva los montos pero muestra rayas.

El respaldo `bank_name` de la transacción sólo representa una cuenta y no es
válido para una distribución entre varias cuentas.

## Decisión

El WebSocket y el listado seguirán usando el DTO compacto. Al abrir
"Previsualizar", el frontend consultará `GET /transactions/{id}`. Este endpoint
de detalle, ya protegido por el mismo alcance de lectura de la transacción,
devolverá cada destino con una proyección de su cuenta y banco.

La proyección sólo contendrá los datos que el preview ya presenta: nombre y
moneda del banco, número de cuenta, CCI, PIX, documento y titular. No incluirá
campos de confirmación ni datos internos.

## Flujo

1. El WebSocket inserta o actualiza la fila con el DTO compacto.
2. El operador abre la previsualización.
3. La vista solicita el detalle por ID y mantiene visible un estado de carga.
4. El adaptador normaliza la cuenta anidada de cada destino.
5. El controlador del preview usa primero el detalle anidado y conserva el
   catálogo local únicamente como respaldo para respuestas antiguas.
6. Si la petición falla, el modal utiliza la fila original y comunica que no
   pudo cargar la información bancaria completa.

## Backend

- Crear DTOs específicos para la cuenta destino del preview y para el detalle
  de transacción.
- Mantener `TransactionReadDTO` en listados y eventos WebSocket.
- Cargar con `selectinload` las relaciones
  `destinations -> bank_account -> bank` únicamente en el caso de uso por ID.
- Conservar la autorización existente de `GET /transactions/{id}`.

## Frontend

- Extender `TransactionDestination` con un snapshot bancario opcional.
- Normalizar el objeto anidado en `parse_transaction.ts`.
- Hacer que `openPreviewModal` obtenga el detalle fresco antes de renderizar.
- Resolver cada fila desde su snapshot; usar los stores sólo como compatibilidad.
- Mostrar un error no destructivo cuando el detalle no se pueda recuperar.

## Pruebas

- API: una transacción con dos cuentas devuelve ambas proyecciones sin N+1 y
  el listado compacto no expone el detalle.
- Frontend: el mapper conserva los datos anidados.
- Preview: dos cuentas no presentes en catálogos muestran banco, identificador
  y titular correctos.
- Vista/controlador: la carga por ID reemplaza la fila WebSocket y el fallback
  conserva el modal usable ante error.
