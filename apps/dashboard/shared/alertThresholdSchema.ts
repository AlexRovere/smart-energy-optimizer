import { z } from 'zod'

export const alertThresholdTypeSchema = z.enum(['conso', 'pic'])

export const alertThresholdInputSchema = z.object({
  duration: z.number().int().positive(),
  threshold: z.number().positive()
})

export const alertThresholdEntrySchema = z.object({
  site_id: z.string(),
  type: alertThresholdTypeSchema,
  duration: z.number(),
  threshold: z.number()
})

export type AlertThresholdType = z.infer<typeof alertThresholdTypeSchema>
export type AlertThresholdInput = z.infer<typeof alertThresholdInputSchema>
export type AlertThresholdEntry = z.infer<typeof alertThresholdEntrySchema>
