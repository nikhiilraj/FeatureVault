import { z } from 'zod'

export const createExperimentSchema = z.object({
  key:               z.string().min(1).max(128)
                      .regex(/^[a-z0-9][a-z0-9-_]*$/, 'Key must be lowercase alphanumeric with hyphens/underscores'),
  name:              z.string().min(1).max(255),
  hypothesis:        z.string().max(2000).optional(),
  primaryMetric:     z.string().min(1).max(128),
  secondaryMetrics:  z.array(z.string().max(128)).max(5).default([]),
  trafficAllocation: z.number().int().min(1).max(100).default(100),
  confidenceLevel:   z.number().min(0.8).max(0.99).default(0.95),
  variants: z.array(z.object({
    key:    z.string().min(1).max(128),
    name:   z.string().min(1).max(255),
    weight: z.number().int().min(1).max(100),
    value:  z.unknown(),
  })).min(2).max(5),
}).refine(
  data => data.variants.reduce((s, v) => s + v.weight, 0) === 100,
  { message: 'Variant weights must sum to 100', path: ['variants'] }
)

export const updateExperimentSchema = z.object({
  name:             z.string().min(1).max(255).optional(),
  hypothesis:       z.string().max(2000).optional(),
  primaryMetric:    z.string().min(1).max(128).optional(),
  confidenceLevel:  z.number().min(0.8).max(0.99).optional(),
})

export const listExperimentsQuerySchema = z.object({
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['draft','running','paused','stopped','archived']).optional(),
})

export type CreateExperimentInput  = z.infer<typeof createExperimentSchema>
export type UpdateExperimentInput  = z.infer<typeof updateExperimentSchema>
export type ListExperimentsQuery   = z.infer<typeof listExperimentsQuerySchema>
