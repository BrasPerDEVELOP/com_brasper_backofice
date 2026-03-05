import * as XLSX from 'xlsx'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const headers = ['email', 'nombres', 'apellidos', 'tipo_documento', 'n_documento', 'rol']

const ejemploFilas = [
  ['usuario1@ejemplo.com', 'Juan', 'Pérez García', 'DNI', '12345678', 'client'],
  ['usuario2@ejemplo.com', 'María', 'López Sánchez', 'DNI', '87654321', 'client'],
  ['admin@ejemplo.com', 'Carlos', 'Rodríguez', 'CE', '11223344', 'admin'],
  ['ventas@ejemplo.com', 'Ana', 'Martínez', 'DNI', '55667788', 'sales']
]

const ws = XLSX.utils.aoa_to_sheet([headers, ...ejemploFilas])
ws['!cols'] = [
  { wch: 25 },
  { wch: 25 },
  { wch: 25 },
  { wch: 15 },
  { wch: 12 },
  { wch: 12 }
]

const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'Usuarios')

const outPath = join(__dirname, '..', 'plantilla_usuarios.xlsx')
XLSX.writeFile(wb, outPath)

console.log('Plantilla creada:', outPath)
