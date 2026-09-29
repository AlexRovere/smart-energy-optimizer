import { z } from 'zod'

// Vote « utile / pas utile » sur une recommandation ou une prévision (#47).
// snake_case sur le fil, camelCase en interne par le transform.
export const feedbackInputSchema = z
  .object({
    target_type: z.enum(['recommendation', 'forecast']),
    target_id: z.string().min(1).max(255),
    useful: z.boolean(),
  })
  .transform(input => ({ targetType: input.target_type, targetId: input.target_id, useful: input.useful }))

export interface FeedbackVoteResponse {
  target_type: 'recommendation' | 'forecast'
  target_id: string
  useful: boolean
}
