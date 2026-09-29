import { createError, defineEventHandler, getRouterParam, readValidatedBody } from 'h3'
import { feedbackInputSchema, type FeedbackVoteResponse } from '../../../../shared/feedbackSchema'
import { db } from '../../../database'
import { upsertFeedback } from '../../../utils/feedbackRepository'
import { requireSiteAccess } from '../../../utils/guard'

// Tout compte qui voit le site peut dire si ce qu'on lui montre lui sert : le
// vote n'écrit que son propre avis, jamais une donnée du site.
export default defineEventHandler(async (event): Promise<FeedbackVoteResponse> => {
  const { account, siteId } = await requireSiteAccess(event, getRouterParam(event, 'id'))

  const input = await readValidatedBody(event, feedbackInputSchema.safeParse)
  if (!input.success) {
    throw createError({ statusCode: 422, message: 'Vote invalide' })
  }

  await upsertFeedback(db, { userId: account.id, siteId, ...input.data })
  return { target_type: input.data.targetType, target_id: input.data.targetId, useful: input.data.useful }
})
