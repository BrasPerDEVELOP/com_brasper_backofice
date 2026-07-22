# Auditoría 2026-07-22 — Guardado de identificaciones múltiples ("Network Error")

## Síntoma reportado

En `/app/usuarios`, al editar un usuario que ya tiene documento (p. ej. DNI 71389479) y agregarle una segunda identificación (CPF), el botón Guardar falla con **"Network Error"**. El mensaje no viene de la red: es un **500 del backend sin cabeceras CORS**, que el navegador bloquea y axios reporta como error de red.

## Causa raíz (P0 — backend `com_brasper_api`)

Cadena completa, verificada y reproducida:

1. `UpdateUserUseCase` reemplaza la colección entera:
   `existing_user.identifications = _build_identification_entities(cmd)`
   (`app/modules/users/application/use_cases/user_use_cases.py:196`). Las entidades nuevas son objetos transitorios distintos de las filas existentes.
2. El unit of work de SQLAlchemy ejecuta **INSERT antes que DELETE** en el mismo flush. Al reenviar el mismo DNI que ya existe como fila (la migración `060_user_multiple_identifications` migró el documento legacy a `user.user_identifications`), el INSERT del "nuevo" DNI choca contra la restricción única **global** `uq_user_identifications_type_number (document_type, document_number)` antes de que se borre la fila vieja.
3. `IntegrityError` → el use case hace `rollback()` y `raise e` → **no hay ningún `exception_handler`** en `app/main.py` → Starlette devuelve un 500 plano.
4. Ese 500 lo genera `ServerErrorMiddleware` (más externo que `CORSMiddleware`), así que **sale sin `Access-Control-Allow-Origin`** → el navegador lo bloquea → axios muestra "Network Error".

**Reproducción** (SQLite en memoria, mismas semánticas de cascade y constraint):

```
REPRODUCIDO: IntegrityError: UNIQUE constraint failed:
user_identifications.document_type, user_identifications.document_number
```

**Alcance real:** no falla solo "cuando pongo varios". El frontend siempre envía `identifications` en el PUT, así que **cualquier edición** (cambiar nombre, teléfono…) de un usuario cuyo documento ya fue migrado a la tabla nueva reproduce el mismo 500. Crear usuarios nuevos funciona porque solo hay INSERTs.

### Corrección recomendada (backend)

- En `UpdateUserUseCase`, no reemplazar la colección: hacer **diff en sitio** — actualizar filas existentes que coinciden por `(document_type, document_number)`, eliminar las ausentes, insertar solo las nuevas. Alternativa mínima: vaciar la colección, `flush()`, y recién asignar las nuevas (fuerza DELETE antes de INSERT).
- Registrar `exception_handler` para `IntegrityError` (→ 409 con mensaje claro, p. ej. "Ese documento ya está registrado") y para `ValueError` de `_parse_identifications_form` (hoy un JSON inválido en el form produce 500; debe ser 422). Los handlers responden dentro de `ExceptionMiddleware`, por lo que sí pasan por CORS.
- Decidir el alcance de la restricción única: hoy es global (dos usuarios no pueden compartir número de documento) y no excluye filas con `deleted=true`. Si el borrado de usuarios es lógico, un documento quedaría bloqueado para siempre.
- Tests: `tests/test_user_identifications.py` solo tiene **tests unitarios puros** (schemas y helpers); ninguno toca la BD, por eso este bug pasó. Falta un test de integración: crear usuario con DNI → editar reenviando el mismo DNI + un CPF → debe guardar.

## Hallazgos secundarios (frontend `com_brasper_backofice`)

1. **`updateUser` no traduce errores del API** — `users_management_api_adapter.ts:208`: `createUser` envuelve errores con `formatApiErrorBody`, pero `updateUser` lanza el error axios crudo. Aun con el backend corregido (409), el asesor vería "Request failed with status code 409" en vez del mensaje del API.
2. **Editor de identificaciones sin normalización ni validación** — `UserIdentificationsEditor.vue` acepta cualquier texto: el CPF del reporte se tecleó como `130 028 633 43` (con espacios). No hay filtro de dígitos ni validación de longitud por tipo (DNI 8, CPF 11, RUC 11, CNPJ 14). Además, el chequeo de duplicados del modal compara strings crudos, así que `130 028 633 43` y `13002863343` se consideran documentos distintos.
3. **Hidratación peligrosa en el fallback de `fetchUserById`** — `users_management_api_adapter.ts:80`: si `GET user/{id}/` no existe y el listado filtrado no encuentra el id, devuelve `filtered[0]` — es decir, **el primer usuario del sistema**. El modal hidrataría las identificaciones de otra persona y al guardar las escribiría sobre el usuario editado. Debe devolver `null` en vez de `filtered[0]`.
4. **Sin pruebas del modal de usuario** — no existe test que cubra el flujo editar → agregar identificación → guardar (ni siquiera con adapter mockeado).

## Prioridad sugerida

| # | Fix | Repo | Riesgo si no se corrige |
|---|-----|------|--------------------------|
| 1 | Diff en sitio de identificaciones en `UpdateUserUseCase` + test de integración | api | Ninguna edición de usuarios migrados puede guardarse |
| 2 | Handlers de `IntegrityError`/`ValueError` con CORS | api | Todo error interno se ve como "Network Error" |
| 3 | Traducir errores en `updateUser` | backoffice | Mensajes crípticos para el asesor |
| 4 | Normalizar/validar números en `UserIdentificationsEditor` | backoffice | Documentos con espacios, duplicados no detectados |
| 5 | Quitar `?? filtered[0]` del fallback | backoffice | Sobrescritura de identificaciones entre usuarios |

Nota: el fix 1 requiere **deploy** de `com_brasper_api` (el front apunta a `apibras.finzeler.com`); el commit `cab5fa8` ya está en `origin/main` pero la corrección aún no existe.
