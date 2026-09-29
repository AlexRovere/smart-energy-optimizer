import { defineEventHandler, getRouterParam } from 'h3'
import type { FeedbackVoteResponse } from '../../../../shared/feedbackSchema'
import { db } from '../../../database'
import { listFeedback } from '../../../utils/feedbackRepository'
import { requireSiteAccess } from '../../../utils/guard'

// Les votes du seul compte connecté : l'écran montre à chacun son propre avis.
export default defineEventHandler(async (event): Promise<FeedbackVoteResponse[]> => {
  const { account, siteId } = await requireSiteAccess(event, getRouterParam(event, 'id'))
  const votes = await listFeedback(db, account.id, siteId)
  return votes.map(vote => ({ target_type: vote.targetType, target_id: vote.targetId, useful: vote.useful }))
})
