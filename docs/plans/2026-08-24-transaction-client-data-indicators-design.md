# Indicadores de datos pendientes en transacciones

## Objetivo

Mostrar junto al nombre del cliente señales compactas cuando falten correo,
teléfono o cuentas bancarias. La cuenta bancaria se puede crear desde la fila si
el operador tiene `bank_accounts.create`.

## Decisiones

- Los iconos nuevos usan `@lucide/vue`. La migración de SVG antiguos queda fuera
  de este cambio para mantener un alcance verificable.
- No se agrega una columna: los indicadores viven junto al nombre y antes de las
  etiquetas existentes.
- El endpoint liviano `user/name-list` expone sólo `has_email` y `has_phone`; no
  envía los valores sensibles.
- La existencia de cuentas se resuelve con el catálogo autorizado que el
  dashboard ya carga. Si no hay permiso o la carga no terminó, no se muestra una
  advertencia que podría ser falsa.
- `CLIENT_DATA_STATUS_UPDATED` viaja por el WebSocket de transacciones con sólo
  `user_id`. El cliente refresca ese usuario y sus cuentas, sin recargar toda la
  tabla.

## Interacción y accesibilidad

- Correo y teléfono son señales informativas.
- Cuenta bancaria abre el modal existente, bloqueado al usuario de la fila.
- Cada icono tiene nombre accesible, foco visible y tooltip disponible con mouse
  o teclado.
- Sin permiso para crear cuentas, el icono conserva el tooltip informativo y no
  se renderiza como botón.

## Criterios de aceptación

- Los indicadores reflejan únicamente datos confirmados como ausentes.
- Una cuenta creada desde la fila elimina la señal sin alterar el formulario de
  creación o edición de transacciones.
- Cambios de correo, teléfono, alta, edición o baja de cuenta se propagan por WS.
- Los eventos de cliente no se interpretan como `TRANSACTION_UPDATED`.
- Los checks de API y frontend quedan verdes.
