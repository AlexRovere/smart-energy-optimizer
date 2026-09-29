import { createError, defineEventHandler, getRouterParam } from 'h3'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../../database'
import * as schema from '../../../database/schema'
import { requireRole } from '../../../utils/guard'

const uuidSchema = z.string().uuid()

export default defineEventHandler(async (event) => {
  await requireRole(event, 'ADMIN')

  const rawId = getRouterParam(event, 'id')
  const parsedId = uuidSchema.safeParse(rawId)
  if (!parsedId.success) {
    throw createError({ statusCode: 422, message: 'Identifiant invalide' })
  }
  const id = parsedId.data

  const deleted = await db
    .delete(schema.users)
    .where(eq(schema.users.id, id))
    .returning({ id: schema.users.id })

  if (deleted.length === 0) {
    throw createError({ statusCode: 404, message: 'Compte introuvable' })
  }

  return { success: true }
})
