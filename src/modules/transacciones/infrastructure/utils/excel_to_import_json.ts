import * as XLSX from 'xlsx'

export interface ImportTransactionItem {
  user_origin?: {
    user?: { names?: string; lastnames?: string; email?: string; password?: string }
    bank_account?: {
      bank_id?: string
      account_flow?: string
      account_holder_type?: string
      bank_country?: string
      holder_names?: string
      holder_surnames?: string
      /** Identificador, no cantidad: texto para conservar ceros iniciales. */
      document_number?: string
      pix_key?: string
      pix_key_type?: string
    }
  }
  user_destination?: {
    user?: { names?: string; lastnames?: string; email?: string; password?: string }
    bank_account?: {
      bank_id?: string
      account_flow?: string
      account_holder_type?: string
      bank_country?: string
      holder_names?: string
      holder_surnames?: string
      /** Identificador, no cantidad: texto para conservar ceros iniciales. */
      document_number?: string
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

export interface ImportPayload {
  items: ImportTransactionItem[]
}

const timestamp = () => Date.now().toString(36)

function str(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

function num(v: unknown): number {
  if (v == null || v === '') return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Documentos e identificadores viajan como texto de dígitos (el API los espera `str`). */
function digits(v: unknown): string | undefined {
  const cleaned = str(v).replace(/\D/g, '')
  return cleaned || undefined
}

/** Mapea una fila del Excel al formato de item esperado por el API. */
export function rowToImportItem(row: Record<string, unknown>): ImportTransactionItem {
  const get = (key: string, alt?: string) => str(row[key] ?? row[alt ?? ''])

  return {
    user_origin: {
      user: {
        names: get('origin_names', 'origin_user_names'),
        lastnames: get('origin_lastnames', 'origin_user_lastnames'),
        email: get('origin_email', 'origin_user_email') || `origin.${timestamp()}@import.local`,
        password: get('origin_password', 'origin_user_password') || 'Import123!'
      },
      bank_account: {
        bank_id: get('origin_bank_id', 'bank_id_origin'),
        account_flow: 'origin',
        account_holder_type: get('origin_account_holder_type') || 'naturalPerson',
        bank_country: get('origin_bank_country', 'bank_country_origin') || 'pe',
        holder_names: get('origin_holder_names', 'origin_names'),
        holder_surnames: get('origin_holder_surnames', 'origin_lastnames'),
        document_number: digits(row['origin_document_number'] ?? row['document_number_origin'])
      }
    },
    user_destination: {
      user: {
        names: get('dest_names', 'dest_user_names'),
        lastnames: get('dest_lastnames', 'dest_user_lastnames'),
        email: get('dest_email', 'dest_user_email') || `dest.${timestamp()}@import.local`,
        password: get('dest_password', 'dest_user_password') || 'Import123!'
      },
      bank_account: {
        bank_id: get('dest_bank_id', 'bank_id_dest'),
        account_flow: 'destination',
        account_holder_type: get('dest_account_holder_type') || 'naturalPerson',
        bank_country: get('dest_bank_country', 'bank_country_dest') || 'br',
        holder_names: get('dest_holder_names', 'dest_names'),
        holder_surnames: get('dest_holder_surnames', 'dest_lastnames'),
        pix_key: get('dest_pix_key', 'pix_key'),
        pix_key_type: get('dest_pix_key_type', 'pix_key_type') || 'email'
      }
    },
    transaction: {
      tax_rate_id: get('tax_rate_id'),
      commission_id: get('commission_id'),
      origin_amount: num(row['origin_amount'] ?? row['monto_origen']),
      destination_amount: num(row['destination_amount'] ?? row['monto_destino']),
      commission_result: num(row['commission_result'] ?? row['comision']),
      total_to_send: num(row['total_to_send'] ?? row['total_a_enviar']),
      send_date: get('send_date', 'fecha_envio') || undefined,
      payment_date: get('payment_date', 'fecha_pago') || undefined
    }
  }
}

/** Parsea un archivo Excel y devuelve el payload JSON para el endpoint de importación. */
export function excelToImportJson(file: File): Promise<ImportPayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        if (!data || !(data instanceof ArrayBuffer)) {
          reject(new Error('No se pudo leer el archivo'))
          return
        }
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheet = workbook.SheetNames[0]
        const sheet = firstSheet ? workbook.Sheets[firstSheet] : undefined
        if (!sheet) {
          reject(new Error('El archivo no contiene hojas'))
          return
        }
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
        const items = rows.map(rowToImportItem)
        resolve({ items })
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Error al parsear Excel'))
      }
    }
    reader.onerror = () => reject(new Error('Error al leer el archivo'))
    reader.readAsArrayBuffer(file)
  })
}

/** Lee un archivo JSON y devuelve el payload. */
export async function jsonFileToImportPayload(file: File): Promise<ImportPayload> {
  const text = await file.text()
  const parsed = JSON.parse(text) as unknown
  if (parsed == null || typeof parsed !== 'object') {
    throw new Error('El JSON no es válido')
  }
  const obj = parsed as Record<string, unknown>
  const items = Array.isArray(obj.items) ? obj.items : []
  return { items }
}
