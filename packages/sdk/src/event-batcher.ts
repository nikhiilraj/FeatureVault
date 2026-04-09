import type { TrackEvent } from './types.js'

type FlushFn = (events: TrackEvent[]) => Promise<void>

export class EventBatcher {
  private queue:         TrackEvent[] = []
  private timer:         ReturnType<typeof setTimeout> | null = null
  private readonly flush: FlushFn
  private readonly interval:  number
  private readonly batchSize: number
  private flushing = false

  constructor(flushFn: FlushFn, interval = 2000, batchSize = 50) {
    this.flush     = flushFn
    this.interval  = interval
    this.batchSize = batchSize
  }

  push(event: TrackEvent): void {
    this.queue.push(event)

    // Flush immediately if batch size reached
    if (this.queue.length >= this.batchSize) {
      this.flushNow()
      return
    }

    // Start timer if not already running
    if (!this.timer) {
      this.timer = setTimeout(() => this.flushNow(), this.interval)
    }
  }

  async flushNow(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }

    if (this.queue.length === 0 || this.flushing) return

    const batch  = this.queue.splice(0, this.batchSize)
    this.flushing = true

    try {
      await this.flush(batch)
    } catch (err) {
      // Re-queue failed events at the front
      this.queue.unshift(...batch)
    } finally {
      this.flushing = false
    }
  }

  async destroy(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    // Flush remaining events on shutdown
    if (this.queue.length > 0) {
      await this.flushNow()
    }
  }

  pendingCount(): number {
    return this.queue.length
  }
}
