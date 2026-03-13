# Lógica de Usuarios y Editar Perfil

Documentación corregida según la implementación real del backend.

---

## 1. URL base

Configurada en `.env`:
```
VITE_DOMAIN=127.0.0.1:8000
VITE_SSL=false
```

**Resultado:** `http://127.0.0.1:8000`

---

## 2. Endpoints utilizados

| Acción | Método | URL | Requiere token |
|--------|--------|-----|----------------|
| Login | POST | `{base}/auth/login/` | No |
| Logout | POST | `{base}/auth/logout/` | No |
| Obtener perfil por ID | GET | `{base}/user/{user_id}` | Sí |
| Actualizar perfil | PUT | `{base}/user/` (id en body) | Sí |

**Nota:** GET usa `/user/{user_id}`. PUT usa `/user/` con `id` en el body (el backend no permite PUT en `/user/{id}`).

---

## 3. Estructuras de datos

### 3.1 Modelo User (dominio frontend)

```typescript
interface User {
  id: string
  email: string | null
  names: string | null
  lastnames: string | null
  name: string                    // names + lastnames o email (computado)
  document_number: string | null
  document_type: string | null
  profile_image: string | null    // ruta relativa, ej: "profile_images/profile_xxx.jpg"
  is_agent: boolean | null
  role: string | null
  phone: number | null
  code_phone: string | null
  created_at?: string
  updated_at?: string
}
```

### 3.2 Login – Request

```http
POST /auth/login/
Content-Type: application/json

{
  "username": "email@ejemplo.com",
  "password": "tu_password"
}
```

### 3.3 Login – Response (JSON)

```json
{
  "token": "opaque-token-xxx",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "names": "Juan",
    "lastnames": "Pérez",
    "email": "email@ejemplo.com",
    "profile_image": "profile_images/profile_xxx.jpg",
    "document_number": "12345678",
    "role": "user"
  }
}
```

**Importante:** El backend acepta `application/json` o `application/x-www-form-urlencoded`. Si usas **form-urlencoded**, la respuesta solo incluye `access_token` y `token_type`, **no** el objeto `user`. Para obtener el perfil completo debes usar `Content-Type: application/json`.

**Nota:** El `user` del login (UserInfoDTO) es **parcial**: no incluye `document_type`, `is_agent`, `phone`, `code_phone`, `created_at`, `updated_at`. Para el perfil completo usa `GET /auth/me/`.

### 3.4 GET /user/{user_id} – Response (UserReadDTO)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "names": "Juan",
  "lastnames": "Pérez",
  "email": "email@ejemplo.com",
  "profile_image": "profile_images/profile_xxx.jpg",
  "document_number": "12345678",
  "document_type": "dni",
  "is_agent": true,
  "role": "user",
  "phone": 987654321,
  "code_phone": "pe"
}
```

### 3.5 PUT /user/{user_id} – Request (actualizar perfil)

**URL:** `PUT /user/{user_id}` con `user_id` en la ruta.

```typescript
interface UpdateProfilePayload {
  id: string           // REQUERIDO
  names?: string
  lastnames?: string
  email?: string
  profile_image?: string | null
  document_number?: string | null
  document_type?: string | null
  is_agent?: boolean
  role?: string | null
  phone?: number | null
  code_phone?: string | null
}
```

**Ejemplo de body:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "names": "Juan Carlos",
  "lastnames": "Pérez García",
  "document_number": "87654321",
  "document_type": "dni",
  "is_agent": false,
  "phone": 999888777,
  "code_phone": "pe"
}
```

---

## 4. Flujo de la aplicación

### 4.1 Inicio de sesión

1. Usuario envía credenciales → `POST /auth/login/`
2. Backend devuelve `{ token, user }`
3. Se guarda en Pinia (`authStore.user`, `authStore.token`)
4. Se persiste en `localStorage` (`token`, `auth_user`)

### 4.2 Restauración al cargar la app

1. `restoreUser()` lee `token` y `auth_user` de `localStorage`
2. Si hay token, se restaura `authStore.user` sin llamar al backend
3. Opcional: `restoreSession()` hace `GET /user/{user.id}` para refrescar datos

### 4.3 Vista de perfil (ProfileView.vue)

**Modo visualización (sin Editar):**
- Avatar: imagen si existe, o iniciales
- Campos: nombre, email, documento, rol (solo lectura)
- Botón "Editar"

**Modo edición (con Editar):**
- Avatar: solo visualización (sin subir foto; el backend no expone endpoint)
- Campos editables: nombres, apellidos, documento
- Email: deshabilitado
- Botones: Guardar, Cancelar

### 4.4 Guardar perfil

1. Usuario pulsa "Guardar"
2. `authStore.updateProfile({ names, lastnames, document_number })`
3. **`PUT /user/{id}`** con body completo
4. Actualizar `authStore.user` con la respuesta
5. Actualizar `localStorage`

---

## 5. URL de la imagen de perfil

**Lógica:** `Domain.mediaUrl(profile_image)`

- Si `profile_image` es URL absoluta (`http://` o `https://`) → se usa tal cual
- Si empieza con `media/` → `{base}/{path}` (evita duplicar `media`)
- En otros casos → `{base}/media/{path}`

**Ejemplo:** `profile_images/profile_xxx.jpg` → `http://127.0.0.1:8000/media/profile_images/profile_xxx.jpg`

**Configuración opcional:** `VITE_MEDIA_BASE_URL` si la base de media es distinta a la del API.

**Placeholder:** Si la imagen no existe en el servidor, el backend devuelve un avatar gris por defecto (sin 404).

---

## 6. Autenticación en requests

- Header: `Authorization: Bearer <token>`
- Todas las rutas `/auth/me/*` requieren token válido

---

## 7. Manejo de errores

- **401:** El interceptor cierra sesión y redirige a `/`
- **PUT /user/{id}:** `skipAuthRedirect: true` para no cerrar sesión en 401
- **Imagen:** Si falla la carga, se muestran las iniciales en lugar del avatar

---

## 8. Resumen: correcciones

| Aspecto | Antes (incorrecto) | Ahora (correcto) |
|---------|--------------------|------------------|
| Actualizar perfil | - | `PUT /user/` con `id` requerido |
| Login response | `user` con todos los campos | `user` parcial; usar `GET /auth/me/` para perfil completo |
| Content-Type login | Cualquiera | `application/json` para obtener `user` |
| Subir imagen | POST /auth/me/profile-image | Eliminado (no existe en backend) |

---

## 9. Archivos relevantes (frontend)

| Archivo | Responsabilidad |
|---------|-----------------|
| AuthApiAdapter.ts | Llamadas: login, GET /user/{id}, PUT /user/{id} |
| `AuthRepository.ts` | Interfaces y tipos |
| `useAuthStore.ts` | Estado, acciones y persistencia |
| `ProfileView.vue` | UI de perfil y edición |
| `User.ts` | Modelo de dominio |
| `domain.ts` | URLs base y media |
| `api/client.ts` | Cliente HTTP, token, interceptores |
