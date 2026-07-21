# Identificaciones múltiples de usuarios

## Objetivo

Permitir que un cliente tenga más de una identificación (por ejemplo, DNI y CPF) desde el formulario de creación y edición de usuarios, manteniendo compatibilidad con los registros que solo poseen `document_type` y `document_number`.

## Diseño

`UsuarioCreateFormModal` mantiene la responsabilidad de guardar el usuario y delega la edición de documentos a `UserIdentificationsEditor`. El editor recibe una lista tipada por `v-model`, permite agregar o eliminar filas y garantiza que exista como máximo una identificación principal.

El adaptador envía la colección como JSON en el campo multipart `identifications`. Cada elemento tiene esta forma:

```json
{
  "document_type": "cpf",
  "document_number": "12345678901",
  "is_primary": false
}
```

Además, continúa enviando `document_type` y `document_number` con los valores de la identificación principal. Esto preserva a los consumidores antiguos del API.

El parser acepta `identifications`, `documents` o `documentos`, así como aliases internos de tipo y número. Si la respuesta solo contiene los campos heredados, los transforma en una lista de un elemento principal. La búsqueda de usuarios contempla todos los documentos y la tabla muestra sus tipos y números (alineados) cuando hay más de uno.

Al **editar**, el modal no se conforma con la fila de la lista: llama a `fetchUserById` (`GET /user/{id}/`) para precargar la colección **completa** de identificaciones antes de permitir guardar. Como el guardado reemplaza toda la colección, esto evita borrar silenciosamente documentos que la lista no traía. Si el endpoint de detalle aún no existe, `fetchUserById` cae al listado filtrado por id; mientras llega la respuesta el botón Guardar queda deshabilitado.

## Validación

- Tipo y número son obligatorios para cada fila agregada.
- No se permiten identificaciones duplicadas del mismo tipo y número.
- Solo una identificación puede ser principal.
- Al eliminar la principal, la primera restante pasa a ser principal.
- Los registros heredados siguen funcionando sin migración previa.

## Contrato backend

El endpoint `POST/PUT user/` debe aceptar `identifications` como una cadena JSON dentro de `multipart/form-data` y devolver la colección actualizada. Durante la transición, los campos principales heredados siguen presentes en la solicitud.
