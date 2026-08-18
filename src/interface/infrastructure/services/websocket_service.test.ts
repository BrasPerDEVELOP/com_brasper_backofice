import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WebSocketService } from './websocket_service'

class MockWebSocket {
  public static instances: MockWebSocket[] = []
  public static OPEN = 1
  public static CLOSED = 3
  public static CONNECTING = 0

  public readyState = MockWebSocket.CONNECTING
  public url: string
  public onopen: (() => void) | null = null
  public onclose: (() => void) | null = null
  public onerror: ((err: unknown) => void) | null = null
  public onmessage: ((event: { data: string }) => void) | null = null
  public sent: string[] = []

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  public simulateOpen() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.()
  }

  public simulateMessage(data: Record<string, unknown> | string) {
    const raw = typeof data === 'string' ? data : JSON.stringify(data)
    this.onmessage?.({ data: raw })
  }

  public simulateClose() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.()
  }

  public send(data: string) {
    this.sent.push(data)
  }

  public close() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.()
  }
}

describe('WebSocketService', () => {
  const originalWs = global.WebSocket

  beforeEach(() => {
    MockWebSocket.instances = []
    global.WebSocket = MockWebSocket as unknown as typeof WebSocket
    vi.useFakeTimers()
  })

  afterEach(() => {
    global.WebSocket = originalWs
    vi.useRealTimers()
  })

  it('inicia en estado disconnected y cambia a connected al abrir', () => {
    const service = new WebSocketService('ws://localhost:8000/ws')
    expect(service.currentStatus).toBe('disconnected')
    expect(service.isConnected).toBe(false)

    service.connect()
    expect(service.currentStatus).toBe('connecting')

    const mockWs = MockWebSocket.instances[0]
    expect(mockWs).toBeDefined()
    mockWs.simulateOpen()

    expect(service.currentStatus).toBe('connected')
    expect(service.isConnected).toBe(true)

    service.disconnect()
    expect(service.currentStatus).toBe('disconnected')
  })

  it('despacha mensajes recibidos a listeners específicos y globales', () => {
    const service = new WebSocketService('ws://localhost:8000/ws')
    service.connect()
    const mockWs = MockWebSocket.instances[0]
    mockWs.simulateOpen()

    const onCreated = vi.fn()
    const onGlobal = vi.fn()

    service.on('transaction_created', onCreated)
    service.onGlobalMessage(onGlobal)

    mockWs.simulateMessage({
      event: 'TRANSACTION_CREATED',
      data: { id: 'tx_123' }
    })

    expect(onCreated).toHaveBeenCalledTimes(1)
    expect(onCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'TRANSACTION_CREATED',
        data: { id: 'tx_123' }
      })
    )
    expect(onGlobal).toHaveBeenCalledTimes(1)

    service.disconnect()
  })

  it('envía heartbeat ping periódicamente', () => {
    const service = new WebSocketService('ws://localhost:8000/ws', {
      heartbeatIntervalMs: 5000
    })
    service.connect()
    const mockWs = MockWebSocket.instances[0]
    mockWs.simulateOpen()

    vi.advanceTimersByTime(5000)
    expect(mockWs.sent).toContain(JSON.stringify({ type: 'ping' }))

    service.disconnect()
  })

  it('reintenta reconexión tras cierre inesperado con backoff', () => {
    const service = new WebSocketService('ws://localhost:8000/ws', {
      initialReconnectDelayMs: 1000,
      autoReconnect: true
    })
    service.connect()
    let mockWs = MockWebSocket.instances[0]
    mockWs.simulateOpen()

    // Simular caída
    mockWs.simulateClose()
    expect(service.currentStatus).toBe('reconnecting')

    // Avanzar tiempo para que dispare reconexión
    vi.advanceTimersByTime(2000)
    expect(MockWebSocket.instances.length).toBe(2)
    mockWs = MockWebSocket.instances[1]
    mockWs.simulateOpen()

    expect(service.currentStatus).toBe('connected')
    service.disconnect()
  })
})
