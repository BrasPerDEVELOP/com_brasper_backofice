# Plan — Gestión unificada de usuarios y cuentas bancarias

**Fecha:** 2026-07-22
**Estado:** Implementado (U1–U4, 2026-07-22); U5 queda como optimización backend opcional
**Alcance:** Frontend Vue 3; sin cambios visuales de marca y sin modificar inicialmente el contrato del API Django.
**Objetivo:** permitir que un asesor encuentre un usuario, consulte sus datos y agregue o edite sus cuentas bancarias sin cambiar de módulo ni perder el contexto.

## 1. Decisión de producto

Consolidar las vistas actuales **Usuarios** (`/app/usuarios`) y **Usuarios y cuentas bancarias** (`/app/cuentas`) en una sola experiencia llamada **Usuarios y cuentas**.

La lista de usuarios será la puerta de entrada. Al seleccionar un usuario se mostrará una ficha lateral o panel de detalle con dos pestañas:

1. **Datos del usuario**: identidad, contacto, rol y acciones existentes.
2. **Cuentas bancarias**: listado de cuentas, estado vacío y acciones para crear o editar.

Para usuarios con rol `client`, la pestaña de cuentas estará disponible. Para asesores, contabilidad, marketing y administradores se mostrará solo la administración de identidad y acceso; no se intentará asociarles cuentas de cliente.

Las cuentas propias de Brasper no entran en esta unificación. Deben resolverse posteriormente como **Configuración > Cuentas Brasper**, con modelo y permisos separados.

## 2. Resultado esperado para el asesor

Flujo principal:

```text
Usuarios y cuentas
  → buscar por nombre, documento, correo o teléfono
  → seleccionar usuario
  → abrir pestaña Cuentas bancarias
  → agregar o editar una cuenta
  → ver confirmación sin perder usuario, búsqueda ni página
```

Flujo cuando el cliente no existe:

```text
+ Nuevo usuario
  → registrar cliente
  → dejarlo seleccionado automáticamente
  → ofrecer “Agregar primera cuenta”
  → completar el asistente de cuenta existente
```

La acción **Crear transacción** podrá añadirse como enlace contextual después de guardar una cuenta, pero no forma parte del MVP para evitar ampliar el alcance.

## 3. Reglas funcionales

- La selección del usuario se refleja en la URL: `/app/usuarios?user=<id>&tab=accounts`.
- Recargar o compartir esa URL conserva el usuario y la pestaña seleccionados.
- Solo usuarios con `users.view` pueden consultar el listado.
- La pestaña Cuentas requiere además `bank_accounts.view`.
- Crear, editar y eliminar cuentas respetan `bank_accounts.create/update/delete` de forma independiente.
- Editar datos o permisos del usuario continúa usando los permisos `users.*` actuales.
- Un asesor sin permiso para editar usuarios puede consultar al cliente y gestionar sus cuentas si tiene los permisos bancarios necesarios.
- Al crear o editar una cuenta, se actualiza únicamente la ficha seleccionada; no se recarga la página completa.
- Los filtros, la página y el usuario seleccionado no se pierden al cerrar un modal.
- Los errores aparecen dentro del panel afectado. Un error al cargar cuentas no bloquea la lista de usuarios.

## 4. Diseño de la vista

### Escritorio

- Cabecera única: título, descripción y botón **Nuevo usuario**.
- Barra de búsqueda y filtros existente.
- Área principal maestro–detalle:
  - izquierda: tabla/listado de usuarios;
  - derecha: ficha del usuario seleccionado;
  - el panel derecho puede quedar fijo durante el scroll.
- Cada fila muestra un contador de cuentas cuando el dato está disponible.
- Acciones principales de la ficha: **Editar usuario**, **Agregar cuenta** y menú de acciones secundarias.

### Móvil y tablet

- Primero se muestra el listado.
- Al elegir un usuario, la ficha ocupa la pantalla o aparece debajo del listado.
- Un botón claro **Volver a usuarios** retorna sin borrar filtros.
- No se utilizarán dos columnas comprimidas.

### Estados

- Sin usuario seleccionado: mensaje “Selecciona un usuario para ver sus datos y cuentas”.
- Cliente sin cuentas: `EmptyState` con CTA **Agregar primera cuenta**.
- Usuario interno: explicación breve de que las cuentas bancarias aplican a clientes.
- Carga: spinner o skeleton localizado en lista/ficha, nunca bloqueo total.
- Guardado correcto: aviso dentro de la ficha y resaltado temporal de la cuenta creada o editada.

## 5. Arquitectura Vue propuesta

La vista de ruta debe quedar como orquestador y no absorber los dos CRUDs completos.

