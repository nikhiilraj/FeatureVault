import type {
  FeatureVaultConfig, FlagConfig, UserContext,
  TrackEvent, WSMessage,
} from './types.js'
import { FlagStore }       from './flag-store.js'
import { evaluateFlag }    from './rule-engine.js'
import { assignVariant }   from './bucketing.js'
import { EventBatcher }    from './event-batcher.js'
import { WebSocketClient } from './websocket-client.js'

export type { FeatureVaultConfig, FlagConfig, UserContext, TrackEvent }

export class FeatureVault {
  private readonly config:    Required<FeatureVaultConfig>
  private readonly store:     FlagStore
  private batcher:            EventBatcher | null = null
  private wsClient:           WebSocketClient | null = null
  private connected = false

  constructor(config: FeatureVaultConfig) {
    this.config = {
      apiUrl:         config.apiUrl        ?? 'http://localhost:4000',
      wsUrl:          config.wsUrl         ?? '',
      connectTimeout: config.connectTimeout ?? 10_000,
      flushInterval:  config.flushInterval  ?? 2_000,
      flushBatchSize: config.flushBatchSize ?? 50,
      debug:          config.debug          ?? false,
      ...config,
    }

    // Derive WebSocket URL from apiUrl if not explicitly provided
    if (!this.config.wsUrl) {
      const base = this.config.apiUrl.replace(/^http/, 'ws')
      this.config.wsUrl = `${base}/sdk/v1/ws`
    }

    this.store = new FlagStore()
  }

  // ─── Connect ────────────────────────────────────────────────
  async connect(): Promise<void> {
    if (this.connected) return

    // 1. Fetch all flags via REST
    await this.fetchFlags()

    // 2. Start WebSocket for real-time updates
    await this.connectWebSocket()

    // 3. Start event batcher
    this.batcher = new EventBatcher(
      (events) => this.flushEvents(events),
      this.config.flushInterval,
      this.config.flushBatchSize,
    )

    this.connected = true
    this.log(`Connected. ${this.store.size()} flags loaded.`)
  }

  // ─── Flag evaluation (all local, zero network) ───────────────
  isEnabled(key: string, context: UserContext = {}): boolean {
    const flag = this.store.get(key)
    if (!flag) return false
    return Boolean(evaluateFlag(flag, context))
  }

  getStringFlag(key: string, context: UserContext = {}, defaultValue = ''): string {
    const flag = this.store.get(key)
    if (!flag) return defaultValue
    const value = evaluateFlag(flag, context)
    return typeof value === 'string' ? value : defaultValue
  }

  getNumberFlag(key: string, context: UserContext = {}, defaultValue = 0): number {
    const flag = this.store.get(key)
    if (!flag) return defaultValue
    const value = evaluateFlag(flag, context)
    return typeof value === 'number' ? value : defaultValue
  }

  getJSONFlag<T = unknown>(key: string, context: UserContext = {}, defaultValue: T): T {
    const flag = this.store.get(key)
    if (!flag) return defaultValue
    const value = evaluateFlag(flag, context)
    return (value !== null && typeof value === 'object') ? value as T : defaultValue
  }

  // ─── Experiment variant assignment ───────────────────────────
  getVariant(experimentKey: string, context: UserContext = {}): string | null {
    const flag = this.store.get(experimentKey)
    if (!flag || flag.type !== 'json') return null

    const config = flag.defaultValue as { variants?: Array<{ key: string; weight: number }> }
    if (!config?.variants) return null

    const userId = String(context['userId'] ?? context['id'] ?? '')
    if (!userId) return null

    return assignVariant(userId, experimentKey, config.variants)
  }

  // ─── Event tracking ──────────────────────────────────────────
  track(eventName: string, properties: { userId: string; experimentKey?: string } & Record<string, unknown>): void {
    if (!this.batcher) {
      this.log('track() called before connect() — event dropped')
      return
    }

    const { userId, experimentKey, ...rest } = properties
    const event: TrackEvent = {
      eventName,
      userId,
      experimentKey,
      properties: rest,
      timestamp: new Date().toISOString(),
    }

    this.batcher.push(event)
  }

  // ─── Graceful shutdown ───────────────────────────────────────
  async close(): Promise<void> {
    this.log('Closing...')
    await this.batcher?.destroy()
    this.wsClient?.destroy()
    this.store.clear()
    this.connected = false
    this.log('Closed.')
  }

  // ─── Introspection ───────────────────────────────────────────
  getAllFlags(): FlagConfig[] {
    return this.store.getAll()
  }

  getFlagCount(): number {
    return this.store.size()
  }

  isConnected(): boolean {
    return this.connected && (this.wsClient?.isConnected() ?? false)
  }

  // ─── Private: fetch flags via REST ───────────────────────────
  private async fetchFlags(): Promise<void> {
    const url = `${this.config.apiUrl}/sdk/v1/flags`
    this.log(`Fetching flags from ${url}`)

    const res = await fetch(url, {
      headers: { 'X-API-Key': this.config.apiKey },
      signal:  AbortSignal.timeout(this.config.connectTimeout),
    })

    if (!res.ok) {
      throw new Error(`Failed to fetch flags: ${res.status} ${res.statusText}`)
    }

    const body = await res.json() as { flags: FlagConfig[] }
    this.store.setAll(body.flags)
    this.log(`Loaded ${body.flags.length} flags`)
  }

  // ─── Private: connect WebSocket ──────────────────────────────
  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'))
      }, this.config.connectTimeout)

      this.wsClient = new WebSocketClient({
        url:    this.config.wsUrl,
        apiKey: this.config.apiKey,
        debug:  this.config.debug,

        onConnect: () => {
          clearTimeout(timeout)
          resolve()
        },

        onMessage: (msg: WSMessage) => {
          this.handleWSMessage(msg)
        },
      })

      this.wsClient.connect()
    })
  }

  // ─── Private: handle WebSocket messages ──────────────────────
  private handleWSMessage(msg: WSMessage): void {
    this.log(`WS message: ${msg.type} ${msg.flagKey ?? ''}`)

    switch (msg.type) {
      case 'flag_updated':
      case 'flag_created':
        // Re-fetch full config to get updated flag with rules
        this.fetchFlags().catch(err => this.log(`Re-fetch failed: ${err.message}`))
        break

      case 'flag_deleted':
        if (msg.flagKey) this.store.delete(msg.flagKey)
        break
    }
  }

  // ─── Private: flush events to API ────────────────────────────
  private async flushEvents(events: TrackEvent[]): Promise<void> {
    const url = `${this.config.apiUrl}/sdk/v1/events`
    const res = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key':    this.config.apiKey,
      },
      body: JSON.stringify({ events }),
    })

    if (!res.ok) {
      throw new Error(`Event flush failed: ${res.status}`)
    }

    this.log(`Flushed ${events.length} events`)
  }

  private log(msg: string): void {
    if (this.config.debug) console.log(`[FeatureVault] ${msg}`)
  }
}
