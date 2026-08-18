import { createLoggerWithContext } from '@/interface/infrastructure/logger'

const log = createLoggerWithContext('websocket')

export type WebSocketStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

export interface WebSocketMessage<T = unknown> {
  event?: string
  type?: string
  data?: T
  payload?: T
  timestamp?: string
  [key: string]: unknown
}

export type MessageHandler<T = unknown> = (message: WebSocketMessage<T>) => void
export type StatusChangeHandler = (status: WebSocketStatus) => void

export interface WebSocketServiceOptions {
  /** Milisegundos entre pings de heartbeat (default: 30000). 0 para deshabilitar. */
  heartbeatIntervalMs?: number
  /** Timeout para considerar reconexión en milisegundos (default: 1000). */
  initialReconnectDelayMs?: number
  /** Máximo delay de reconexión (default: 30000). */
  maxReconnectDelayMs?: number
  /** Multiplicador para exponential backoff (default: 2). */
  backoffFactor?: number
  /** Si true, reconecta automáticamente tras caídas de conexión (default: true). */
  autoReconnect?: boolean
  /** Mensaje enviado en heartbeat ping (default: { type: 'ping' }). */
  pingPayload?: Record<string, unknown>
}

export class WebSocketService {
  private socket: WebSocket | null = null
  private urlGetter: () => string
  private status: WebSocketStatus = 'disconnected'
  private messageListeners = new Map<string, Set<MessageHandler>>()
  private globalListeners = new Set<MessageHandler>()
  private statusListeners = new Set<StatusChangeHandler>()
  private reconnectListeners = new Set<() => void>()

  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private currentReconnectDelayMs: number
  private isManuallyClosed = false
  private hadConnectedBefore = false

  private readonly options: Required<WebSocketServiceOptions>

  constructor(
    urlOrGetter: string | (() => string),
    options?: WebSocketServiceOptions
  ) {
    this.urlGetter = typeof urlOrGetter === 'function' ? urlOrGetter : () => urlOrGetter
    this.options = {
      heartbeatIntervalMs: options?.heartbeatIntervalMs ?? 30_000,
      initialReconnectDelayMs: options?.initialReconnectDelayMs ?? 1_000,
      maxReconnectDelayMs: options?.maxReconnectDelayMs ?? 30_000,
      backoffFactor: options?.backoffFactor ?? 2,
      autoReconnect: options?.autoReconnect ?? true,
      pingPayload: options?.pingPayload ?? { type: 'ping' }
    }
    this.currentReconnectDelayMs = this.options.initialReconnectDelayMs
  }

  public get currentStatus(): WebSocketStatus {
    return this.status
  }

  public get isConnected(): boolean {
    return this.status === 'connected'
  }

