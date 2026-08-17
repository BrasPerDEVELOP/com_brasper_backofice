/**
 * Descarga un Blob como archivo. El `<a download>` se crea y se descarta en el
 * momento; el object URL se revoca en el siguiente tick para no cancelar la
 * descarga en navegadores que la resuelven de forma asíncrona.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
