import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TransactionsRealtimeClient } from './transactions_realtime_client'

class MockWs {
  public static instances: MockWs[] = []
  public static OPEN = 1
  public static CLOSED = 3

  public readyState = MockWs.OPEN
  public onopen: (() => void) | null = null
  public onclose: (() => void) | null = null
  public onmessage: ((event: { data: string }) => void) | null = null

  constructor() {
    MockWs.instances.push(this)
    setTimeout(() => this.onopen?.(), 0)
  }

  public simulateMessage(data: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(data) })
  }

  public close() {
    this.readyState = MockWs.CLOSED
    this.onclose?.()
  }

  public send() {}
}

describe('TransactionsRealtimeClient', () => {
  const originalWs = global.WebSocket

  beforeEach(() => {
    MockWs.instances = []
    global.WebSocket = MockWs as unknown as typeof WebSocket
    vi.useFakeTimers()
  })

  afterEach(() => {
    global.WebSocket = originalWs
    vi.useRealTimers()
  })

  it('normaliza y procesa evento TRANSACTION_CREATED', () => {
    const onCreated = vi.fn()
    const client = new TransactionsRealtimeClient(() => 'test-token')

    client.connect({ onCreated })
    const mockWs = MockWs.instances[0]
    mockWs.onopen?.()

    mockWs.simulateMessage({
      event: 'TRANSACTION_CREATED',
      data: {
        id: 'tx_abc',
        transaction_code: 'TRS-001',
        origin_amount: 100
      }
    })

    expect(onCreated).toHaveBeenCalledTimes(1)
    expect(onCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'tx_abc',
        transaction_code: 'TRS-001'
      }),
      undefined
    )

    client.disconnect()
  })

  it('normaliza y procesa evento TRANSACTION_UPDATED', () => {
    const onUpdated = vi.fn()
    const client = new TransactionsRealtimeClient(() => 'test-token')

    client.connect({ onUpdated })
    const mockWs = MockWs.instances[0]
    mockWs.onopen?.()

    mockWs.simulateMessage({
      event: 'transaction.updated',
      data: {
        id: 'tx_abc',
        status: 'completed'
      }
    })

    expect(onUpdated).toHaveBeenCalledTimes(1)
    expect(onUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'tx_abc',
        status: 'completed'
      }),
      undefined
    )

    client.disconnect()
  })

  it('normaliza y procesa evento TRANSACTION_DELETED', () => {
    const onDeleted = vi.fn()
    const client = new TransactionsRealtimeClient(() => 'test-token')

    client.connect({ onDeleted })
    const mockWs = MockWs.instances[0]
    mockWs.onopen?.()

    mockWs.simulateMessage({
      event: 'transaction_deleted',
      data: {
        id: 'tx_to_delete'
      }
    })

    expect(onDeleted).toHaveBeenCalledTimes(1)
    expect(onDeleted).toHaveBeenCalledWith('tx_to_delete', undefined)

    client.disconnect()
  })

  it('deriva a onPartial un evento recortado en lugar de mapear la fila', () => {
    const onPartial = vi.fn()
    const onUpdated = vi.fn()
    const client = new TransactionsRealtimeClient(() => 'test-token')

    client.connect({ onPartial, onUpdated })
    const mockWs = MockWs.instances[0]
    mockWs.onopen?.()

    mockWs.simulateMessage({
      event: 'TRANSACTION_UPDATED',
      partial: true,
      data: { id: 'tx_partial', user_id: 'u1' }
    })

    expect(onPartial).toHaveBeenCalledWith('tx_partial', undefined)
    expect(onUpdated).not.toHaveBeenCalled()

    client.disconnect()
  })

  it('procesa un borrado recortado sin pasar por onPartial', () => {
    const onPartial = vi.fn()
    const onDeleted = vi.fn()
    const client = new TransactionsRealtimeClient(() => 'test-token')

    client.connect({ onPartial, onDeleted })
    const mockWs = MockWs.instances[0]
    mockWs.onopen?.()

    mockWs.simulateMessage({
      event: 'TRANSACTION_DELETED',
      partial: true,
      data: { id: 'tx_gone' }
    })

    expect(onDeleted).toHaveBeenCalledWith('tx_gone', undefined)
    expect(onPartial).not.toHaveBeenCalled()

    client.disconnect()
  })

  it('procesa CLIENT_DATA_STATUS_UPDATED sin confundirlo con una transacción', () => {
    const onClientDataStatusUpdated = vi.fn()
    const onUpdated = vi.fn()
    const client = new TransactionsRealtimeClient(() => 'test-token')

    client.connect({ onClientDataStatusUpdated, onUpdated })
    const mockWs = MockWs.instances[0]
    mockWs.onopen?.()

    mockWs.simulateMessage({
      event: 'CLIENT_DATA_STATUS_UPDATED',
      data: { user_id: 'user-9' }
    })

    expect(onClientDataStatusUpdated).toHaveBeenCalledWith('user-9')
    expect(onUpdated).not.toHaveBeenCalled()

    client.disconnect()
  })
})