  public connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return
    }

    this.isManuallyClosed = false
    this.clearTimers()

    const url = this.urlGetter()
    if (!url) {
      log.warn('WebSocket: No se proporcionó URL válida para conectar.')
      this.setStatus('disconnected')
      return
    }

    this.setStatus(this.hadConnectedBefore ? 'reconnecting' : 'connecting')

    try {
      this.socket = new WebSocket(url)
      this.setupSocketEvents(this.socket)
    } catch (err) {
      log.error('WebSocket: Error al instanciar socket', err)
      this.handleSocketClose()
    }
  }

  public disconnect(): void {
    this.isManuallyClosed = true
    this.clearTimers()
    if (this.socket) {
      try {
        this.socket.close(1000, 'Client closed connection')
      } catch {
        // Ignorar si ya estaba cerrado
      }
      this.socket = null
    }
    this.setStatus('disconnected')
  }

  public send(data: string | Record<string, unknown>): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      log.warn('WebSocket: Intento de enviar mensaje con socket desconectado')
      return false
    }

    try {
      const payload = typeof data === 'string' ? data : JSON.stringify(data)
      this.socket.send(payload)
      return true
    } catch (err) {
      log.error('WebSocket: Fallo al enviar mensaje', err)
      return false
    }
  }

  public on<T = unknown>(eventName: string, handler: MessageHandler<T>): () => void {
    const key = eventName.toLowerCase()
    if (!this.messageListeners.has(key)) {
      this.messageListeners.set(key, new Set())
    }
    this.messageListeners.get(key)!.add(handler as MessageHandler)

    return () => this.off(eventName, handler)
  }

  public off<T = unknown>(eventName: string, handler: MessageHandler<T>): void {
    const key = eventName.toLowerCase()
    const handlers = this.messageListeners.get(key)
    if (handlers) {
      handlers.delete(handler as MessageHandler)
      if (handlers.size === 0) {
        this.messageListeners.delete(key)
      }
    }
  }

  public onGlobalMessage(handler: MessageHandler): () => void {
    this.globalListeners.add(handler)
    return () => this.globalListeners.delete(handler)
  }

  public onStatusChange(handler: StatusChangeHandler): () => void {
    this.statusListeners.add(handler)
    handler(this.status)
    return () => this.statusListeners.delete(handler)
  }

  public onReconnect(handler: () => void): () => void {
    this.reconnectListeners.add(handler)
    return () => this.reconnectListeners.delete(handler)
  }

  private setupSocketEvents(ws: WebSocket): void {
    ws.onopen = () => {
      if (this.socket !== ws) return
      log.info('WebSocket: Conexión establecida')
      const wasReconnecting = this.status === 'reconnecting' || this.hadConnectedBefore
      this.hadConnectedBefore = true
      this.currentReconnectDelayMs = this.options.initialReconnectDelayMs
      this.setStatus('connected')
      this.startHeartbeat()

      if (wasReconnecting) {
        this.notifyReconnect()
      }
    }

    ws.onmessage = (event: MessageEvent) => {
      if (this.socket !== ws) return
      this.handleIncomingMessage(event.data)
    }

    ws.onerror = (error: Event) => {
      if (this.socket !== ws) return
      log.warn('WebSocket: Evento de error capturado', error)
    }

    ws.onclose = () => {
      if (this.socket !== ws) return
      this.handleSocketClose()
    }
  }

  private handleIncomingMessage(rawData: unknown): void {
    if (typeof rawData !== 'string') return

    try {
      const parsed = JSON.parse(rawData) as WebSocketMessage
      if (!parsed || typeof parsed !== 'object') return

      // Heartbeat pong response
      if (parsed.type === 'pong' || parsed.event === 'pong') {
        return
      }

      // Notificar listeners globales
      for (const listener of this.globalListeners) {
        try {
          listener(parsed)
        } catch (e) {
          log.error('WebSocket: Error en listener global', e)
        }
      }

      // Notificar por nombre de evento / type
      const eventKey = (parsed.event || parsed.type || '').toString().toLowerCase()
      if (eventKey) {
        const handlers = this.messageListeners.get(eventKey)
        if (handlers) {
          for (const handler of handlers) {
            try {
              handler(parsed)
            } catch (e) {
              log.error(`WebSocket: Error en handler de evento [${eventKey}]`, e)
            }
          }
        }
      }
    } catch {
      // Mensaje no JSON (ignorar o loguear en debug)
    }
  }

  private handleSocketClose(): void {
    this.clearHeartbeat()
    this.socket = null

    if (this.isManuallyClosed || !this.options.autoReconnect) {
      this.setStatus('disconnected')
      return
    }

    this.setStatus('reconnecting')
    this.scheduleReconnect()
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)

    // Jitter aleatorio (+/- 20%) para evitar que todos los clientes reconecten exactamente al mismo tiempo
    const jitter = this.currentReconnectDelayMs * (0.8 + Math.random() * 0.4)
    log.info(`WebSocket: Reconectando en ${(jitter / 1000).toFixed(1)}s...`)

    this.reconnectTimer = setTimeout(() => {
      this.currentReconnectDelayMs = Math.min(
        this.currentReconnectDelayMs * this.options.backoffFactor,
        this.options.maxReconnectDelayMs
      )
      this.connect()
    }, jitter)
  }

  private startHeartbeat(): void {
    this.clearHeartbeat()
    if (this.options.heartbeatIntervalMs <= 0) return

    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this.send(this.options.pingPayload)
      }
    }, this.options.heartbeatIntervalMs)
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private clearTimers(): void {
    this.clearHeartbeat()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private setStatus(newStatus: WebSocketStatus): void {
    if (this.status === newStatus) return
    this.status = newStatus
    for (const listener of this.statusListeners) {
      try {
        listener(newStatus)
      } catch (e) {
        log.error('WebSocket: Error en status change listener', e)
      }
    }
  }

  private notifyReconnect(): void {
    for (const listener of this.reconnectListeners) {
      try {
        listener()
      } catch (e) {
        log.error('WebSocket: Error en reconnect listener', e)
      }
    }
  }
}
