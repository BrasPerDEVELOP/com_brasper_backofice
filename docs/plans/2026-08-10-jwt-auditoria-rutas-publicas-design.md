# Diseño y plan — JWT, rutas públicas y auditoría Brasper

**Estado:** Diseño acordado; listo para ejecución por fases  
**Fecha:** 2026-08-10  
**Repositorios:** `com_brasper_api`, `com_brasper_backofice`, `com_brasper_www`  
**Referencia estudiada:** únicamente `Stemis/stemis-api` y `Stemis/stemis-web`

## 1. Objetivo

Cerrar la exposición actual de endpoints sensibles y añadir trazabilidad operativa sin romper la web pública.

El resultado debe garantizar que:

- toda ruta privada requiera un JWT válido;
- las rutas públicas se autoricen por combinación exacta de método y patrón;
- cada acceso exitoso o fallido relevante quede registrado con IP y dispositivo;
- toda creación, actualización, eliminación y operación sensible registre actor y cambios;
- las lecturas exitosas ordinarias no generen auditoría;
- los intentos de acceso no autorizado sí puedan registrarse como eventos de seguridad;
- contraseñas, tokens, códigos de recuperación y archivos nunca se guarden en la bitácora;
- la auditoría solo pueda consultarse con `audit.view` y no pueda editarse ni eliminarse por API.

## 2. Decisiones de arquitectura

### 2.1 Autenticación

- JWT de acceso de corta duración, firmado con un secreto exclusivo `JWT_SECRET`.
- No reutilizar `SECRET_KEY`, credenciales de R2 ni secretos de integraciones.
- El proceso debe fallar al iniciar si el secreto falta, es débil o contiene un placeholder.
- Claims mínimos: `sub`, `sid`, `jti`, `iss`, `aud`, `iat`, `nbf`, `exp` y `client_app`.
- Los permisos no serán autoridad dentro del JWT: `require_permission()` seguirá resolviendo el estado vigente del usuario/rol para que un cambio de permisos tenga efecto sin esperar la expiración.
- Refresh token opaco, aleatorio, guardado únicamente como hash en la base de datos.
- Rotación del refresh token en cada uso; detectar reutilización y revocar la familia de sesión.
- Logout revoca la sesión y borra la cookie.
- Access token en memoria del frontend; refresh token en cookie `HttpOnly`, `Secure` y con política `SameSite` acorde a los dominios desplegados.
- Requisito de infraestructura: servir la API bajo un dominio compatible con los frontends —preferentemente `api.brasper.com`— o validar explícitamente el flujo cross-site antes del corte definitivo.

### 2.2 Auditoría híbrida

El middleware aporta contexto técnico y el caso de uso aporta significado de negocio:

```text
Request
  -> SecurityContextMiddleware
       actor + IP + user-agent + método + ruta + request_id + origen
  -> caso de uso
       acción + entidad + entity_id + valores anteriores/nuevos
  -> AuditService
       selección de campos + censura + persistencia transaccional
```

Las mutaciones críticas y su evento se confirman en la misma transacción. Si no puede escribirse la auditoría, la mutación no se confirma. Los intentos de login tienen su propia transacción.

No se añadirá Redis/BullMQ solo para copiar Stemis: la API actual no depende de Redis y la escritura directa ofrece durabilidad atómica.

### 2.3 Alcance de eventos

Se auditan:

- login exitoso, login fallido, bloqueo, refresh, logout y revocación;
- registro, actualización y eliminación de usuarios;
- cambios y restablecimientos de contraseña, sin guardar claves;
- asignación y modificación de permisos;
- creación, edición, eliminación, importación y cambio de estado de transacciones;
- comprobantes y archivos: solo acción, nombre lógico, tamaño/tipo e identificador; nunca bytes ni URL firmada;
- cupones, comisiones, tasas, bancos, cuentas, etiquetas, blog y banners;
- formularios públicos y operaciones del servicio de IA con payload reducido;
- operaciones automáticas del sistema;
- intentos fallidos de mutación y accesos `401/403` a superficies sensibles.

No se auditan:

- lecturas `GET` exitosas ordinarias;
- descargas públicas de medios;
- cargas de landing, blog, banner, tasas o calculadora.

## 3. Contrato de rutas públicas

La decisión se evaluará por `(método, patrón de ruta)`. Nunca se permitirá un módulo completo mediante `startswith('/auth/')`, `startswith('/coin/')` u otro prefijo amplio.

### 3.1 Lecturas públicas

