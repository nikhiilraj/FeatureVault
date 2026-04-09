import { describe, it, expect } from 'vitest'
import { evaluateFlag } from '../rule-engine.js'
import type { FlagConfig } from '../types.js'

const booleanFlag = (overrides: Partial<FlagConfig> = {}): FlagConfig => ({
  id: 'flag-1', key: 'test-flag', type: 'boolean',
  status: 'active', defaultValue: false,
  targetingEnabled: false, targetingRules: [],
  version: 1, updatedAt: new Date().toISOString(),
  ...overrides,
})

describe('evaluateFlag', () => {

  describe('status handling', () => {
    it('killed flag always returns false', () => {
      const flag = booleanFlag({ status: 'killed', defaultValue: true })
      expect(evaluateFlag(flag, { userId: 'usr_123' })).toBe(false)
    })

    it('inactive flag returns defaultValue', () => {
      const flag = booleanFlag({ status: 'inactive', defaultValue: true })
      expect(evaluateFlag(flag, { userId: 'usr_123' })).toBe(true)
    })

    it('active flag with targeting disabled returns defaultValue', () => {
      const flag = booleanFlag({ status: 'active', defaultValue: false, targetingEnabled: false })
      expect(evaluateFlag(flag, { userId: 'usr_123' })).toBe(false)
    })
  })

  describe('targeting rule evaluation', () => {
    it('matches eq condition', () => {
      const flag = booleanFlag({
        status: 'active', targetingEnabled: true,
        targetingRules: [{
          id: 'r1', ruleOrder: 0,
          conditions: [{ attribute: 'plan', operator: 'eq', value: 'pro' }],
          serveValue: true, rolloutPercentage: 100,
        }],
      })
      expect(evaluateFlag(flag, { userId: 'usr_1', plan: 'pro' })).toBe(true)
      expect(evaluateFlag(flag, { userId: 'usr_1', plan: 'free' })).toBe(false)
    })

    it('matches in condition', () => {
      const flag = booleanFlag({
        status: 'active', targetingEnabled: true,
        targetingRules: [{
          id: 'r1', ruleOrder: 0,
          conditions: [{ attribute: 'plan', operator: 'in', value: ['pro', 'enterprise'] }],
          serveValue: true, rolloutPercentage: 100,
        }],
      })
      expect(evaluateFlag(flag, { userId: 'usr_1', plan: 'pro' })).toBe(true)
      expect(evaluateFlag(flag, { userId: 'usr_1', plan: 'enterprise' })).toBe(true)
      expect(evaluateFlag(flag, { userId: 'usr_1', plan: 'free' })).toBe(false)
    })

    it('matches contains condition', () => {
      const flag = booleanFlag({
        status: 'active', targetingEnabled: true,
        targetingRules: [{
          id: 'r1', ruleOrder: 0,
          conditions: [{ attribute: 'email', operator: 'ends_with', value: '@acme.com' }],
          serveValue: true, rolloutPercentage: 100,
        }],
      })
      expect(evaluateFlag(flag, { userId: 'u1', email: 'nikhil@acme.com' })).toBe(true)
      expect(evaluateFlag(flag, { userId: 'u1', email: 'nikhil@gmail.com' })).toBe(false)
    })

    it('evaluates rules in ruleOrder (top-down, first match wins)', () => {
      const flag = booleanFlag({
        status: 'active', targetingEnabled: true,
        targetingRules: [
          {
            id: 'r1', ruleOrder: 0,
            conditions: [{ attribute: 'plan', operator: 'eq', value: 'enterprise' }],
            serveValue: 'enterprise-value', rolloutPercentage: 100,
          },
          {
            id: 'r2', ruleOrder: 1,
            conditions: [{ attribute: 'plan', operator: 'eq', value: 'pro' }],
            serveValue: 'pro-value', rolloutPercentage: 100,
          },
        ],
      })
      expect(evaluateFlag(flag, { userId: 'u1', plan: 'enterprise' })).toBe('enterprise-value')
      expect(evaluateFlag(flag, { userId: 'u1', plan: 'pro' })).toBe('pro-value')
      expect(evaluateFlag(flag, { userId: 'u1', plan: 'free' })).toBe(false) // default
    })

    it('returns defaultValue when no rules match', () => {
      const flag = booleanFlag({
        status: 'active', defaultValue: 'fallback',
        targetingEnabled: true,
        targetingRules: [{
          id: 'r1', ruleOrder: 0,
          conditions: [{ attribute: 'plan', operator: 'eq', value: 'pro' }],
          serveValue: true, rolloutPercentage: 100,
        }],
      })
      expect(evaluateFlag(flag, { userId: 'u1', plan: 'free' })).toBe('fallback')
    })

    it('missing attribute returns default', () => {
      const flag = booleanFlag({
        status: 'active', targetingEnabled: true,
        targetingRules: [{
          id: 'r1', ruleOrder: 0,
          conditions: [{ attribute: 'country', operator: 'eq', value: 'IN' }],
          serveValue: true, rolloutPercentage: 100,
        }],
      })
      // No country in context
      expect(evaluateFlag(flag, { userId: 'u1' })).toBe(false)
    })
  })

  describe('percentage rollout', () => {
    it('100% rollout always serves value', () => {
      const flag = booleanFlag({
        status: 'active', targetingEnabled: true,
        targetingRules: [{
          id: 'r1', ruleOrder: 0,
          conditions: [],
          serveValue: true, rolloutPercentage: 100,
        }],
      })
      for (let i = 0; i < 50; i++) {
        expect(evaluateFlag(flag, { userId: `user-${i}` })).toBe(true)
      }
    })

    it('0% rollout never serves value', () => {
      const flag = booleanFlag({
        status: 'active', defaultValue: false,
        targetingEnabled: true,
        targetingRules: [{
          id: 'r1', ruleOrder: 0,
          conditions: [],
          serveValue: true, rolloutPercentage: 0,
        }],
      })
      for (let i = 0; i < 50; i++) {
        expect(evaluateFlag(flag, { userId: `user-${i}` })).toBe(false)
      }
    })
  })
})
