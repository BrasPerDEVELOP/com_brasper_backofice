# interface/widgets

Patrones de UI reutilizables compartidos entre módulos, con la **estética Brasper
ya existente** (mismas clases Tailwind usadas hoy en pantalla). Adoptarlos no debe
cambiar el diseño visual.

Importar desde el alias `@interface/widgets`:

```ts
import { PageHeader, EmptyState, AppSpinner, ConfirmDialog } from '@interface/widgets'
```

## Componentes

| Widget | Reemplaza | Props principales |
|--------|-----------|-------------------|
| `PageHeader` | Encabezados inline (eyebrow + título) repetidos por vista | `title`, `eyebrow?`, `subtitle?`, slot `#actions` |
| `EmptyState` | Bloques "sin resultados" inline (p. ej. `blog_view`) | `title?`, `description?`, slots `#icon` / `#actions` |
| `AppSpinner` | SVG `animate-spin` duplicado en blog/dashboard/transacciones | `size?`, `label?`, `center?`, `colorClass?` |
| `ConfirmDialog` | `window.confirm(...)` disperso en las vistas | `v-model`, `title?`, `message?`, `confirmText?`, `variant?`, `loading?`; emite `@confirm` / `@cancel` |

## Ejemplos

```vue
<PageHeader eyebrow="Configuración" title="Comisiones" subtitle="Pares y tramos">
  <template #actions>
    <button class="rounded-lg bg-brasper-indigoStrong px-4 py-2.5 text-sm font-semibold text-white">
      Nueva comisión
    </button>
  </template>
</PageHeader>

<AppSpinner v-if="isLoading" center label="Cargando artículos..." />

<EmptyState
  v-else-if="!items.length"
  title="No se encontraron artículos"
  description="Intenta cambiar los términos de búsqueda."
/>

<ConfirmDialog
  v-model="showDelete"
  title="Eliminar cupón"
  message="Esta acción no se puede deshacer."
  confirm-text="Eliminar"
  :loading="deleting"
  @confirm="handleDelete"
/>
```

> `ConfirmDialog`: el padre controla la apertura vía `v-model`. En `@confirm`
> ejecuta la acción y cierra (`showDelete = false`); en `@cancel` se cierra solo.
> Usa `:loading` para flujos async (deshabilita botones y muestra spinner).
