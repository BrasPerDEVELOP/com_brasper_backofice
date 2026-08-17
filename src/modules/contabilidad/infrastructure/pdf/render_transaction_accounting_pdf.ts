import type { jsPDF } from 'jspdf'
import type {
  AccountingReportSection,
  TransactionAccountingReport
} from '../../domain/transaction_accounting_report'

/**
 * Dibuja el reporte contable de una transacción en un PDF A4.
 *
 * `jspdf` se importa de forma dinámica: solo se descarga cuando alguien pulsa
 * el botón, no en el bundle inicial del panel.
 */

const PAGE = { width: 595.28, height: 841.89 }
const MARGIN = 40
const CONTENT_WIDTH = PAGE.width - MARGIN * 2
const LABEL_WIDTH = 190
const VALUE_WIDTH = CONTENT_WIDTH - LABEL_WIDTH - 12
const LINE_HEIGHT = 13

// Paleta de marca (tailwind.config.js).
const INDIGO_STRONG: [number, number, number] = [63, 81, 181]
const INDIGO_DARK: [number, number, number] = [40, 53, 147]
const SLATE: [number, number, number] = [107, 114, 128]
const INK: [number, number, number] = [17, 24, 39]
const BAND: [number, number, number] = [238, 245, 255]
const EMERALD: [number, number, number] = [4, 120, 87]
const EMERALD_SOFT: [number, number, number] = [236, 253, 245]

export interface RenderAccountingPdfOptions {
  /** Logo en data URL. Si falta, el encabezado sale solo con texto. */
  logoDataUrl?: string
}

export async function renderTransactionAccountingPdf(
  report: TransactionAccountingReport,
  options: RenderAccountingPdfOptions = {}
): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true })

  let cursorY = drawHeader(doc, report, options.logoDataUrl)

  for (const section of report.sections) {
    cursorY = drawSection(doc, section, cursorY)
  }

  cursorY = drawHighlight(doc, report, cursorY)
  drawFooter(doc, report)

  return doc.output('blob')
}

/** El tipo viene de un `import type`: no arrastra `jspdf` al bundle inicial. */
type Doc = jsPDF

function drawHeader(doc: Doc, report: TransactionAccountingReport, logoDataUrl?: string): number {
  let textTop = MARGIN + 6

  if (logoDataUrl) {
    try {
      const props = doc.getImageProperties(logoDataUrl)
      const width = 132
      const height = props.height > 0 ? (props.height / props.width) * width : 34
      doc.addImage(logoDataUrl, 'PNG', MARGIN, MARGIN - 6, width, height)
      textTop = Math.max(textTop, MARGIN - 6 + height + 14)
    } catch {
      // Un logo ilegible no debe impedir la descarga del PDF.
    }
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.setTextColor(...INDIGO_STRONG)
    doc.text('BrasPer Transferencias', MARGIN, MARGIN + 8)
    textTop = MARGIN + 26
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...INDIGO_DARK)
  doc.text(report.title, MARGIN, textTop + 8)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...SLATE)
  doc.text(report.subtitle, MARGIN, textTop + 26)

  doc.setFontSize(9)
  doc.text(report.generatedAtLabel, PAGE.width - MARGIN, textTop + 26, { align: 'right' })

  const ruleY = textTop + 38
  doc.setFillColor(...INDIGO_STRONG)
  doc.rect(MARGIN, ruleY, CONTENT_WIDTH, 2, 'F')

  return ruleY + 24
}

/** Salta de página cuando la siguiente fila no entra en la actual. */
function ensureSpace(doc: Doc, cursorY: number, needed: number): number {
  if (cursorY + needed <= PAGE.height - MARGIN - 30) return cursorY
  doc.addPage()
  return MARGIN
}

function drawSection(doc: Doc, section: AccountingReportSection, startY: number): number {
  let cursorY = ensureSpace(doc, startY, 60)

  doc.setFillColor(...BAND)
  doc.rect(MARGIN, cursorY, CONTENT_WIDTH, 20, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...INDIGO_DARK)
  doc.text(section.title.toUpperCase(), MARGIN + 10, cursorY + 14)
  cursorY += 30

  for (const field of section.fields) {
    const valueLines = doc.splitTextToSize(field.value, VALUE_WIDTH) as string[]
    const rowHeight = Math.max(LINE_HEIGHT, valueLines.length * LINE_HEIGHT)
    cursorY = ensureSpace(doc, cursorY, rowHeight + 6)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...SLATE)
    doc.text(field.label, MARGIN + 10, cursorY)

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...INK)
    doc.text(valueLines, PAGE.width - MARGIN - 10, cursorY, { align: 'right' })

    cursorY += rowHeight + 6
  }

  return cursorY + 8
}

function drawHighlight(doc: Doc, report: TransactionAccountingReport, startY: number): number {
  const cursorY = ensureSpace(doc, startY, 56)

  doc.setFillColor(...EMERALD_SOFT)
  doc.rect(MARGIN, cursorY, CONTENT_WIDTH, 42, 'F')
  doc.setFillColor(...EMERALD)
  doc.rect(MARGIN, cursorY, 4, 42, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...EMERALD)
  doc.text(report.highlight.label.toUpperCase(), MARGIN + 16, cursorY + 18)

  doc.setFontSize(16)
  doc.text(report.highlight.value, PAGE.width - MARGIN - 16, cursorY + 28, { align: 'right' })

  return cursorY + 58
}

function drawFooter(doc: Doc, report: TransactionAccountingReport): void {
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...SLATE)
    doc.text(
      `BrasPer Transferencias · Documento interno · ${report.subtitle}`,
      MARGIN,
      PAGE.height - MARGIN + 10
    )
    doc.text(`Página ${page} de ${pages}`, PAGE.width - MARGIN, PAGE.height - MARGIN + 10, {
      align: 'right'
    })
  }
}
