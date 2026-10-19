import { afterEach, describe, expect, it, vi } from 'vitest'
import { watchAppUpdates } from './app_updates'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
function setup(controlled = true) {
  vi.useFakeTimers()
  const worker = Object.assign(new EventTarget(), {
    controller: controlled ? {} : null,
    register: vi.fn()
  })
  const update = vi.fn().mockResolvedValue(undefined)
  worker.register.mockResolvedValue({ update })
  const win = Object.assign(new EventTarget(), { setInterval, clearInterval })
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  vi.stubGlobal('navigator', { serviceWorker: worker })
  vi.stubGlobal('window', win)
  vi.stubGlobal('document', doc)
  return { worker, win, doc, update }
}
describe('Application updates', () => {
  it('checks immediately and periodically, bypassing the HTTP worker cache', async () => {
    const { worker, update } = setup()
    const stop = watchAppUpdates(vi.fn())
    await vi.advanceTimersByTimeAsync(0)
    expect(worker.register).toHaveBeenCalledWith('/sw.js', { updateViaCache: 'none' })
    expect(update).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(60000)
    expect(update).toHaveBeenCalledTimes(2)
    stop()
  })
  it('notifies about a new controller without reloading or changing the session', () => {
    const { worker } = setup()
    const notify = vi.fn()
    const stop = watchAppUpdates(notify)
    worker.dispatchEvent(new Event('controllerchange'))
    expect(notify).toHaveBeenCalledOnce()
    stop()
    worker.dispatchEvent(new Event('controllerchange'))
    expect(notify).toHaveBeenCalledOnce()
  })
  it('does not announce the first install as an update', () => {
    const { worker } = setup(false)
    const notify = vi.fn()
    const stop = watchAppUpdates(notify)
    worker.dispatchEvent(new Event('controllerchange'))
    expect(notify).not.toHaveBeenCalled()
    worker.dispatchEvent(new Event('controllerchange'))
    expect(notify).toHaveBeenCalledOnce()
    stop()
  })
  it('retries failed registration on focus and pauses checks in hidden tabs', async () => {
    const { worker, win, doc, update } = setup()
    worker.register.mockRejectedValueOnce(new Error('offline'))
    const stop = watchAppUpdates(vi.fn())
    await vi.advanceTimersByTimeAsync(0)
    doc.visibilityState = 'hidden'
    await vi.advanceTimersByTimeAsync(60000)
    expect(worker.register).toHaveBeenCalledTimes(1)
    doc.visibilityState = 'visible'
    win.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(0)
    expect(update).toHaveBeenCalledOnce()
    stop()
    await vi.advanceTimersByTimeAsync(60000)
    expect(update).toHaveBeenCalledOnce()
  })
})
