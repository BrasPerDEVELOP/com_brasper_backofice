export function parseRecipients(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\s,;]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    )
  ]
}
export const statusLabel = (status: string) =>
  ({
    draft: 'Pendiente de envío',
    queued: 'En cola',
    completed: 'Procesada',
    pending: 'Pendiente',
    processing: 'En proceso / pendiente de confirmar',
    sent: 'Aceptado por SMTP',
    failed: 'Fallido',
    suppressed: 'Excluido por baja'
  })[status] ?? status
