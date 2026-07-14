# Múltiples cuentas destino por transacción

## Objetivo

Permitir que una transacción distribuya manualmente su monto de recepción entre
varias cuentas bancarias del cliente seleccionado. Todas las cuentas deben usar
la moneda destino de la tasa y los comprobantes continúan agrupados en la
transacción.

## Contrato

La API incorpora `destinations`, una lista ordenada de objetos con
`bank_account_id` y `amount`. La suma monetaria, redondeada a dos decimales,
debe coincidir con `destination_amount`. El servidor tolera una diferencia de
un centavo causada por el orden de redondeo y normaliza el total a la
distribución manual. No se aceptan montos no positivos,
cuentas repetidas, cuentas de otro usuario ni cuentas con otra moneda.

Una tabla hija `transaction_destinations` es la fuente de verdad. Los campos
legacy `bank_account_destination_id`, `bank_id` y `bank_name` conservan los
datos del primer destino para mantener compatibles las consultas, tablas,
filtros e integraciones actuales. La migración crea una distribución única para
cada transacción existente usando su cuenta y monto actuales.

## Interfaz

`TransactionDestinationsEditor.vue` muestra filas de cuenta y monto, permite
agregar y eliminar destinos y emite una lista tipada mediante `v-model`. Solo
ofrece las cuentas del cliente que correspondan a la moneda destino y excluye
las ya seleccionadas en otras filas. Presenta total asignado y diferencia frente
al monto destino.

La lógica monetaria y de validación vive en
`use_transaction_destinations.ts`. `transacciones_view.vue` hidrata la lista,
mantiene el primer destino en el campo legacy y bloquea el guardado si la
distribución es inválida. Al crear una cuenta desde el modal, se incorpora a la
primera fila vacía o como un destino nuevo.

## API y errores

POST multipart serializa `destinations` como JSON. PUT JSON lo envía como una
lista normal; multipart también acepta el JSON serializado. La API vuelve a
validar propiedad, moneda, duplicados, montos y suma, por lo que no depende de
las restricciones del navegador.

Un cliente antiguo que omita `destinations` conserva el comportamiento de una
sola cuenta. Si una transacción ya tiene varios destinos, una actualización
legacy no puede modificar el monto total sin enviar la distribución completa.
La razón social continúa identificándose por `social_reason_bank_id` y no se
deriva de los destinos adicionales.

## Pruebas

Las pruebas de frontend cubren suma, redondeo, duplicados, parsing y
serialización. Las pruebas de API cubren alta, edición, compatibilidad legacy y
rechazos por usuario, moneda, duplicado o suma incorrecta. Los gates finales
son `npm run check`, build del frontend, suite no-integración de la API y
verificación de la cabeza Alembic.
