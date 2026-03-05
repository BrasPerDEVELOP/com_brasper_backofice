import * as XLSX from 'xlsx'
import type { CreateUserPayload } from '../adapters/users_management_api_adapter'

function str(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

function get(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (v != null && String(v).trim()) return str(v)
  }
  return ''
}

/** Mapea una fila del Excel al formato CreateUserPayload. */
export function rowToUserPayload(
  row: Record<string, unknown>,
  defaultRole?: string
): CreateUserPayload | null {
  const email = get(row, 'email', 'correo', 'mail')
  if (!email) return null

  const fullName = get(row, 'nombres', 'names', 'nombre', 'name')
  const parts = fullName ? fullName.split(/\s+/) : []
  const names = parts[0] ?? ''
  const lastnames = parts.slice(1).join(' ') ?? get(row, 'apellidos', 'lastnames', 'apellido')

  const documentType = get(row, 'tipo_documento', 'document_type', 'tipo documento')
  const docType = documentType
    ? documentType.toLowerCase().replace(/\s/g, '')
    : undefined
  const docTypeMap: Record<string, string> = {
    dni: 'dni',
    ce: 'ce',
    cedula: 'ce',
    passport: 'passport',
    pasaporte: 'passport'
  }
  const document_type = docType ? docTypeMap[docType] ?? docType : undefined

  const document_number = get(row, 'n_documento', 'document_number', 'documento', 'n. documento', 'numero_documento')

  const roleRaw = get(row, 'rol', 'role')
  const role = roleRaw
    ? roleRaw.toLowerCase().replace(/\s/g, '')
    : defaultRole

  return {
    email,
    names: names || undefined,
    lastnames: lastnames || undefined,
    role: role || defaultRole || 'client',
    document_type: document_type || undefined,
    document_number: document_number || undefined
  }
}

/** Parsea un archivo Excel y devuelve un array de CreateUserPayload. */
export function parseUsersFromExcel(
  file: File,
  defaultRole = 'client'
): Promise<CreateUserPayload[]> {
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
        const payloads = rows
          .map((row) => rowToUserPayload(row, defaultRole))
          .filter((p): p is CreateUserPayload => p != null)
        resolve(payloads)
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Error al parsear Excel'))
      }
    }
    reader.onerror = () => reject(new Error('Error al leer el archivo'))
    reader.readAsArrayBuffer(file)
  })
}
