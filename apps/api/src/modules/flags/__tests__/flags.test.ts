import { describe, it, expect } from 'vitest'
import { createFlagSchema, updateFlagStatusSchema, targetingRuleSchema } from '../flags.schemas.js'

describe('Flag schemas', () => {

  describe('createFlagSchema', () => {
    it('accepts valid boolean flag', () => {
      const result = createFlagSchema.safeParse({
        key: 'dark-mode', name: 'Dark Mode',
        type: 'boolean', defaultValue: false,
      })
      expect(result.success).toBe(true)
    })

    it('rejects uppercase key', () => {
      const result = createFlagSchema.safeParse({
        key: 'Dark-Mode', name: 'Dark Mode',
        type: 'boolean', defaultValue: false,
      })
      expect(result.success).toBe(false)
    })

    it('rejects key starting with hyphen', () => {
      const result = createFlagSchema.safeParse({
        key: '-dark-mode', name: 'Dark Mode',
        type: 'boolean', defaultValue: false,
      })
      expect(result.success).toBe(false)
    })

    it('accepts key with underscore', () => {
      const result = createFlagSchema.safeParse({
        key: 'dark_mode', name: 'Dark Mode',
        type: 'boolean', defaultValue: false,
      })
      expect(result.success).toBe(true)
    })

    it('accepts json type flag', () => {
      const result = createFlagSchema.safeParse({
        key: 'ui-config', name: 'UI Config',
        type: 'json', defaultValue: { theme: 'light' },
      })
      expect(result.success).toBe(true)
    })
  })

  describe('updateFlagStatusSchema', () => {
    it('accepts active', () => expect(updateFlagStatusSchema.safeParse({ status: 'active' }).success).toBe(true))
    it('accepts killed', () => expect(updateFlagStatusSchema.safeParse({ status: 'killed' }).success).toBe(true))
    it('accepts inactive', () => expect(updateFlagStatusSchema.safeParse({ status: 'inactive' }).success).toBe(true))
    it('rejects unknown status', () => expect(updateFlagStatusSchema.safeParse({ status: 'enabled' }).success).toBe(false))
  })

  describe('targetingRuleSchema', () => {
    it('accepts valid rule', () => {
      const result = targetingRuleSchema.safeParse({
        conditions: [{ attribute: 'plan', operator: 'eq', value: 'pro' }],
        serveValue: true,
        rolloutPercentage: 100,
      })
      expect(result.success).toBe(true)
    })

    it('rejects rollout over 100', () => {
      const result = targetingRuleSchema.safeParse({
        conditions: [],
        serveValue: true,
        rolloutPercentage: 101,
      })
      expect(result.success).toBe(false)
    })

    it('rejects unknown operator', () => {
      const result = targetingRuleSchema.safeParse({
        conditions: [{ attribute: 'plan', operator: 'like', value: 'pro' }],
        serveValue: true,
        rolloutPercentage: 100,
      })
      expect(result.success).toBe(false)
    })
  })
})
