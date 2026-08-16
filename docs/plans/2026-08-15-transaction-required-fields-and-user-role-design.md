# Campos obligatorios de transacción y edición de rol

## Objetivo

Evitar falsos avisos de “Por completar”, hacer explícitos los datos relacionales requeridos al crear una transacción y permitir que un usuario con `users.update` cambie el rol desde el formulario de edición.

## Comportamiento

- Se retira “Por completar” de las tablas y filtros. No se modifica ni elimina información del cliente.
- Al crear una transacción se exige cliente, razón social y una distribución válida de cuentas destino.
- El número de operación deja de bloquear el alta porque no forma parte de esos campos obligatorios.
- Al editar una transacción histórica no se exige agregar una razón social que antes era opcional. Si se cambia la distribución destino, esta sí debe ser válida.
- Al editar un usuario con permiso `users.update`, el selector de rol se muestra aunque la tabla esté filtrada por un rol concreto.

## Componentes y flujo

- `use_transaction_destinations.ts`: validación pura de los campos obligatorios del alta.
- `transacciones_view.vue`: consume la validación al avanzar y al guardar; mantiene la edición separada.
- `UserFiltersBar.vue` y `UserDirectoryTable.vue`: dejan de presentar el estado derivado “Por completar”.
- `use_user_workspace.ts`: decide de forma testeable cuándo mostrar el selector de rol.
- `UsuarioCreateFormModal.vue`: conserva el contrato existente y envía el rol mediante el adaptador.

El API ya acepta `role` en `PUT /user` y lo protege con `users.update`, por lo que no requiere migración ni cambio de contrato.

## Errores y pruebas

La creación muestra un error específico para cliente, razón social o cuentas destino. Las pruebas cubren los tres requisitos, la visibilidad del rol al editar y el envío del rol en el `FormData`. El gate de entrega es `npm run check` seguido de `npm run build`.
