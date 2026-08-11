export type MediaViewerKind = 'image' | 'pdf'

const IMAGE_EXTENSION_PATTERN = /\.(?:avif|bmp|gif|jpe?g|png|webp)(?:$|[?#])/i
const PDF_EXTENSION_PATTERN = /\.pdf(?:$|[?#])/i
const IMAGE_MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
}

function normalizedContentType(contentType: string | null | undefined): string {
  return (contentType ?? '').split(';', 1)[0]?.trim().toLowerCase() ?? ''
}

export function resolveMediaViewerKind(
  contentType: string | null | undefined,
  source: string
): MediaViewerKind | null {
  const normalizedType = normalizedContentType(contentType)

  if (normalizedType.startsWith('image/') && normalizedType !== 'image/svg+xml') return 'image'
  if (normalizedType === 'application/pdf') return 'pdf'

  if (!normalizedType || normalizedType === 'application/octet-stream') {
    if (IMAGE_EXTENSION_PATTERN.test(source)) return 'image'
    if (PDF_EXTENSION_PATTERN.test(source)) return 'pdf'
  }

  return null
}

export function mediaViewerMimeType(
  kind: MediaViewerKind,
  contentType: string | null | undefined,
  source: string
): string {
  if (kind === 'pdf') return 'application/pdf'

  const normalizedType = normalizedContentType(contentType)
  if (normalizedType.startsWith('image/') && normalizedType !== 'image/svg+xml') {
    return normalizedType
  }

  const extension = source.match(/\.([a-z0-9]+)(?:$|[?#])/i)?.[1]?.toLowerCase() ?? ''
  return IMAGE_MIME_BY_EXTENSION[extension] ?? 'application/octet-stream'
}
