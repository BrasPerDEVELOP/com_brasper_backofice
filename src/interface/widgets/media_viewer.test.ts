import { describe, expect, it } from 'vitest'
import { mediaViewerMimeType, resolveMediaViewerKind } from './media_viewer'

describe('resolveMediaViewerKind', () => {
  it('clasifica imágenes y PDF por Content-Type', () => {
    expect(resolveMediaViewerKind('image/png', '/media/voucher.bin')).toBe('image')
    expect(resolveMediaViewerKind('application/pdf; charset=binary', '/media/voucher.bin')).toBe(
      'pdf'
    )
  })

  it('usa la extensión solo para contenido genérico', () => {
    expect(resolveMediaViewerKind('application/octet-stream', '/media/send.JPG?version=1')).toBe(
      'image'
    )
    expect(resolveMediaViewerKind('', '/media/payment.pdf')).toBe('pdf')
  })

  it('rechaza SVG y formatos que no sean imagen o PDF', () => {
    expect(resolveMediaViewerKind('image/svg+xml', '/media/file.svg')).toBeNull()
    expect(resolveMediaViewerKind('text/html', '/media/file.png')).toBeNull()
    expect(resolveMediaViewerKind('application/zip', '/media/file.zip')).toBeNull()
  })

  it('define el MIME seguro para el blob mostrado', () => {
    expect(mediaViewerMimeType('image', 'image/webp', '/media/file.bin')).toBe('image/webp')
    expect(mediaViewerMimeType('image', 'application/octet-stream', '/media/file.JPG')).toBe(
      'image/jpeg'
    )
    expect(mediaViewerMimeType('pdf', 'application/octet-stream', '/media/file.pdf')).toBe(
      'application/pdf'
    )
  })
})
