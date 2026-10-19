/** Check for new releases without reloading forms or deleting sessions. */
export function watchAppUpdates(onUpdate: () => void): () => void {
  if (!('serviceWorker' in navigator)) return () => {}
  const worker = navigator.serviceWorker
  let controlled = !!worker.controller
  let stopped = false
  let checking = false
  let registration: ServiceWorkerRegistration | undefined
  const changed = () => {
    if (controlled) onUpdate()
    controlled = true
  }
  const check = async () => {
    if (stopped || checking || document.visibilityState !== 'visible') return
    checking = true
    try {
      registration ??= await worker.register('/sw.js', { updateViaCache: 'none' })
      if (!stopped) await registration.update()
    } catch {
      // Offline or temporarily unavailable: retry on focus or the next interval.
    } finally {
      checking = false
    }
  }
  worker.addEventListener('controllerchange', changed)
  window.addEventListener('focus', check)
  document.addEventListener('visibilitychange', check)
  const timer = window.setInterval(check, 60000)
  void check()
  return () => {
    stopped = true
    window.clearInterval(timer)
    worker.removeEventListener('controllerchange', changed)
    window.removeEventListener('focus', check)
    document.removeEventListener('visibilitychange', check)
  }
}
