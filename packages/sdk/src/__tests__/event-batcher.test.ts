import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventBatcher } from '../event-batcher.js'
import type { TrackEvent } from '../types.js'

const makeEvent = (name: string): TrackEvent => ({
  eventName: name, userId: 'usr_1',
  timestamp: new Date().toISOString(),
})

describe('EventBatcher', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('flushes when batch size is reached', async () => {
    const flushFn = vi.fn().mockResolvedValue(undefined)
    const batcher = new EventBatcher(flushFn, 5000, 3)

    batcher.push(makeEvent('a'))
    batcher.push(makeEvent('b'))
    expect(flushFn).not.toHaveBeenCalled()

    batcher.push(makeEvent('c'))  // triggers flush at size 3
    await vi.runAllTimersAsync()
    expect(flushFn).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ eventName: 'a' }),
        expect.objectContaining({ eventName: 'b' }),
        expect.objectContaining({ eventName: 'c' }),
      ])
    )
  })

  it('flushes after interval', async () => {
    const flushFn = vi.fn().mockResolvedValue(undefined)
    const batcher = new EventBatcher(flushFn, 1000, 50)

    batcher.push(makeEvent('a'))
    expect(flushFn).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1001)
    expect(flushFn).toHaveBeenCalledOnce()
  })

  it('destroy flushes remaining events', async () => {
    const flushFn = vi.fn().mockResolvedValue(undefined)
    const batcher = new EventBatcher(flushFn, 5000, 50)

    batcher.push(makeEvent('a'))
    batcher.push(makeEvent('b'))
    expect(flushFn).not.toHaveBeenCalled()

    await batcher.destroy()
    expect(flushFn).toHaveBeenCalledOnce()
    expect(batcher.pendingCount()).toBe(0)
  })

  it('re-queues events on flush failure', async () => {
    const flushFn = vi.fn().mockRejectedValueOnce(new Error('Network error'))
    const batcher = new EventBatcher(flushFn, 5000, 2)

    batcher.push(makeEvent('a'))
    batcher.push(makeEvent('b'))
    await vi.runAllTimersAsync()

    // Events should be re-queued
    expect(batcher.pendingCount()).toBe(2)
  })
})
