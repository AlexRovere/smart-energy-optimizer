import { createError, defineEventHandler, getRouterParam, readValidatedBody } from 'h3'
import { alertThresholdInputSchema, alertThresholdTypeSchema } from '../../../../../shared/alertThresholdSchema'
import { db } from '../../../../database'
import { requireSiteAccess } from '../../../../utils/guard'
import { upsertAlertThreshold } from '../../../../utils/alertThresholdsRepository'

export default defineEventHandler(async (event) => {
  // Le rôle ne suffit pas : un opérateur ne règle que les sites de son périmètre.
  const { account, siteId: id } = await requireSiteAccess(event, getRouterParam(event, 'id'))
  if (account.role !== 'ADMIN' && account.role !== 'OPERATOR') {
    throw createError({ statusCode: 403, message: 'Accès interdit' })
  }

  const parsedType = alertThresholdTypeSchema.safeParse(getRouterParam(event, 'type'))
  if (!parsedType.success) {
    throw createError({ statusCode: 422, message: 'Type de règle invalide' })
  }

  const input = await readValidatedBody(event, alertThresholdInputSchema.safeParse)
  if (!input.success) {
    throw createError({ statusCode: 422, message: 'Entrée invalide' })
  }

  await upsertAlertThreshold(db, id, parsedType.data, input.data)

  return { site_id: id, type: parsedType.data, duration: input.data.duration, threshold: input.data.threshold }
})
