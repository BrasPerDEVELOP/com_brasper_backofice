import { describe, expect, it } from 'vitest'
import { rowToImportItem } from './excel_to_import_json'
import { brasperRowToImportItem } from './excel_brasper_format'

/**
 * El API recibe los documentos como texto (migración 061: BIGINT → VARCHAR).
 * Enviarlos como número perdía el cero inicial del DNI/CE.
 */
describe('identificadores en la importación de Excel', () => {
  it('envía el documento como texto conservando el cero inicial', () => {
    const item = rowToImportItem({ origin_document_number: '01234567' })

    expect(item.user_origin?.bank_account?.document_number).toBe('01234567')
  })

  it('normaliza documentos numéricos de Excel a texto', () => {
    const item = rowToImportItem({ document_number_origin: 12345678 })

    expect(item.user_origin?.bank_account?.document_number).toBe('12345678')
  })

  it('omite el documento cuando la celda viene vacía', () => {
    const item = rowToImportItem({ origin_document_number: '' })

    expect(item.user_origin?.bank_account?.document_number).toBeUndefined()
  })

  it('descarta separadores del documento', () => {
    const item = rowToImportItem({ origin_document_number: '012-345.67' })

    expect(item.user_origin?.bank_account?.document_number).toBe('01234567')
  })

  it('formato Brasper: envía el DNI como texto con cero inicial', () => {
    const item = brasperRowToImportItem({
      Nombre: 'Ana Torres',
      Correo: 'ana@example.com',
      'DNI/CE': '01234567'
    })

    expect(item.user_origin?.bank_account?.document_number).toBe('01234567')
  })

  it('formato Brasper: omite el DNI cuando no viene', () => {
    const item = brasperRowToImportItem({ Nombre: 'Ana Torres', Correo: 'ana@example.com' })

    expect(item.user_origin?.bank_account?.document_number).toBeUndefined()
  })
})