| Método | Ruta | Consumidor |
|---|---|---|
| GET | `/` | health informativo |
| GET | `/health` | infraestructura |
| GET | `/media/{file_path:path}` | `www` y recursos públicos |
| GET | `/blog/` | listado público |
| GET | `/blog/slug/{slug}` | artículo público |
| GET | `/home-banner/home-image/` | banner público |
| GET | `/home-banner/home-image/{id}` | banner configurado |
| GET | `/coin/currencies` | calculadora |
| GET | `/coin/tax-rate` | calculadora |
| GET | `/coin/commission` | calculadora |
| GET | `/transactions/coupons/automatic/` | cupón automático |
| OPTIONS | rutas CORS | preflight del navegador |

`GET /transactions/coupons/` y `GET /transactions/coupons/{id}` permanecerán privados.

### 3.2 Operaciones públicas controladas

| Método | Ruta | Protección adicional |
|---|---|---|
| POST | `/auth/login/` | rate limit, auditoría, mensaje genérico |
| POST | `/auth/refresh` | cookie, rotación, Origin/CSRF |
| POST | `/auth/reset-password` | rate limit, respuesta no enumerable |
| POST | `/auth/reset-password/confirm` | rate limit, token de un solo uso |
| POST | `/user/` | rate limit, validación y auditoría de registro |
| POST | `/brasper/contact-form/` | rate limit/antispam, payload no auditado |

Los endpoints `/brasper/ai/*` no son públicos: conservarán autenticación servicio-a-servicio y se identificarán como origen `ia`.

Swagger será público solo en desarrollo o mediante bandera explícita; en producción no se incluirán `/docs`, `/redoc` ni `/openapi.json` en la allowlist ordinaria.

## 4. Modelo de datos

### 4.1 `audit.audit_event`

- `id UUID`
- `actor_user_id UUID NULL`
- `actor_username VARCHAR NULL`
- `actor_role VARCHAR NULL`
- `action VARCHAR NOT NULL`
- `entity VARCHAR NOT NULL`
- `entity_id VARCHAR NULL`
- `description VARCHAR NULL`
- `old_values JSONB NULL`
- `new_values JSONB NULL`
- `source VARCHAR NOT NULL` — `backoffice`, `www`, `ia`, `system`
- `ip_address INET NULL`
- `user_agent TEXT NULL`
- `method VARCHAR NULL`
- `path TEXT NULL`
- `status_code INTEGER NULL`
- `request_id UUID NOT NULL`
- `success BOOLEAN NOT NULL`
- `metadata JSONB NULL`
- `created_at TIMESTAMPTZ NOT NULL`

Índices: `created_at`, `(actor_user_id, created_at)`, `(entity, entity_id)`, `(action, created_at)`, `(source, created_at)` y `request_id`.

### 4.2 `audit.login_event`

- `id UUID`
- `user_id UUID NULL`
- `attempted_username VARCHAR NULL`
- `success BOOLEAN NOT NULL`
- `failure_reason VARCHAR NULL` con códigos internos no enumerables
- `ip_address INET NULL`
- `user_agent TEXT NULL`
- `browser`, `os`, `device` opcionales y derivados
- `source`, `request_id`, `session_id` y `created_at`

No habrá borrado automático en la primera versión. La retención se definirá como política operativa antes de introducir un job de limpieza.

### 4.3 Sesiones JWT

Tabla `user.auth_session`:

- `id/sid`, `user_id`, hash del refresh token, familia y contador de rotación;
- `client_app`, IP inicial, user-agent, creación, última actividad y expiración;
- `revoked_at`, `revoked_reason` y marca de reutilización.

## 5. Privacidad e integridad

- Preferir snapshots permitidos por entidad, no copiar automáticamente el request completo.
- Censura recursiva defensiva para claves como `password`, `token`, `secret`, `authorization`, `recovery_code`, `cookie` y variantes.
- Documentos, cuentas, CCI, CPF, PIX y otros identificadores financieros se guardan enmascarados cuando el valor concreto no sea imprescindible.
- La bitácora será append-only desde la aplicación: sin rutas `POST`, `PUT`, `PATCH` o `DELETE` para auditoría.
- El usuario funcional de la aplicación no recibirá permiso SQL para modificar o borrar filas de auditoría cuando la infraestructura permita separar roles.
- `X-Forwarded-For` solo se confiará si el peer inmediato pertenece a `TRUSTED_PROXY_CIDRS`; de lo contrario se usa `request.client.host`.
- CORS usará orígenes explícitos. `allow_origins=['*']` no se conservará junto con credenciales.
- Cada respuesta incluirá `X-Request-ID`; el mismo valor enlazará logs técnicos y auditoría.

