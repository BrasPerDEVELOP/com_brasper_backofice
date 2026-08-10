import { describe, expect, it } from 'vitest'
import type { Transaction, TransactionTag } from '../../domain/models'
import {
  TRANSACTION_EXPORT_HEADERS,
  buildTransactionExportRows,
  transactionExportFilename,
  type TransactionExportContext
} from './transactions_export'

const tag = (id: string, label: string): TransactionTag => ({
  id,
  label,
  color: 'amber',
  active: true,
  counts_as_new_client: false,
  position: 0
})

const CATALOG: Record<string, TransactionTag> = {
  g1: tag('g1', 'Cliente nuevo'),
  g2: tag('g2', 'Recurrente')
}

const ctx: TransactionExportContext = {
  dailySequenceById: { t1: 7 },
  clientLabel: (id) => (id === 'u1' ? 'Marisol Quispe' : '—'),
  companyName: () => 'Brasper 21',
  destinationAccounts: () => 'BCP ***4471',
  currencies: () => ({ origin: 'BRL', destination: 'PEN' }),
  tagById: (id) => CATALOG[id]
}

const tx = (over: Partial<Transaction> = {}): Transaction =>
  ({
    id: 't1',
    code: 'BxP-376',
    user_id: 'u1',
    origin_amount: 300,
    destination_amount: 188,
    tax_amount: 0.65,
    status: 'completed',
    send_date: '2026-08-08T14:56:00',
    ...over
  }) as Transaction

function row(over: Partial<Transaction> = {}) {
  return buildTransactionExportRows([tx(over)], ctx)[0] as (string | number)[]
}

const col = (name: (typeof TRANSACTION_EXPORT_HEADERS)[number]) =>
  TRANSACTION_EXPORT_HEADERS.indexOf(name)

describe('exportación de transacciones a Excel', () => {
  it('cada fila tiene tantas celdas como cabeceras', () => {
    expect(row()).toHaveLength(TRANSACTION_EXPORT_HEADERS.length)
  })

  it('los importes salen como número para que Excel pueda sumarlos', () => {
    const r = row()
    expect(r[col('Monto de envío')]).toBe(300)
    expect(r[col('Monto a recibir')]).toBe(188)
    expect(typeof r[col('Monto de envío')]).toBe('number')
    // La moneda va aparte, no pegada al importe.
    expect(r[col('Moneda envío')]).toBe('BRL')
    expect(r[col('Moneda destino')]).toBe('PEN')
  })

  it('separa fecha y hora locales', () => {
    const r = row()
    expect(r[col('Fecha')]).toBe('2026-08-08')
    expect(r[col('Hora')]).toBe('14:56')
  })

  it('una fecha ilegible no rompe la exportación', () => {
    const r = row({ send_date: 'no-es-fecha' })
    expect(r[col('Fecha')]).toBe('')
    expect(r[col('Hora')]).toBe('')
  })

  it('incluye el número del envío dentro del día', () => {
    expect(row()[col('N° del día')]).toBe(7)
  })

  it('deja el número vacío si el día no se pudo numerar', () => {
    expect(row({ id: 'desconocido' })[col('N° del día')]).toBe('')
  })

  it('traduce los ids de etiqueta a nombres', () => {
    expect(row({ tag_ids: ['g1', 'g2'] })[col('Etiquetas')]).toBe(
      'Cliente nuevo, Recurrente'
    )
  })

  it('ignora etiquetas que ya no están en el catálogo', () => {
    expect(row({ tag_ids: ['g1', 'borrada'] })[col('Etiquetas')]).toBe('Cliente nuevo')
  })

  it('sin etiquetas deja la celda vacía', () => {
    expect(row()[col('Etiquetas')]).toBe('')
  })

  it('marca los comprobantes presentes, incluidos los múltiples', () => {
    const r = row({ send_voucher: ['a.webp', 'b.webp'], payment_voucher: '' })
    expect(r[col('Comp. envío')]).toBe('Sí')
    expect(r[col('Comp. pago')]).toBe('No')
  })

  it('traduce el estado a su etiqueta en español', () => {
    expect(row()[col('Estado')]).toBe('Finalizada')
    expect(row({ status: 'failed' })[col('Estado')]).toBe('Fallida')
  })

  it('el nombre del archivo dice qué alcance se descargó', () => {
    expect(transactionExportFilename('day', '2026-08-09', '2026-08-10')).toBe(
      'transacciones_2026-08-09.xlsx'
    )
    expect(transactionExportFilename('all', '2026-08-09', '2026-08-10')).toBe(
      'transacciones_todas_2026-08-10.xlsx'
    )
  })

  it('exportar una lista vacía no falla', () => {
    expect(buildTransactionExportRows([], ctx)).toEqual([])
  })
})
