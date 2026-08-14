import {
  computed,
  getCurrentInstance,
  onBeforeUnmount,
  reactive,
  readonly,
  shallowRef,
  type CSSProperties
} from 'vue'

export interface ResizableTableColumn<Key extends string = string> {
  key: Key
  defaultWidth: number
  minWidth: number
  maxWidth: number
}

export interface ColumnWidthsStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

interface UseResizableTableColumnsOptions<Key extends string> {
  columns: readonly ResizableTableColumn<Key>[]
  storageKey: string
  fixedWidth?: number
  storage?: ColumnWidthsStorage | null
}

function clampWidth(width: number, column: ResizableTableColumn): number {
  return Math.round(Math.min(column.maxWidth, Math.max(column.minWidth, width)))
}

function safeParseStoredWidths(value: string | null): Record<string, unknown> {
  if (!value) return {}
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

export function resolveColumnWidths<Key extends string>(
  columns: readonly ResizableTableColumn<Key>[],
  storedValue: string | null
): Record<Key, number> {
  const storedWidths = safeParseStoredWidths(storedValue)
  const widths = {} as Record<Key, number>

  for (const column of columns) {
    const storedWidth = storedWidths[column.key]
    widths[column.key] = clampWidth(
      typeof storedWidth === 'number' && Number.isFinite(storedWidth)
        ? storedWidth
        : column.defaultWidth,
      column
    )
  }

  return widths
}

function browserStorage(): ColumnWidthsStorage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function useResizableTableColumns<Key extends string>(
  options: UseResizableTableColumnsOptions<Key>
) {
  const storage = options.storage === undefined ? browserStorage() : options.storage
  const storedValue = (() => {
    try {
      return storage?.getItem(options.storageKey) ?? null
    } catch {
      return null
    }
  })()

  const widths = reactive(resolveColumnWidths(options.columns, storedValue)) as Record<Key, number>
  const activeColumnKey = shallowRef<Key | null>(null)
  const columnsByKey = new Map(options.columns.map((column) => [column.key, column] as const))

  let pointerId: number | null = null
  let pointerTarget: HTMLElement | null = null
  let startX = 0
  let startWidth = 0
  let previousCursor = ''
  let previousUserSelect = ''

  const columnStyles = computed(() => {
    const styles = {} as Record<Key, CSSProperties>
    for (const column of options.columns) {
      styles[column.key] = { width: `${widths[column.key]}px` }
    }
    return styles
  })

  const tableWidth = computed(
    () =>
      options.columns.reduce((total, column) => total + widths[column.key], 0) +
      (options.fixedWidth ?? 0)
  )

  const tableStyle = computed<CSSProperties>(() => ({
    width: `${tableWidth.value}px`,
    minWidth: `${tableWidth.value}px`
  }))

  function persistWidths() {
    if (!storage) return
    try {
      storage.setItem(options.storageKey, JSON.stringify({ ...widths }))
    } catch {
      // localStorage puede estar deshabilitado o sin espacio; el ajuste actual sigue funcionando.
    }
  }

  function restoreDocumentInteraction() {
    if (typeof document === 'undefined') return
    document.body.style.cursor = previousCursor
    document.body.style.userSelect = previousUserSelect
  }

  function stopResize(event?: PointerEvent, persist = true) {
    if (event && pointerId !== event.pointerId) return
    if (pointerTarget && pointerId !== null && pointerTarget.hasPointerCapture?.(pointerId)) {
      pointerTarget.releasePointerCapture(pointerId)
    }
    if (persist && activeColumnKey.value !== null) persistWidths()
    pointerId = null
    pointerTarget = null
    activeColumnKey.value = null
    restoreDocumentInteraction()
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', stopResize)
      window.removeEventListener('pointercancel', stopResize)
    }
  }

  function onPointerMove(event: PointerEvent) {
    const key = activeColumnKey.value as Key | null
    if (key === null || pointerId !== event.pointerId) return
    const column = columnsByKey.get(key)
    if (!column) return
    widths[key] = clampWidth(startWidth + event.clientX - startX, column)
    event.preventDefault()
  }

  function startResize(key: Key, event: PointerEvent) {
    if (event.button !== 0) return
    const column = columnsByKey.get(key)
    if (!column || typeof window === 'undefined') return

    stopResize()
    activeColumnKey.value = key
    pointerId = event.pointerId
    pointerTarget = event.currentTarget as HTMLElement
    startX = event.clientX
    startWidth = widths[key]
    pointerTarget.setPointerCapture?.(pointerId)

    if (typeof document !== 'undefined') {
      previousCursor = document.body.style.cursor
      previousUserSelect = document.body.style.userSelect
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', stopResize)
    window.addEventListener('pointercancel', stopResize)
    event.preventDefault()
  }

  function resizeBy(key: Key, delta: number) {
    const column = columnsByKey.get(key)
    if (!column) return
    widths[key] = clampWidth(widths[key] + delta, column)
    persistWidths()
  }

  if (getCurrentInstance()) {
    onBeforeUnmount(() => stopResize())
  }

  return {
    widths: readonly(widths),
    activeColumnKey: readonly(activeColumnKey),
    columnStyles,
    tableStyle,
    startResize,
    resizeBy
  }
}