```text
src/modules/auth/presentation/
  bodies/
    usuarios_view.vue                 # composición de la página
  components/
    UserManagementHeader.vue          # título y acción de alta
    UserFiltersBar.vue                # búsqueda y filtros
    UserDirectoryTable.vue            # listado y selección
    UserWorkspacePanel.vue            # shell de la ficha y pestañas
    UserProfileSummary.vue            # identidad/contacto/rol

src/modules/cuentas-bancarias/presentation/
  components/
    UserBankAccountsPanel.vue          # reutilizar y adaptar
    UserBankAccountList.vue            # lista/estado vacío si hace falta extraer
  composables/
    use_user_bank_accounts.ts          # selección, cuentas derivadas y paginación

src/modules/auth/presentation/composables/
  use_user_workspace.ts                # URL, selección, pestaña y coordinación
```

### Contratos de componentes

| Componente | Props principales | Eventos |
|---|---|---|
| `UserDirectoryTable` | usuarios, selección, loading, contadores | `select`, `edit`, `create-account` |
| `UserWorkspacePanel` | usuario, pestaña, permisos | `update:tab`, `edit-user`, `create-account`, `edit-account` |
| `UserProfileSummary` | usuario, permisos | `edit`, `reset-password` |
| `UserBankAccountsPanel` | usuario/grupo, bancos, permisos | `create`, `edit` |

Se mantendrá una sola fuente de verdad para el usuario seleccionado. Filtros, conteos y cuentas visibles serán `computed`; los `watch` se limitarán a sincronizar URL y ejecutar cargas. Los componentes recibirán datos mediante props y devolverán intenciones mediante eventos tipados.

## 6. Datos y API

### MVP sin backend nuevo

Reutilizar:

- store y adapter de usuarios existentes;
- `useCuentasBancariasStore`;
- `GET transactions/bank-accounts/` con filtro por `userId`, si el API lo respeta;
- `CuentaBancariaCreateFormModal` y `CuentaBancariaEditFormModal`;
- `UserBankAccountsPanel`;
- catálogo `transactions/banks/` únicamente como dependencia del formulario actual.

Evitar cargar todas las cuentas para todos los usuarios si el adapter puede consultar por usuario. La selección debe disparar una carga localizada y cacheable por `userId`.

### Mejora backend recomendada, no bloqueante

Agregar al listado de clientes `bank_accounts_count`, o un endpoint resumido por usuario. Esto permite mostrar contadores sin descargar el universo de cuentas.

No mezclar en esta fase el catálogo `transactions/banks/` con las futuras cuentas propias de Brasper.

## 7. Migración de navegación

La consolidación se hará sin romper enlaces guardados:

1. Mantener `/app/usuarios` como ruta canónica.
2. Cambiar enlaces **Ver cuentas** a `/app/usuarios?user=<id>&tab=accounts`.
3. Convertir `/app/cuentas` en redirect compatible hacia `/app/usuarios?tab=accounts`.
4. Retirar **Cuentas** del sidebar solo después de alcanzar paridad funcional.
5. Renombrar el ítem **Usuarios** a **Usuarios y cuentas** o **Clientes y usuarios**.
6. Mantener los permisos actuales; la ruta permitirá acceso si el usuario posee `users.view` o `bank_accounts.view`, pero cada sección se gateará por separado.

### Decisión pendiente de nomenclatura

Se recomienda **Usuarios y cuentas** durante la transición porque incluye clientes y personal interno. Si el negocio prefiere separar identidad comercial de acceso interno, una fase posterior puede dividir el menú en **Clientes** y **Equipo y accesos** sin duplicar componentes.

## 8. Fases de implementación

### Fase U1 — Base y selección persistente

- [x] Crear `use_user_workspace.ts`.
- [x] Sincronizar `user` y `tab` con `route.query`.
- [x] Conservar búsqueda, filtros y paginación actuales.
- [x] Extraer o adaptar la tabla de usuarios para emitir selección.
- [x] Añadir estado sin selección.

**Aceptación:** seleccionar un usuario actualiza la URL; recargar conserva la ficha abierta.

### Fase U2 — Ficha integrada

- [x] Crear `UserWorkspacePanel` con pestañas Datos/Cuentas.
- [x] Mover el resumen y las acciones del usuario al panel.
- [x] Reutilizar `UserBankAccountsPanel` para el usuario seleccionado.
- [x] Mostrar la pestaña bancaria solo para clientes y con `bank_accounts.view`.
- [x] Mantener permisos independientes en cada acción.

**Aceptación:** el asesor consulta datos y cuentas sin salir de `/app/usuarios`.

### Fase U3 — Altas y edición en contexto

- [x] Reutilizar los modales actuales de usuario y cuenta.
- [x] Tras crear un cliente, seleccionarlo automáticamente.
- [x] Ofrecer **Agregar primera cuenta** después del alta.
- [x] Tras crear/editar una cuenta, refrescar solo el panel y resaltar el registro.
- [x] Evitar duplicar formularios o lógica de validación.

**Aceptación:** cliente nuevo + primera cuenta se completan en un flujo continuo.

### Fase U4 — Navegación y compatibilidad

