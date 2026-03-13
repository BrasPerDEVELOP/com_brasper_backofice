import * as XLSX from 'xlsx'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const headers = [
  'bank_account_origin',
  'bank_account_destination',
  'user_id',
  'tax_rate_id',
  'commission_id',
  'origin_amount',
  'destination_amount',
  'code',
  'status',
  'send_date',
  'payment_date'
]

const ejemploFilas = [
  ['UUID-cuenta-origen', 'UUID-cuenta-destino', 'UUID-cliente', 'UUID-tasa', 'UUID-comision', 1000, 950, 'TRX-001', 'pending', '2025-03-05', '2025-03-06'],
  ['UUID-cuenta-origen', 'UUID-cuenta-destino', 'UUID-cliente', 'UUID-tasa', 'UUID-comision', 500, 475, 'TRX-002', 'pending', '2025-03-05', '']
]

const ws = XLSX.utils.aoa_to_sheet([headers, ...ejemploFilas])
ws['!cols'] = headers.map(() => ({ wch: 20 }))

const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'Transacciones')

const outPath = join(__dirname, '..', 'plantilla_transacciones_import_simple.xlsx')
XLSX.writeFile(wb, outPath)

console.log('Plantilla creada:', outPath)
