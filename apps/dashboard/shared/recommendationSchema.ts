import { z } from 'zod'

export const recommendationSourceSchema = z.enum(['threshold', 'forecast'])
export const recommendationTypeSchema = z.enum(['scheduling', 'load_balancing', 'maintenance', 'efficiency'])
export const recommendationPrioritySchema = z.enum(['low', 'medium', 'high'])

export const recommendationSchema = z.object({
  recommendation_id: z.string(),
  site_id: z.string(),
  source: recommendationSourceSchema,
  type: recommendationTypeSchema,
  priority: recommendationPrioritySchema,
  title: z.string(),
  description: z.string(),
  trigger: z.object({
    timestamp: z.string(),
    value_kw: z.number(),
    threshold_kw: z.number()
  }),
  estimated_saving_kwh: z.number(),
  gain_kw: z.number(),
  confidence: z.number(),
  window: z.string()
})

export type RecommendationSource = z.infer<typeof recommendationSourceSchema>
export type RecommendationType = z.infer<typeof recommendationTypeSchema>
export type RecommendationPriority = z.infer<typeof recommendationPrioritySchema>
export type Recommendation = z.infer<typeof recommendationSchema>

// Réponse de GET /api/sites/{id}/recommendations : `unavailable` dit quelle
// source n'a pas pu être consultée, pour qu'une liste vide ne passe pas pour
// « aucune anomalie ».
export interface SiteRecommendationsResponse {
  recommendations: Recommendation[]
  unavailable: ('history' | 'forecast')[]
}