## 6. API de consulta

Endpoints privados:

- `GET /audit/events/`
- `GET /audit/events/{event_id}`
- `GET /audit/logins/`

Filtros: página, límite con máximo, fechas, usuario, acción, entidad, ID, origen, IP y resultado. Orden predeterminado: más reciente primero.

Requieren `audit.view`; `admin` lo recibe por defecto. Ningún otro rol lo obtiene automáticamente.

La respuesta resumida no transportará `old_values`, `new_values` ni user-agent completos. Estos campos aparecerán únicamente en el endpoint de detalle para reducir exposición y peso.

## 7. Backoffice Vue

Ruta: `/app/auditoria`, protegida con `meta.permission = 'audit.view'`.

Mapa de componentes:

```text
auditoria_view.vue
  -> AuditFilters.vue
  -> AuditEventsTable.vue
  -> LoginEventsTable.vue
  -> AuditEventDetail.vue
  -> use_auditoria_store_controller.ts
       -> ListAuditEventsUseCase / ListLoginEventsUseCase
            -> auditoria_api_adapter.ts
                 -> apiClient + Domain.apiPath()
```

Responsabilidades:

- la vista de ruta solo compone cabecera, pestañas y componentes;
- el store mantiene resultados, paginación y estados de carga/error;
- el composable de filtros sincroniza criterios y resetea página;
- las tablas reciben datos por props y emiten selección/paginación;
- el detalle muestra actor, IP, ruta, antes/después y request ID;
- se reutilizan `PageHeader`, `EmptyState`, `AppSpinner` y `DataTable`;
- no se agrega lógica a `transacciones_view.vue` ni se modifica el diseño visual.

Actualizar también:

- `src/modules/auth/domain/models/permissions.ts` y tests;
- `src/interface/router/index.ts`;
- `src/interface/layout/app_layout.vue` y `nav_icons.ts`;
- `FEATURE_MAP.md`.

## 8. Compatibilidad de `www`

- Las rutas visuales `/es|en|br`, blog, FAQ, login y registro continúan públicas.
- Todo `/dashboard/*` continúa protegido.
- La calculadora conserva acceso anónimo a monedas, tasas, comisiones y cupón automático.
- Bancos, cuentas, perfil, historial y creación de transacciones requieren JWT.
- `apiClient` debe enviar credenciales únicamente al host API permitido.
- Restauración de sesión mediante `/auth/refresh`, sin leer el refresh token desde JavaScript.
- Login y registro enviarán un identificador de cliente controlado para clasificar el origen; no se utilizará como autorización.

## 9. Plan de entrega

### Fase 0 — Baseline y contrato

1. Congelar inventario OpenAPI y matriz de rutas/métodos.
2. Añadir pruebas que demuestren el estado actual de rutas públicas y privadas.
3. Confirmar dominios de producción, proxy y política de cookie.
4. Documentar variables nuevas y procedimiento de generación/rotación de secretos.

**Salida:** contrato verificable antes de cambiar auth.

### Fase 1 — Seguridad base de API

1. Reemplazar `_is_public_path()` por reglas exactas y compiladas.
2. Activar `AUTH_REQUIRED=True` en entornos protegidos.
3. Configurar CORS por allowlist.
4. Añadir request ID y resolución segura de IP.
5. Rate limits en login, registro, reset y contacto.

**Salida:** ninguna ruta administrativa hereda acceso público por prefijo.

### Fase 2 — JWT y sesiones

1. Crear migración y modelo `auth_session`.
2. Implementar emisión/verificación de access JWT.
3. Implementar refresh con cookie, rotación y detección de reutilización.
4. Implementar logout real y revocación.
5. Añadir modo temporal `dual`: aceptar tokens opacos existentes y JWT.
6. Migrar backoffice y `www` al nuevo contrato.
7. Tras validar sesiones activas, pasar a modo `jwt` y retirar el token opaco.

**Salida:** transición sin cierre masivo ni ventana con auth desactivada.

### Fase 3 — Núcleo de auditoría

1. Crear esquema, migraciones y modelos `audit_event`/`login_event`.
2. Implementar `AuditContext`, redactor, snapshots y repositorio.
3. Registrar login, refresh, logout, reset y denegaciones.
4. Probar atomicidad, append-only, IP confiable y censura.

**Salida:** infraestructura reutilizable y accesos auditados.

### Fase 4 — Instrumentación por módulos

