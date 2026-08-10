import { describe, it, expect } from 'vitest'
import {
  parseTransaction,
  transactionFromApiRecord,
  attachmentStrings,
  normalizeAttachmentValues
} from './parse_transaction'
import { parseTransactions } from './transaction_list_response'

describe('parseTransaction', () => {
  it('devuelve {} para payloads no-objeto', () => {
    expect(parseTransaction(null)).toEqual({})
    expect(parseTransaction(undefined)).toEqual({})
    expect(parseTransaction('x')).toEqual({})
    expect(parseTransaction(3)).toEqual({})
  })

  it('mapea campos núcleo con stringificado de id/code', () => {
    const t = parseTransaction({ id: 42, code: 7, status: 'completed' })
    expect(t.id).toBe('42')
    expect(t.code).toBe('7')
    expect(t.status).toBe('completed')
  })

  it('coacciona montos a número con default 0', () => {
    expect(parseTransaction({ origin_amount: '100.5' }).origin_amount).toBe(100.5)
    expect(parseTransaction({ destination_amount: 'x' }).destination_amount).toBe(0)
    expect(parseTransaction({}).origin_amount).toBe(0)
  })

  it('normaliza múltiples cuentas destino', () => {
    expect(parseTransaction({
      destinations: [
        { id: 1, bank_account_id: 'bcp', amount: '300', position: 0 },
        { id: 2, bank_account: { id: 'interbank' }, amount: 330, position: 1 }
      ]
    }).destinations).toEqual([
      { id: '1', bank_account_id: 'bcp', amount: 300, position: 0 },
      { id: '2', bank_account_id: 'interbank', amount: 330, position: 1 }
    ])
  })

  it('resuelve alias de estado (estado/transaction_status/state)', () => {
    expect(parseTransaction({ estado: 'pending' }).status).toBe('pending')
    expect(parseTransaction({ transaction_status: 'failed' }).status).toBe('failed')
    expect(parseTransaction({ state: 'verified' }).status).toBe('verified')
  })

  it('deriva checked desde cualquiera de las banderas', () => {
    expect(parseTransaction({ checked: true }).checked).toBe(true)
    expect(parseTransaction({ is_verified: '1' }).checked).toBe(true)
    expect(parseTransaction({ has_checked_image: 1 }).checked).toBe(true)
    expect(parseTransaction({ checked: false }).checked).toBe(false)
    expect(parseTransaction({}).checked).toBe(false)
  })

  it('resuelve alias de razón social a company_name', () => {
    expect(parseTransaction({ razon_social: '  ACME  ' }).company_name).toBe('ACME')
    expect(parseTransaction({ business_name: 'BizCo' }).company_name).toBe('BizCo')
  })

  it('conserva el id exacto del banco usado como razón social', () => {
    expect(
      parseTransaction({ social_reason_bank_id: '  santander-id  ' })
        .social_reason_bank_id
    ).toBe('santander-id')
    expect(
      parseTransaction({ social_reason_bank: { id: 'picpay-id' } })
        .social_reason_bank_id
    ).toBe('picpay-id')
    expect(parseTransaction({ social_reason_bank_id: null }).social_reason_bank_id).toBeNull()
  })

  it('coacciona user_id/agent_id desde string u objeto anidado', () => {
    expect(parseTransaction({ user_id: 'u1' }).user_id).toBe('u1')
    expect(parseTransaction({ user: { id: 'u2' } }).user_id).toBe('u2')
    // agent_id cae a user_id si no viene agente
    expect(parseTransaction({ user_id: 'u3' }).agent_id).toBe('u3')
    expect(parseTransaction({ agent_id: 'a1', user_id: 'u3' }).agent_id).toBe('a1')
  })

  it('usa commission_result explícito o el resultado calculado', () => {
    expect(parseTransaction({ commission_result: '12.5' }).commission_result).toBe(12.5)
  })
})

describe('attachmentStrings / normalizeAttachmentValues', () => {
  it('normaliza y deduplica strings, ignorando vacíos', () => {
    expect(attachmentStrings('a', 'a', ' b ', '', null)).toEqual(['a', 'b'])
  })

  it('aplana arrays y descarta no-strings/no-File', () => {
    expect(normalizeAttachmentValues(['a', ['b', ''], null, 3])).toEqual(['a', 'b'])
  })
})

describe('transactionFromApiRecord', () => {
  it('combina el crudo con el parse sin pisar con undefined', () => {
    const rec = transactionFromApiRecord({ id: 1, code: 'TX1', extra_field: 'keep' })
    expect(rec.id).toBe('1')
    expect(rec.code).toBe('TX1')
    // campos crudos no mapeados se conservan
    expect((rec as Record<string, unknown>).extra_field).toBe('keep')
  })

  it('rellena origin/destination desde claves anidadas del detalle', () => {
    const rec = transactionFromApiRecord({
      id: 1,
      bank_account_origin: { id: 'orig-1' },
      cuenta_destino_id: 'dest-1'
    })
    expect(rec.bank_account_origin_id).toBe('orig-1')
    expect(rec.bank_account_destination_id).toBe('dest-1')
  })
})

describe('parseTransactions', () => {
  it('extrae y parsea una lista desde un payload paginado', () => {
    const out = parseTransactions({ data: [{ id: 1 }, { id: 2 }] })
    expect(out.map((t) => t.id)).toEqual(['1', '2'])
  })

  it('devuelve [] para payloads sin lista', () => {
    expect(parseTransactions(null)).toEqual([])
    expect(parseTransactions({})).toEqual([])
  })
})

describe('etiquetas del envío', () => {
  it('lee tag_ids como lista de strings', () => {
    const t = transactionFromApiRecord({ id: '1', tag_ids: ['a', 'b'] })
    expect(t.tag_ids).toEqual(['a', 'b'])
  })

  it('acepta tags expandidas como objetos', () => {
    const t = transactionFromApiRecord({ id: '1', tags: [{ id: 'a' }, { id: 'b' }] })
    expect(t.tag_ids).toEqual(['a', 'b'])
  })

  it('descarta duplicados y vacíos', () => {
    const t = transactionFromApiRecord({ id: '1', tag_ids: ['a', 'a', '', '  ', 'b'] })
    expect(t.tag_ids).toEqual(['a', 'b'])
  })

  it('sin etiquetas queda undefined, no una lista falsa', () => {
    expect(transactionFromApiRecord({ id: '1' }).tag_ids).toBeUndefined()
  })

  it('normaliza un tag_ids en texto para que nunca llegue un string al modelo', () => {
    // El merge del parser deja pasar el registro crudo: si esto devolviera
    // undefined, `tag_ids` quedaría como string y `.map` reventaría en la tabla.
    expect(transactionFromApiRecord({ id: '1', tag_ids: 'a,b' }).tag_ids).toEqual([
      'a',
      'b'
    ])
    expect(transactionFromApiRecord({ id: '1', tag_ids: '["a"]' }).tag_ids).toEqual(['a'])
    expect(transactionFromApiRecord({ id: '1', tag_ids: '' }).tag_ids).toEqual([])
    expect(transactionFromApiRecord({ id: '1', tag_ids: 42 }).tag_ids).toEqual([])
  })
})
