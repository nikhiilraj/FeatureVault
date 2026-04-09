import { describe, it, expect, beforeEach } from 'vitest'
import { FlagStore } from '../flag-store.js'
import type { FlagConfig } from '../types.js'

const makeFlag = (key: string, status: FlagConfig['status'] = 'active'): FlagConfig => ({
  id: `id-${key}`, key, type: 'boolean', status,
  defaultValue: false, targetingEnabled: false,
  targetingRules: [], version: 1, updatedAt: new Date().toISOString(),
})

describe('FlagStore', () => {
  let store: FlagStore

  beforeEach(() => { store = new FlagStore() })

  it('setAll replaces entire store', () => {
    store.setAll([makeFlag('a'), makeFlag('b')])
    expect(store.size()).toBe(2)
    store.setAll([makeFlag('c')])
    expect(store.size()).toBe(1)
    expect(store.get('a')).toBeUndefined()
    expect(store.get('c')).toBeDefined()
  })

  it('upsert adds new flag', () => {
    store.upsert(makeFlag('dark-mode'))
    expect(store.get('dark-mode')).toBeDefined()
  })

  it('upsert updates existing flag', () => {
    store.upsert(makeFlag('dark-mode', 'inactive'))
    store.upsert(makeFlag('dark-mode', 'active'))
    expect(store.get('dark-mode')?.status).toBe('active')
  })

  it('delete removes flag', () => {
    store.setAll([makeFlag('a'), makeFlag('b')])
    store.delete('a')
    expect(store.size()).toBe(1)
    expect(store.get('a')).toBeUndefined()
  })

  it('getAll returns all flags', () => {
    store.setAll([makeFlag('a'), makeFlag('b'), makeFlag('c')])
    expect(store.getAll()).toHaveLength(3)
  })
})
