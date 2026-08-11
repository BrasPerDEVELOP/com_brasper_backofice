# Visor autenticado de comprobantes

## Objetivo

Abrir imágenes y PDF dentro del backoffice al pulsar una miniatura o el enlace
«Abrir», sin navegar fuera de la aplicación y sin hacer públicos los archivos de
`/media/transaction_vouchers/`.

## Diseño

- `MediaViewerDialog.vue` es un widget compartido responsable de descargar el
  archivo con `apiClient`, validar su tipo y renderizarlo en un diálogo accesible.
- Solo se admiten respuestas `image/*` y `application/pdf`. Para archivos antiguos
  con `application/octet-stream`, se permite como respaldo una extensión de imagen
  conocida o `.pdf`; SVG queda excluido.
- La descarga usa el JWT normal del cliente API. El visor crea una URL `blob:`
  temporal y la revoca al cerrar o cambiar de archivo.
- El diálogo se cierra con el botón, `Escape` o clic en el fondo, conserva un estado
  visible de carga/error y restaura el foco al elemento que lo abrió.
- Las vistas de Transacciones y Contabilidad mantienen únicamente el estado
  `abierto`, `origen` y `título`. `TransactionVoucherFileList` emite `preview` y no
  conoce el diálogo.

## Componentes

| Componente                           | Responsabilidad                                        | Contrato                       |
| ------------------------------------ | ------------------------------------------------------ | ------------------------------ |
| `MediaViewerDialog`                  | Cargar y mostrar una imagen o PDF autenticado          | `v-model`, `source`, `title`   |
| `TransactionVoucherFileList`         | Listar archivos y comunicar la intención de ver/quitar | `@preview`, `@remove`          |
| Vistas de Transacciones/Contabilidad | Seleccionar el comprobante activo                      | Abren un único visor por vista |

## Verificación

- Pruebas unitarias de clasificación por MIME/extensión y rechazo de otros tipos.
- `npm run check` para TypeScript, ESLint, Vitest y contratos de rutas.
- Prueba manual de imagen, PDF, cierre por teclado y archivo no soportado.
