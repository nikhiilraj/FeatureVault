import type { FlagConfig } from './types.js'

export class FlagStore {
  private flags = new Map<string, FlagConfig>()

  /**
   * Replace the entire store with a fresh set of flags.
   * Called on initial fetch and on reconnect.
   */
  setAll(flags: FlagConfig[]): void {
    this.flags.clear()
    for (const flag of flags) {
      this.flags.set(flag.key, flag)
    }
  }

  /**
   * Update or insert a single flag.
   * Called when a WebSocket flag_updated message is received.
   */
  upsert(flag: FlagConfig): void {
    this.flags.set(flag.key, flag)
  }

  /**
   * Remove a flag from the store.
   * Called when a WebSocket flag_deleted message is received.
   */
  delete(key: string): void {
    this.flags.delete(key)
  }

  get(key: string): FlagConfig | undefined {
    return this.flags.get(key)
  }

  getAll(): FlagConfig[] {
    return Array.from(this.flags.values())
  }

  size(): number {
    return this.flags.size
  }

  clear(): void {
    this.flags.clear()
  }
}