- [x] Actualizar enlaces desde transacciones, dashboard y otras vistas.
- [x] Añadir redirect de `/app/cuentas` preservando `?user=`.
- [x] Retirar el ítem Cuentas del sidebar.
- [x] Actualizar breadcrumbs, `FEATURE_MAP.md` y textos.
- [x] Verificar navegación por permisos parciales.

**Aceptación:** no hay dos vistas competidoras y los enlaces antiguos siguen funcionando.

### Fase U5 — Optimización opcional

- [ ] Incorporar `bank_accounts_count` si el backend lo ofrece.
- [x] Cachear cuentas por usuario con invalidación tras mutaciones.
- [ ] Añadir CTA contextual **Crear transacción**.
- [ ] Medir tiempo de carga con listados grandes.

## 9. Pruebas

### Unitarias

- `use_user_workspace.test.ts`: query válida, usuario inexistente, cambio de pestaña y limpieza de selección.
- `use_user_bank_accounts.test.ts`: filtrado por usuario, conteos, actualización tras alta/edición.
- Tests de permisos para combinaciones `users.view` y `bank_accounts.*`.

### Componentes

- Cliente seleccionado muestra Datos y Cuentas.
- Usuario interno no presenta acciones bancarias.
- CTA de creación desaparece sin `bank_accounts.create`.
- Error de cuentas no oculta el perfil ni el listado.
- Alta de cuenta emite actualización y conserva selección.

### E2E

1. Iniciar sesión como asesor.
2. Buscar cliente.
3. Abrir pestaña Cuentas.
4. Crear cuenta.
5. Confirmar que aparece sin recargar toda la página.
6. Recargar URL y comprobar que cliente/pestaña permanecen.
7. Abrir `/app/cuentas?user=<id>` y comprobar redirect compatible.

### Gate

```bash
npm run check
npm run build
```

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| `usuarios_view.vue` crece como god file | Mantenerla como orquestador y extraer ficha, tabla y composable desde el inicio |
| Carga de todas las cuentas | Consultar por usuario; añadir conteo backend solo como mejora |
| Permisos mezclados | Gatear pestaña y cada acción con permisos específicos |
| Regresión en usuarios internos | Conservar acciones actuales dentro de la pestaña Datos |
| Enlaces antiguos rotos | Redirect temporal y pruebas de query params |
| Formularios divergentes | Reutilizar modales actuales; no crear una segunda implementación |

## 11. Fuera de alcance

- Rediseño visual general del dashboard o sidebar.
- Cambios en colores y tokens Brasper.
- Configuración de cuentas corporativas propias de Brasper.
- Nuevo modelo de banco o entidad legal.
- Creación automática de transacciones.
- Eliminación inmediata de la ruta antigua antes de comprobar paridad.

## 12. Definition of Done

- [x] Un asesor puede buscar un cliente y administrar sus cuentas desde una sola ruta.
- [x] Crear un cliente y su primera cuenta no exige navegar a otro módulo.
- [x] Selección, pestaña y filtros sobreviven a modales y recarga.
- [x] Usuarios internos conservan todas sus funciones actuales.
- [x] Permisos de usuarios y cuentas funcionan de manera independiente.
- [x] `/app/cuentas` mantiene compatibilidad mediante redirect.
- [x] No hay formularios duplicados.
- [x] La vista de ruta permanece como orquestador; componentes y composables tienen responsabilidades únicas.
- [x] `FEATURE_MAP.md` y navegación están actualizados.
- [x] `npm run check` y `npm run build` pasan en verde.

## Orden recomendado de PRs

1. `feat/usuarios-workspace-base` — U1.
2. `feat/usuarios-cuentas-panel` — U2 + U3.
3. `refactor/navegacion-usuarios-cuentas` — U4.
4. Backend/optimización U5 en PR separado si se aprueba.

## Cierre de implementación

Implementado en el workspace actual:

- `/app/usuarios` es la única vista canónica de usuarios y cuentas.
- Selección y pestaña persisten en `?user=<id>&tab=<profile|accounts>`.
- La ficha diferencia usuarios internos de clientes y respeta permisos por acción.
- Altas y edición reutilizan `UsuarioCreateFormModal`, `CuentaBancariaCreateFormModal` y `CuentaBancariaEditFormModal`.
- El rol `sales` recibe por defecto `bank_accounts.view/create/update`, necesario para el flujo del asesor; contabilidad conserva acceso de solo lectura.
- `/app/cuentas` y `/cuentas` redirigen preservando query params.
- El sidebar y dashboard apuntan al workspace unificado.
- La vista antigua y sus componentes exclusivos fueron retirados.
- `usuarios_view.vue` quedó como orquestador de menos de 500 líneas; cabecera, filtros, tabla, ficha e import/reset viven en componentes enfocados.
- Hay pruebas unitarias de query/permisos y E2E con API simulada para selección, pestaña, datos bancarios y redirect.

U5 no bloquea este cierre: `bank_accounts_count` requiere modificar el API externo y solo optimiza contadores/carga; la vista actual consulta las cuentas del usuario seleccionado mediante `user_id`.
