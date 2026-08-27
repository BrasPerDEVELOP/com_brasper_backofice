/**
 * Modelo del reporte contable de una transacción: la misma información que
 * muestra la fila de la tabla, ordenada en secciones para imprimirla en PDF.
 *
 * Es lógica pura: recibe los valores ya formateados por la vista (para no
 * duplicar el formato de moneda/fecha) y decide qué se imprime y cómo se llama
 * el archivo. El render vive en `infrastructure/pdf`.
 */

export interface AccountingReportField {
  label: string
  value: string
}

export interface AccountingReportSection {
  title: string
  fields: AccountingReportField[]
}

/** Valores ya formateados tal cual se ven en la tabla de Contabilidad. */
export interface TransactionAccountingReportInput {
  code: string
  sendDate: string
  operationNumber: string
  client: string
  documentType: string
  documentNumber: string
  destinationAccount: string
  companyName: string
  originAmount: string
  destinationAmount: string
  exchangeRate: string
  /** Detalle del tipo de cambio, ej. `1 USD = 3.75 PEN`. */
  exchangeDetail: string
  /** Porcentaje de la comisión de contabilidad, ej. `3.50%`. */
  variableDiscount: string
  /** Comisión neta de IGV tras el descuento variable. */
  internalCommission: string
  /** IGV 18% de la comisión final interna. */
  internalTax: string
  /** Comisión final interna + impuesto. */
  internalSale: string
  specialDiscount: string
  status: string
  checked: boolean
  generatedAt: Date
}

export interface TransactionAccountingReport {
  title: string
  subtitle: string
  code: string
  fileName: string
  generatedAtLabel: string
  sections: AccountingReportSection[]
  /** Cifra que se imprime destacada al final: la venta final. */
  highlight: AccountingReportField
}

const EMPTY = '—'

/** Un valor vacío o placeholder de la tabla se imprime como guion largo. */
function display(value: string | null | undefined): string {
  const text = (value ?? '').trim()
  if (!text || text === '-' || text === EMPTY) return EMPTY
  return text
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** `YYYYMMDD` en hora local: el nombre del archivo sigue la fecha del usuario. */
function dateStamp(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
}

/** Deja solo caracteres seguros para un nombre de archivo. */
function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

export function buildAccountingPdfFileName(code: string, generatedAt: Date): string {
  const slug = slugify(code) || 'operacion'
  return `contabilidad-${slug}-${dateStamp(generatedAt)}.pdf`
}

function formatGeneratedAt(date: Date): string {
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date)
}

export function buildTransactionAccountingReport(
  input: TransactionAccountingReportInput
): TransactionAccountingReport {
  const code = display(input.code)

  return {
    title: 'Detalle contable de operación',
    subtitle: code === EMPTY ? 'Operación sin código' : `Operación ${code}`,
    code,
    fileName: buildAccountingPdfFileName(input.code, input.generatedAt),
    generatedAtLabel: `Generado el ${formatGeneratedAt(input.generatedAt)}`,
    highlight: { label: 'Venta final', value: display(input.internalSale) },
    sections: [
      {
        title: 'Operación',
        fields: [
          { label: 'Código', value: code },
          { label: 'Fecha de envío', value: display(input.sendDate) },
          { label: 'N° de operación', value: display(input.operationNumber) },
          { label: 'Estado', value: display(input.status) },
          { label: 'Verificada', value: input.checked ? 'Sí' : 'No' }
        ]
      },
      {
        title: 'Cliente y destino',
        fields: [
          { label: 'Cliente', value: display(input.client) },
          { label: 'Tipo de documento', value: display(input.documentType) },
          { label: 'Documento', value: display(input.documentNumber) },
          { label: 'Cuenta destino', value: display(input.destinationAccount) },
          { label: 'Razón social', value: display(input.companyName) }
        ]
      },
      {
        title: 'Montos',
        fields: [
          { label: 'Monto de envío', value: display(input.originAmount) },
          { label: 'Monto a recibir', value: display(input.destinationAmount) },
          { label: 'Tipo de cambio', value: display(input.exchangeRate) },
          { label: 'Equivalencia', value: display(input.exchangeDetail) }
        ]
      },
      {
        title: 'Resultado interno',
        fields: [
          { label: 'Descuento variable', value: display(input.variableDiscount) },
          { label: 'Comisión final interna', value: display(input.internalCommission) },
          { label: 'Impuesto final interno', value: display(input.internalTax) },
          { label: 'Venta final', value: display(input.internalSale) },
          { label: 'Descuento especial', value: display(input.specialDiscount) }
        ]
      }
    ]
  }
}
