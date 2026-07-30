# Auditoría de cuentas bancarias — 2026-07-29

## Alcance

Revisión read-only de los cambios sin commitear en:

- `com_brasper_backofice`: creación/edición con identificadores de texto y eliminación desde el workspace de usuarios.
- `com_brasper_api`: schemas, modelo SQLAlchemy, migración 061 y endpoint de eliminación.

## Resumen ejecutivo

- El cambio de CCI a texto corrige la pérdida de precisión y conserva ceros iniciales para solicitudes nuevas.
- La eliminación está conectada de extremo a extremo y usa soft-delete, por lo que no rompe las referencias históricas de transacciones.
- El backend no protege las rutas de cuentas con `require_permission`; ocultar el botón en Vue no impide invocar el DELETE directamente.
- Los schemas Pydantic ahora rechazan valores numéricos, lo que puede romper integraciones/importaciones antiguas durante el despliegue.
- Faltan pruebas de permiso, soft-delete, cachés y flujo UI; las pruebas actuales solo verifican el adapter y la construcción del schema.

## Hallazgos

| Severidad | Archivo / línea | Problema | Corrección sugerida |
|---|---|---|---|
| **ALTA** | `../com_brasper_api/app/modules/transactions/adapters/router/bank_account_routes.py:23-61` | Ninguna ruta de cuentas bancarias aplica `require_permission`. Un usuario autenticado sin `bank_accounts.delete` puede llamar el DELETE directamente; el control de Vue es solo visual. El mismo bypass afecta view/create/update. | Añadir `Depends(require_permission("bank_accounts.<acción>"))` por endpoint y pruebas 403 para cada operación. |
| **ALTA** | `../com_brasper_api/app/modules/transactions/application/schemas/bank_account_schema.py:19-31` y `transaction_schema.py:812-824` | Pydantic v2 rechaza enteros al declarar estos campos como `str`. Clientes anteriores e importaciones que envíen JSON numérico pasan de funcionar a responder 422. | Normalizar temporalmente `int → str` con validadores `mode="before"` o `ConfigDict(coerce_numbers_to_str=True)`, manteniendo la salida como texto. Añadir prueba de compatibilidad. |
| **MEDIA** | `../com_brasper_api/app/modules/transactions/adapters/router/bank_account_routes.py:59-61` y `bank_account_use_cases.py:140-142` | El repositorio devuelve `status=False` si la cuenta no existe, pero el caso de uso ignora el resultado y la ruta responde 204 igualmente. La UI puede anunciar “eliminada correctamente” aunque el ID nunca existiera. | Hacer que el caso de uso retorne `bool`/resultado y responder 404 cuando no se eliminó ninguna cuenta. |
| **MEDIA** | `src/modules/auth/presentation/bodies/usuarios_view.vue:206-216,483-490` | Si DELETE falla, el diálogo queda abierto y el detalle del error se renderiza detrás del overlay, dentro del workspace. El usuario solo ve que termina el spinner. | Mostrar el error dentro del diálogo o cerrarlo y enfocar el aviso; usar el formateador central de errores del API. |
| **MEDIA** | `../com_brasper_api/app/db/migrations/versions/2026_07_2800_00-061_bank_account_identifiers_to_text.py:32-40` | La migración evita corrupción futura, pero no puede recuperar ceros ya perdidos por BIGINT. Además ejecuta seis `ALTER COLUMN`, con bloqueo operativo durante el despliegue. | Auditar y corregir datos históricos desde una fuente confiable; documentar ventana de despliegue y medir tamaño/bloqueo antes de producción. |
| **MEDIA** | `src/modules/cuentas-bancarias/infrastructure/adapters/cuentas_bancarias_api_adapter.test.ts:43-67` y `../com_brasper_api/tests/test_bank_account_identifiers.py:8-25` | No hay prueba del submit real del formulario, limpieza de los tres cachés del store, permiso del botón, 403 backend, 404 ni persistencia/lectura en DB. La prueba backend solo instancia Pydantic. | Añadir unit tests del store/form, prueba de rutas con permisos y una prueba de repositorio o integración DB que haga create → read → delete. |

## Lo que está bien

- Los identificadores bancarios dejan de pasar por `Number(...)`.
- El adapter usa `Domain.apiPath()` y el endpoint de detalle correcto.
- El flujo Vue mantiene props hacia abajo y eventos hacia arriba.
- La UI usa `ConfirmDialog` compartido y gatea el botón con `bank_accounts.delete`.
- El store retira la cuenta de la lista principal, caché por usuario y selector de transacciones.
- El backend usa soft-delete; las FK de transacciones conservan el registro histórico.
- La migración 061 queda como único `head`.

## Plan de corrección

### Fase A — seguridad y contrato

1. Proteger las cinco rutas backend con permisos.
2. Añadir pruebas 401/403/admin para DELETE y el resto del CRUD.
3. Coaccionar entradas numéricas heredadas a texto durante una ventana de compatibilidad.

### Fase B — semántica de eliminación

1. Retornar 404 cuando la cuenta no existe.
2. Mantener soft-delete y verificar que las listas excluyen registros eliminados.
3. Mostrar errores de DELETE dentro del diálogo.

### Fase C — datos y despliegue

1. Ejecutar consulta previa para estimar cuentas con longitudes sospechosas.
2. Definir fuente para reparar CCI/cuentas que ya perdieron ceros.
3. Desplegar migración antes o en coordinación estricta con el API nuevo.

### Fase D — cobertura

1. Submit del formulario con `01123200020106262661`.
2. Create/read roundtrip en DB.
3. Eliminación y limpieza de cachés Pinia.
4. E2E del botón según permiso y confirmación.

## Definition of Done

- Ninguna operación de cuentas puede ejecutarse sin su permiso backend.
- El CCI exacto conserva 20 dígitos y cero inicial después de guardar y recargar.
- Payloads heredados numéricos tienen una decisión explícita: compatibilidad temporal o error documentado.
- DELETE devuelve 204 solo si eliminó y 404 si no existe.
- Un fallo de eliminación es visible dentro del contexto modal.
- Pruebas de frontend y backend cubren permisos, persistencia, cachés y eliminación.

## Qué no hacer

- No confiar en `v-if` como control de autorización.
- No volver a convertir CCI, cuenta o documentos a `Number`/`BIGINT`.
- No intentar inferir ceros históricos perdidos sin una fuente confiable.
- No desplegar el cambio de schemas separado de la migración sin una estrategia de compatibilidad.
