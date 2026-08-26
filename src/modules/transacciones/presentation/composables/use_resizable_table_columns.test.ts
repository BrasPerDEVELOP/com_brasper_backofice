import { describe, expect, it } from 'vitest'
import {
  resolveColumnWidths,
  useResizableTableColumns,
  type ColumnWidthsStorage,
  type ResizableTableColumn
} from './use_resizable_table_columns'

type ColumnKey = 'code' | 'client'

const columns: readonly ResizableTableColumn<ColumnKey>[] = [
  { key: 'code', defaultWidth: 120, minWidth: 80, maxWidth: 240 },
  { key: 'client', defaultWidth: 200, minWidth: 120, maxWidth: 480 }
]

function memoryStorage(initialValue: string | null = null) {
  let value = initialValue
  const storage: ColumnWidthsStorage = {
    getItem: () => value,
    setItem: (_key, nextValue) => {
      value = nextValue
    }
  }
  return { storage, read: () => value }
}

describe('resolveColumnWidths', () => {
  it('usa los anchos predeterminados cuando no existe una preferencia', () => {
    expect(resolveColumnWidths(columns, null)).toEqual({
      code: 120,
      client: 200
    })
  })

  it('restaura solo columnas conocidas y respeta sus límites', () => {
    expect(
      resolveColumnWidths(columns, JSON.stringify({ code: 20, client: 999, unknown: 300 }))
    ).toEqual({ code: 80, client: 480 })
  })

  it('ignora JSON dañado y valores que no son números finitos', () => {
    expect(resolveColumnWidths(columns, '{roto')).toEqual({
      code: 120,
      client: 200
    })
    expect(resolveColumnWidths(columns, JSON.stringify({ code: '180', client: null }))).toEqual({
      code: 120,
      client: 200
    })
  })
})

describe('useResizableTableColumns', () => {
  it('guarda el nuevo ancho después de ajustarlo con el teclado', () => {
    const { storage, read } = memoryStorage()
    const { resizeBy, widths } = useResizableTableColumns({
      columns,
      storageKey: 'transaction-columns',
      storage
    })

    resizeBy('client', 24)

    expect(widths.client).toBe(224)
    expect(JSON.parse(read() ?? '{}')).toEqual({ code: 120, client: 224 })
  })

  it('expone un estilo de tabla fluido con minWidth según columnas', () => {
    const { tableStyle } = useResizableTableColumns({
      columns,
      storageKey: 'transaction-columns',
      storage: memoryStorage().storage,
      fixedWidth: 48
    })

    expect(tableStyle.value).toEqual({
      width: '100%',
      minWidth: '368px'
    })
  })
})
