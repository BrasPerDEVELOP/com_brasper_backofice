# Errores Backend - Transacciones

---

## Error CORS + 307 Redirect (Previsualizar transacción)

### Síntoma

Al hacer clic en "Previsualizar" una transacción, el frontend muestra **"No se pudo cargar la transacción"** y en DevTools (Network) aparece:

- **Primera petición:** `GET /transactions/{id}/` → **307 Redirect**
- **Segunda petición:** **CORS error** (bloqueada por el navegador)

### Causa

El servidor devuelve **307** (redirect). Cuando el navegador sigue el redirect, falla por **CORS** porque:
1. La respuesta 307 no incluye los headers CORS necesarios, o
2. El redirect apunta a otro origen (protocolo/dominio/puerto distinto)

### Solución backend

1. **Evitar el redirect:** Servir el recurso directamente en la URL solicitada sin redirigir.
2. **Si el redirect es necesario:** Añadir en la respuesta 307:
   - `Access-Control-Allow-Origin: *` (o el origen del frontend)
   - `Access-Control-Allow-Methods: GET, OPTIONS`
   - `Access-Control-Allow-Headers: Authorization, Content-Type`
3. **Comprobar:** Que la URL final del redirect sea el mismo origen (`https://apibras.finzeler.com`).

### Petición del frontend

| Campo | Valor |
|-------|-------|
| **Método** | `GET` |
| **URL** | `https://apibras.finzeler.com/transactions/{id}/` |
| **Headers** | `Authorization: Bearer {token}` |

---

## Error 405 - Importación de transacciones

## Resumen del error

El frontend intenta importar transacciones desde un archivo Excel y recibe:

```
Request failed with status code 405
{"detail":"Method Not Allowed"}
```

**405 Method Not Allowed** indica que la ruta existe pero no acepta el método HTTP usado (POST), o que la ruta no está configurada correctamente.

---

## Detalle de la petición que envía el frontend

| Campo | Valor |
|-------|-------|
| **Método** | `POST` |
| **URL** | `https://apibras.finzeler.com/transactions/import/` |
| **Content-Type** | `application/json` |
| **Headers** | Incluye `Authorization` (token JWT) si el usuario está logueado |

---

## Estructura del body (JSON)

```json
{
  "items": [
    {
      "user_origin": {
        "user": {
          "names": "Gustavo",
          "lastnames": "Martin Bravo Tantalean",
          "email": "Gmbt01@gmail.com",
          "password": "Import123!"
        },
        "bank_account": {
          "bank_id": "BCP",
          "account_flow": "origin",
          "account_holder_type": "naturalPerson",
          "bank_country": "pe",
          "holder_names": "Gustavo",
          "holder_surnames": "Martin Bravo Tantalean",
          "document_number": 9443212
        }
      },
      "user_destination": {
        "user": {
          "names": "Gustavo",
          "lastnames": "Martin Bravo Tantalean",
          "email": "Gmbt01@gmail.com",
          "password": "Import123!"
        },
        "bank_account": {
          "bank_id": "br",
          "account_flow": "destination",
          "account_holder_type": "naturalPerson",
          "bank_country": "br",
          "holder_names": "Gustavo",
          "holder_surnames": "Martin Bravo Tantalean",
          "pix_key": "Gmbt01@gmail.com",
          "pix_key_type": "email"
        }
      },
      "transaction": {
        "origin_amount": 18000,
        "destination_amount": 11825.36,
        "commission_result": 331.11,
        "total_to_send": 11494.25,
        "send_date": "2026-02-01",
        "payment_date": "2026-03-18"
      }
    }
  ]
}
```

---

## Esquema TypeScript del payload

```typescript
interface ImportPayload {
  items: ImportTransactionItem[]
}

interface ImportTransactionItem {
  user_origin?: {
    user?: {
      names?: string
      lastnames?: string
      email?: string
      password?: string
    }
    bank_account?: {
      bank_id?: string
      account_flow?: string
      account_holder_type?: string
      bank_country?: string
      holder_names?: string
      holder_surnames?: string
      document_number?: number
      pix_key?: string
      pix_key_type?: string
    }
  }
  user_destination?: {
    user?: { /* mismo que user_origin.user */ }
    bank_account?: {
      bank_id?: string
      account_flow?: string
      account_holder_type?: string
      bank_country?: string
      holder_names?: string
      holder_surnames?: string
      document_number?: number
      pix_key?: string
      pix_key_type?: string
    }
  }
  transaction?: {
    tax_rate_id?: string
    commission_id?: string
    origin_amount?: number
    destination_amount?: number
    commission_result?: number
    total_to_send?: number
    send_date?: string
    payment_date?: string
  }
}
```

---

## Lo que el backend debe implementar

1. **Endpoint**: `POST /transactions/import/` (o `POST /transactions/import` sin barra final, según convención del proyecto)

2. **Aceptar**: `application/json` con el body descrito arriba

3. **Procesar cada item**:
   - Crear o buscar usuario origen (Perú) por email
   - Crear o buscar cuenta bancaria origen
   - Crear o buscar usuario destino (Brasil) por email
   - Crear o buscar cuenta bancaria destino (pix_key)
   - Crear la transacción vinculando cuentas, usuario, montos, fechas

4. **Respuesta esperada**: Cualquier estructura que indique éxito (ej. `{"data": [...], "created": 148}` o similar). El frontend solo verifica que no haya error HTTP.

---

## Rutas alternativas a probar

Si el backend usa otra convención:

- `POST /transaction/import/` (singular)
- `POST /api/transactions/import/`
- `POST /transactions/bulk/` (con body `{ items: [...] }`)

El frontend permite configurar la ruta en `.env`:

```env
VITE_TRANSACTIONS_IMPORT_PATH=transactions/import/
```

---

## Origen del Excel

El Excel tiene columnas: Fecha del envío, N° de envío, Nombre, Cliente, Documento, DNI/CE, Correo, TC, ENVÍA (PEN), Tipo de cambio, Tasa, Factor, Comisión (CLIENTE), Total Enviar, RECIBE (BRL), Banco, Cuenta, ESTADO, etc.

El frontend parsea este formato y lo convierte al JSON de arriba antes de enviarlo al backend.
