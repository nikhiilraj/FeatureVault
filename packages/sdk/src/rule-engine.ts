import type { FlagConfig, TargetingRule, TargetingCondition, UserContext } from './types.js'
import { isInRollout } from './bucketing.js'

/**
 * Evaluate a single condition against user context.
 */
function evaluateCondition(condition: TargetingCondition, context: UserContext): boolean {
  const { attribute, operator, value } = condition
  const ctxValue = context[attribute]

  if (ctxValue === undefined || ctxValue === null) return false

  const strCtx  = String(ctxValue)
  const numCtx  = Number(ctxValue)
  const strVal  = String(value)
  const numVal  = Number(value)

  switch (operator) {
    case 'eq':           return strCtx === strVal
    case 'neq':          return strCtx !== strVal
    case 'gt':           return !isNaN(numCtx) && !isNaN(numVal) && numCtx > numVal
    case 'gte':          return !isNaN(numCtx) && !isNaN(numVal) && numCtx >= numVal
    case 'lt':           return !isNaN(numCtx) && !isNaN(numVal) && numCtx < numVal
    case 'lte':          return !isNaN(numCtx) && !isNaN(numVal) && numCtx <= numVal
    case 'contains':     return strCtx.includes(strVal)
    case 'not_contains': return !strCtx.includes(strVal)
    case 'starts_with':  return strCtx.startsWith(strVal)
    case 'ends_with':    return strCtx.endsWith(strVal)
    case 'in':           return Array.isArray(value) ? value.map(String).includes(strCtx) : strVal.split(',').map(s => s.trim()).includes(strCtx)
    case 'not_in':       return Array.isArray(value) ? !value.map(String).includes(strCtx) : !strVal.split(',').map(s => s.trim()).includes(strCtx)
    case 'regex': {
      try { return new RegExp(strVal).test(strCtx) }
      catch { return false }
    }
    default: return false
  }
}

/**
 * Evaluate a single targeting rule.
 * All conditions must match (AND logic).
 * If conditions match, the rollout percentage is checked.
 */
function evaluateRule(
  rule:    TargetingRule,
  context: UserContext,
  flagKey: string,
): boolean {
  const userId = String(context['userId'] ?? context['id'] ?? '')

  // All conditions must pass (AND logic within a rule)
  const conditionsMatch = rule.conditions.every(c => evaluateCondition(c, context))
  if (!conditionsMatch) return false

  // Check rollout percentage using MurmurHash3 bucketing
  return isInRollout(userId, flagKey, rule.rolloutPercentage)
}

/**
 * Evaluate a flag for a given user context.
 * Returns the serve value from the first matching rule,
 * or the flag's default value if no rules match.
 *
 * Rules are evaluated top-down (by ruleOrder).
 * This function runs entirely in memory — zero network calls.
 */
export function evaluateFlag(flag: FlagConfig, context: UserContext): unknown {
  // Killed flags always return false regardless of type
  if (flag.status === 'killed') return false

  // Inactive flags return the default value
  if (flag.status === 'inactive') return flag.defaultValue

  // Targeting disabled — return default for all users
  if (!flag.targetingEnabled || flag.targetingRules.length === 0) {
    return flag.defaultValue
  }

  // Evaluate rules top-down, return first match
  const sortedRules = [...flag.targetingRules].sort((a, b) => a.ruleOrder - b.ruleOrder)

  for (const rule of sortedRules) {
    if (evaluateRule(rule, context, flag.key)) {
      return rule.serveValue
    }
  }

  // No rules matched — return default
  return flag.defaultValue
}
