import * as XLSX from 'xlsx'
import type { ImportTransactionItem } from './excel_to_import_json'

const timestamp = () => Date.now().toString(36)

function str(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

function num(v: unknown): number {
  if (v == null || v === '') return 0
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const s = String(v).replace(/[^\d.-]/g, '').replace(',', '')
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

/** Documentos e identificadores viajan como texto de dígitos (el API los espera `str`). */
function digits(v: unknown): string {
  return str(v).replace(/\D/g, '')
}

/** Convierte fecha Excel (número) a YYYY-MM-DD */
function excelDateToIso(v: unknown): string {
  if (v == null) return ''
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return ''
  const date = new Date((n - 25569) * 86400 * 1000)
  return date.toISOString().slice(0, 10)
}

function get(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (v != null && String(v).trim()) return str(v)
  }
  return ''
}

/** Detecta si el Excel tiene formato Brasper (columnas Nombre, Correo, ENVÍA, etc.) */
export function isBrasperFormat(rows: Record<string, unknown>[]): boolean {
  if (rows.length === 0) return false
  const keys = Object.keys(rows[0] ?? {})
  return (
    keys.some((k) => k.includes('Nombre')) &&
    keys.some((k) => k.includes('Correo')) &&
    (keys.some((k) => k.includes('ENVÍA')) || keys.some((k) => k.includes('RECIBE')))
  )
}

/** Mapea una fila del Excel Brasper al ImportTransactionItem. */
export function brasperRowToImportItem(row: Record<string, unknown>): ImportTransactionItem {
  const nombre = get(row, 'Nombre', 'nombre')
  const parts = nombre ? nombre.split(/\s+/).filter(Boolean) : []
  const names = parts[0] ?? ''
  const lastnames = parts.slice(1).join(' ') ?? ''

  const email = get(row, 'Correo', 'correo') || `import.${timestamp()}@brasper.local`
  const documentNumber = digits(row['DNI/CE'] ?? row['DNI'] ?? row['documento'])
  const banco = get(row, 'Banco', 'banco')
  const cuenta = get(row, 'Cuenta', 'cuenta')

  const originAmount = num(row['ENVÍA\n(PEN)'] ?? row['ENVÍA (PEN)'] ?? row['ENVÍA'] ?? row['monto_origen'])
  const destinationAmount = num(row['RECIBE\n(BRL)'] ?? row['RECIBE (BRL)'] ?? row['RECIBE'] ?? row['monto_destino'])
  const totalEnviar = num(row['Total \nEnviar'] ?? row['Total Enviar'] ?? row['total_a_enviar'])
  const comision = num(row['Comisión\n(CLIENTE)'] ?? row['Comisión (CLIENTE)'] ?? row['Comisión final\ninterna'] ?? row['comision'])

  const fechaEnvio = excelDateToIso(row['Fecha del envío'] ?? row['fecha_envio'])
  const fechaEmision = excelDateToIso(row['Fecha de emisión'] ?? row['fecha_emision'])

  return {
    user_origin: {
      user: {
        names,
        lastnames,
        email,
        password: 'Import123!'
      },
      bank_account: {
        bank_id: banco || cuenta || 'pe',
        account_flow: 'origin',
        account_holder_type: 'naturalPerson',
        bank_country: 'pe',
        holder_names: names,
        holder_surnames: lastnames,
        document_number: documentNumber || undefined
      }
    },
    user_destination: {
      user: {
        names,
        lastnames,
        email,
        password: 'Import123!'
      },
      bank_account: {
        bank_id: 'br',
        account_flow: 'destination',
        account_holder_type: 'naturalPerson',
        bank_country: 'br',
        holder_names: names,
        holder_surnames: lastnames,
        pix_key: email,
        pix_key_type: 'email'
      }
    },
    transaction: {
      origin_amount: originAmount || destinationAmount,
      destination_amount: destinationAmount || originAmount,
      commission_result: comision || undefined,
      total_to_send: totalEnviar || undefined,
      send_date: fechaEnvio || undefined,
      payment_date: fechaEmision || undefined
    }
  }
}

/** Parsea Excel formato Brasper y devuelve ImportPayload para POST /transactions/import */
export function excelBrasperToImportPayload(file: File): Promise<{ items: ImportTransactionItem[] }> {
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
        if (rows.length === 0) {
          resolve({ items: [] })
          return
        }
        if (!isBrasperFormat(rows)) {
          reject(new Error('El archivo no tiene el formato Brasper esperado (columnas: Nombre, Correo, ENVÍA, RECIBE)'))
          return
        }
        const items = rows.map(brasperRowToImportItem)
        resolve({ items })
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Error al parsear Excel'))
      }
    }
    reader.onerror = () => reject(new Error('Error al leer el archivo'))
    reader.readAsArrayBuffer(file)
  })
}
