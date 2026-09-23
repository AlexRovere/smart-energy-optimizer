import { createError, defineEventHandler } from 'h3'
import { requireRole } from '../utils/guard'
import { fetchModelInfo } from '../utils/mlClient'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'ADMIN')

  try {
    return await fetchModelInfo()
  } catch (err) {
    const code = (err as { statusCode?: number }).statusCode
    throw createError({
      statusCode: code === 503 ? 503 : 502,
      message: err instanceof Error ? err.message : 'Service ML indisponible',
    })
  }
})
