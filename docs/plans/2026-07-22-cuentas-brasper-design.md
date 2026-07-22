# Diseño — Cuentas operativas Brasper

**Estado:** Implementado
**Fecha:** 2026-07-22

## Problema

El CRUD que guarda razón social, banco, moneda, país y número de cuenta ya existía sobre `transactions/banks/`, pero solo era accesible desde “Gestionar” dentro del flujo de transferencias o creación de cuentas. Esto hacía que una configuración corporativa sensible fuera difícil de encontrar y confundía cuentas de clientes con cuentas propias de Brasper.

## Decisión

Exponer una sección independiente **Configuración > Cuentas Brasper** en `/app/cuentas-brasper` y mantener **Usuarios y cuentas** reservado para cuentas asociadas a clientes.

Se reutiliza `BancoCrudForm` como única implementación del formulario y `banks_api_adapter` como único acceso al contrato existente. No se crea un endpoint paralelo ni se duplica validación.

## Componentes

```text
cuentas_brasper_view.vue
  → carga y permisos de la ruta
  → BancoCrudForm
      → createBank / updateBank / deleteBank
      → transactions/banks/
```

- `cuentas_brasper_view.vue`: orquestador, cabecera, advertencia operativa y carga.
- `BancoCrudForm.vue`: tabla editable reutilizable; recibe permisos explícitos para crear, editar y eliminar.
- `banks_api_adapter.ts`: normalización y llamadas GET/POST/PUT/DELETE.

## Permisos

- `company_bank_accounts.view`
- `company_bank_accounts.create`
- `company_bank_accounts.update`
- `company_bank_accounts.delete`

El administrador conserva acceso total. Otros roles solo acceden si reciben estos permisos desde la pantalla de roles.

## Alcance actual

Campos soportados por el contrato y la UI existente:

- Razón social
- Banco
- Moneda
- País
- Número de cuenta

El modelo futuro debería separar entidad legal, institución bancaria y cuenta operativa, además de incorporar CCI/PIX, estado activo y propósito. Ese cambio requiere evolución coordinada del API y no bloquea la nueva sección visible.

## Verificación

- Tests unitarios de creación, actualización y eliminación del adapter.
- E2E con API simulada para acceso, hidratación y edición desde `/app/cuentas-brasper`.
- `npm run check` y `npm run build` como gate final.
