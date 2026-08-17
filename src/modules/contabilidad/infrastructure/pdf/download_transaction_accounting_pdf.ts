import { downloadBlob } from '@/interface/infrastructure/services'
import {
  buildTransactionAccountingReport,
  type TransactionAccountingReportInput
} from '../../domain/transaction_accounting_report'
import { renderTransactionAccountingPdf } from './render_transaction_accounting_pdf'

const LOGO_URL = '/assets/logos/logo_completo.png'

let logoPromise: Promise<string | undefined> | null = null

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el logo'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Logo del encabezado. Se cachea entre descargas y, si falla (offline, 404),
 * devuelve `undefined`: el PDF se genera igual con el encabezado de texto.
 */
async function loadLogoDataUrl(): Promise<string | undefined> {
  if (!logoPromise) {
    logoPromise = (async () => {
      try {
        const response = await fetch(LOGO_URL)
        if (!response.ok) return undefined
        return await blobToDataUrl(await response.blob())
      } catch {
        return undefined
      }
    })()
  }
  return logoPromise
}

/** Genera y descarga el PDF contable de una transacción. */
export async function downloadTransactionAccountingPdf(
  input: TransactionAccountingReportInput
): Promise<void> {
  const report = buildTransactionAccountingReport(input)
  const blob = await renderTransactionAccountingPdf(report, {
    logoDataUrl: await loadLogoDataUrl()
  })
  downloadBlob(blob, report.fileName)
}
