import { createError, defineEventHandler, getRouterParam, readValidatedBody } from 'h3'
import { alertThresholdInputSchema, alertThresholdTypeSchema } from '../../../../../shared/alertThresholdSchema'
import { db } from '../../../../database'
import { requireAccount } from '../../../../utils/guard'
import { upsertAlertThreshold } from '../../../../utils/alertThresholdsRepository'

const siteIdSchema = /^SITE\d{3}$/

export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  if (account.role !== 'ADMIN' && account.role !== 'OPERATOR') {
    throw createError({ statusCode: 403, message: 'Accès interdit' })
  }

  const id = getRouterParam(event, 'id')
  if (id === undefined || !siteIdSchema.test(id)) {
    throw createError({ statusCode: 422, message: 'Identifiant de site invalide' })
  }

  const parsedType = alertThresholdTypeSchema.safeParse(getRouterParam(event, 'type'))
  if (!parsedType.success) {
    throw createError({ statusCode: 422, message: 'Type de règle invalide' })
  }

  const entree = await readValidatedBody(event, alertThresholdInputSchema.safeParse)
  if (!entree.success) {
    throw createError({ statusCode: 422, message: 'Entrée invalide' })
  }

  await upsertAlertThreshold(db, id, parsedType.data, entree.data)

  return { site_id: id, type: parsedType.data, duration: entree.data.duration, threshold: entree.data.threshold }
})
