// Votes « utile / pas utile » d'un compte (#47). Un vote par compte et par
// cible : voter de nouveau remplace le vote précédent.
import { and, eq, sql } from 'drizzle-orm'
import { feedback } from '../database/schema'
import type { AppDatabase } from './session'

export type FeedbackTarget = 'recommendation' | 'forecast'

export interface FeedbackVote {
  targetType: FeedbackTarget
  targetId: string
  useful: boolean
}

export interface FeedbackInput extends FeedbackVote {
  userId: string
  siteId: string
}

export async function upsertFeedback(db: AppDatabase, input: FeedbackInput): Promise<void> {
  await db
    .insert(feedback)
    .values(input)
    .onConflictDoUpdate({
      target: [feedback.userId, feedback.targetType, feedback.targetId],
      set: { useful: input.useful, siteId: input.siteId, updatedAt: sql`now()` },
    })
}

export async function listFeedback(db: AppDatabase, userId: string, siteId: string): Promise<FeedbackVote[]> {
  const rows = await db
    .select({ targetType: feedback.targetType, targetId: feedback.targetId, useful: feedback.useful })
    .from(feedback)
    .where(and(eq(feedback.userId, userId), eq(feedback.siteId, siteId)))
    .orderBy(feedback.updatedAt)
  return rows as FeedbackVote[]
}