Orden para reducir riesgo:

1. usuarios, credenciales, roles y permisos;
2. transacciones, estados, importación y comprobantes;
3. cuentas bancarias, bancos y etiquetas;
4. cupones, tasas y comisiones;
5. blog, banners, contacto e IA.

Cada operación debe obtener el estado anterior antes de mutar y registrar el estado permitido posterior.

**Salida:** cobertura de todas las mutaciones acordadas.

### Fase 5 — Consulta y pantalla

1. Añadir `audit.view` en API y frontend.
2. Implementar endpoints paginados y filtros.
3. Crear módulo Vue completo y ruta `/app/auditoria`.
4. Añadir pestañas “Acciones” y “Accesos”.
5. Verificar acceso admin y denegación a roles sin permiso.

**Salida:** trazabilidad visible sin capacidad de alterar registros.

### Fase 6 — Cierre y despliegue

1. Ejecutar suites API, backoffice y `www`.
2. Ejecutar `npm run check` y builds de ambos frontends.
3. Desplegar primero migraciones y API en modo `dual`.
4. Desplegar backoffice y `www`.
5. Verificar telemetría y smoke tests.
6. Cambiar API a modo `jwt` y retirar compatibilidad opaca.

## 10. Estrategia de PRs

Para limitar el radio de cambio:

1. **API PR 1:** allowlist, CORS, request ID, IP confiable y pruebas.
2. **API PR 2:** JWT, refresh, sesiones y compatibilidad dual.
3. **API PR 3:** tablas/servicio de auditoría e instrumentación.
4. **Backoffice PR:** nuevo auth client, permiso y módulo de auditoría.
5. **WWW PR:** nuevo auth client y pruebas de rutas públicas.
6. **API PR 4:** retirar tokens opacos y activar modo estricto.

## 11. Pruebas y gates

### API

- matriz positiva de rutas públicas;
- matriz negativa: mismo prefijo con otro método devuelve `401`;
- JWT válido, expirado, alterado, issuer/audience incorrectos;
- refresh rotado, reutilizado y revocado;
- logout invalida la sesión;
- usuario deshabilitado no accede aunque el JWT no expire;
- IP directa, proxy confiable y `X-Forwarded-For` falsificado;
- secretos y payloads sensibles censurados;
- mutación y auditoría confirman o revierten juntas;
- filtros/paginación y permiso `audit.view`.

### Backoffice

- parser y ciclo refresh/login/logout;
- guard de `/app/auditoria`;
- menú oculto sin permiso;
- adapter y mappers de auditoría;
- filtros, paginación y detalle;
- `npm run check` y `npm run build`.

### WWW

- landing, blog, banner y calculadora funcionan sin token;
- cupón automático continúa público;
- dashboard redirige sin sesión;
- cuenta y transacción funcionan con sesión renovada;
- build/prerender no dependen de credenciales privadas.

### Smoke post-deploy

- cada lectura pública esperada responde `200`;
- `POST /coin/tax-rate`, `GET /transactions/` y `GET /audit/events/` sin token responden `401`;
- login devuelve access token y cookie segura;
- crear y eliminar un registro genera auditoría con actor/IP y antes/después;
- contraseña y tokens no aparecen en consultas de auditoría;
- rol sin `audit.view` recibe `403`.

## 12. Rollback

- Las migraciones son aditivas; no eliminar columnas/tablas antiguas durante la transición.
- Mantener `AUTH_TOKEN_MODE=dual` hasta que ambos frontends estén verificados.
- Si falla un frontend, volver su deploy sin desactivar autenticación global.
- Si falla JWT, regresar temporalmente a `dual`, nunca a `AUTH_REQUIRED=False`.
- Si falla la pantalla, los eventos continúan almacenándose y la ruta puede ocultarse.
- No ejecutar downgrade destructivo de auditoría mientras existan eventos sin respaldo.

## 13. Definition of Done

- `AUTH_REQUIRED=False` no se usa en producción.
- No hay allowlists basadas en prefijos de módulos completos.
- Tokens opacos retirados después de la ventana dual.
- Todas las mutaciones acordadas tienen test de auditoría.
- No se registran lecturas exitosas ordinarias.
- Auditoría y accesos visibles únicamente con `audit.view`.
- IP no puede falsificarse mediante un XFF enviado directamente por el cliente.
- Cero secretos en fixtures y eventos verificados por tests.
- Gates locales/CI/build y smoke post-deploy verdes.
- `FEATURE_MAP.md` y documentación de entorno actualizados.
