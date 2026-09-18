import { createError, defineEventHandler } from 'h3'
import { db } from '../../database'
import { requireAccount } from '../../utils/guard'
import { allowedSites } from '../../utils/session'
import { querySitesList } from '../../utils/sitesRepository'

export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  const permittedIds = await allowedSites(db, account.id)

  try {
    return await querySitesList(db, permittedIds)
  } catch (erreur) {
    throw createError({ statusCode: 503, message: 'Référentiel des sites indisponible', cause: erreur })
  }
})
