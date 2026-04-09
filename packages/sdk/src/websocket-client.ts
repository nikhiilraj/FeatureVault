import WebSocket from 'ws'
import type { WSMessage } from './types.js'

type MessageHandler = (msg: WSMessage) => void
type ConnectHandler = () => void

const BACKOFF_STEPS = [1000, 2000, 4000, 8000, 16000, 30000]
const PING_INTERVAL = 30_000   // 30 seconds
const PONG_TIMEOUT  = 60_000   // 60 seconds — if no pong, reconnect

export class WebSocketClient {
  private ws:            WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer:      ReturnType<typeof setInterval> | null = null
  private pongTimer:      ReturnType<typeof setTimeout> | null = null
  private attempt         = 0
  private destroyed       = false

  private readonly url:           string
  private readonly apiKey:        string
  private readonly onMessage:     MessageHandler
  private readonly onConnect:     ConnectHandler
  private readonly debug:         boolean

  constructor(opts: {
    url:       string
    apiKey:    string
    onMessage: MessageHandler
    onConnect: ConnectHandler
    debug?:    boolean
  }) {
    this.url       = opts.url
    this.apiKey    = opts.apiKey
    this.onMessage = opts.onMessage
    this.onConnect = opts.onConnect
    this.debug     = opts.debug ?? false
  }

  connect(): void {
    if (this.destroyed) return

    this.log(`Connecting to ${this.url}...`)

    this.ws = new WebSocket(this.url, {
      headers: { 'x-api-key': this.apiKey },
    })

    this.ws.on('open', () => {
      this.log('Connected')
      this.attempt = 0
      this.startHeartbeat()
      this.onConnect()
    })

    this.ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString()) as WSMessage
        if (msg.type === 'pong') {
          this.resetPongTimer()
          return
        }
        this.onMessage(msg)
      } catch {
        this.log('Failed to parse WS message')
      }
    })

    this.ws.on('close', () => {
      this.log('Disconnected')
      this.stopHeartbeat()
      if (!this.destroyed) this.scheduleReconnect()
    })

    this.ws.on('error', (err) => {
      this.log(`Error: ${err.message}`)
      // close event will follow — reconnect handled there
    })
  }

  send(message: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }

  destroy(): void {
    this.destroyed = true
    this.stopHeartbeat()
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  private startHeartbeat(): void {
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }))
        // Start pong timeout
        this.pongTimer = setTimeout(() => {
          this.log('Pong timeout — reconnecting')
          this.ws?.terminate()
        }, PONG_TIMEOUT)
      }
    }, PING_INTERVAL)
  }

  private stopHeartbeat(): void {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null }
    if (this.pongTimer) { clearTimeout(this.pongTimer);  this.pongTimer = null }
  }

  private resetPongTimer(): void {
    if (this.pongTimer) { clearTimeout(this.pongTimer); this.pongTimer = null }
  }

  private scheduleReconnect(): void {
    const delay = BACKOFF_STEPS[Math.min(this.attempt, BACKOFF_STEPS.length - 1)]
    this.attempt++
    this.log(`Reconnecting in ${delay}ms (attempt ${this.attempt})`)
    this.reconnectTimer = setTimeout(() => this.connect(), delay)
  }

  private log(msg: string): void {
    if (this.debug) console.log(`[FeatureVault WS] ${msg}`)
  }
}
