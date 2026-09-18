import { createError, defineEventHandler, getRouterParam } from 'h3'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../../database'
import * as schema from '../../../database/schema'
import { requireRole } from '../../../utils/guard'

const uuidSchema = z.string().uuid()

export default defineEventHandler(async (event) => {
  await requireRole(event, 'ADMIN')

  const idBrut = getRouterParam(event, 'id')
  const parsedId = uuidSchema.safeParse(idBrut)
  if (!parsedId.success) {
    throw createError({ statusCode: 422, message: 'Identifiant invalide' })
  }
  const id = parsedId.data

  const supprimés = await db
    .delete(schema.users)
    .where(eq(schema.users.id, id))
    .returning({ id: schema.users.id })

  if (supprimés.length === 0) {
    throw createError({ statusCode: 404, message: 'Compte introuvable' })
  }

  return { success: true }
})
