import { z } from 'zod'

export const conditionOperatorSchema = z.enum([
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
  'contains', 'not_contains', 'starts_with', 'ends_with',
  'in', 'not_in', 'regex',
])

export const targetingConditionSchema = z.object({
  attribute: z.string().min(1).max(128),
  operator:  conditionOperatorSchema,
  value:     z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
})

export const targetingRuleSchema = z.object({
  name:              z.string().max(255).optional(),
  conditions:        z.array(targetingConditionSchema).max(20),
  serveValue:        z.unknown(),
  rolloutPercentage: z.number().int().min(0).max(100).default(100),
})

export const createFlagSchema = z.object({
  key:              z.string()
                     .min(1).max(128)
                     .regex(/^[a-z0-9][a-z0-9-_]*$/, 'Key must be lowercase alphanumeric with hyphens/underscores'),
  name:             z.string().min(1).max(255),
  description:      z.string().max(1000).optional(),
  type:             z.enum(['boolean', 'string', 'number', 'json']).default('boolean'),
  defaultValue:     z.unknown(),
  tags:             z.array(z.string().max(64)).max(20).default([]),
})

export const updateFlagSchema = z.object({
  name:             z.string().min(1).max(255).optional(),
  description:      z.string().max(1000).optional(),
  defaultValue:     z.unknown().optional(),
  tags:             z.array(z.string().max(64)).max(20).optional(),
  targetingEnabled: z.boolean().optional(),
  changeReason:     z.string().max(500).optional(),
})

export const updateFlagStatusSchema = z.object({
  status: z.enum(['inactive', 'active', 'killed']),
})

export const upsertTargetingRulesSchema = z.object({
  rules: z.array(targetingRuleSchema).max(10),
})

export const listFlagsQuerySchema = z.object({
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['inactive', 'active', 'killed']).optional(),
  search: z.string().max(128).optional(),
})

export type CreateFlagInput          = z.infer<typeof createFlagSchema>
export type UpdateFlagInput          = z.infer<typeof updateFlagSchema>
export type UpdateFlagStatusInput    = z.infer<typeof updateFlagStatusSchema>
export type UpsertTargetingRulesInput = z.infer<typeof upsertTargetingRulesSchema>
export type ListFlagsQuery           = z.infer<typeof listFlagsQuerySchema>
