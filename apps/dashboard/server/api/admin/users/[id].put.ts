import { createError, defineEventHandler, getRouterParam, readValidatedBody } from 'h3'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { updateUserSchema } from '../../../../shared/adminSchema'
import { db } from '../../../database'
import * as schema from '../../../database/schema'
import { requireRole } from '../../../utils/guard'
import { allowedSites } from '../../../utils/session'

const uuidSchema = z.string().uuid()

export default defineEventHandler(async (event) => {
  await requireRole(event, 'ADMIN')

  const idBrut = getRouterParam(event, 'id')
  const parsedId = uuidSchema.safeParse(idBrut)
  if (!parsedId.success) {
    throw createError({ statusCode: 422, message: 'Identifiant invalide' })
  }
  const id = parsedId.data

  const entree = await readValidatedBody(event, updateUserSchema.safeParse)
  if (!entree.success) {
    throw createError({ statusCode: 422, message: 'Entrée invalide' })
  }
  const { email, role, sites, is_active } = entree.data

  // Construire le patch uniquement avec les champs fournis
  const patch: Partial<{ email: string, roleId: number, isActive: boolean }> = {}

  if (email !== undefined) patch.email = email

  if (role !== undefined) {
    const [roleRow] = await db
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(eq(schema.roles.name, role))
    if (roleRow === undefined) {
      throw createError({ statusCode: 422, message: 'Rôle inconnu' })
    }
    patch.roleId = roleRow.id
  }

  if (is_active !== undefined) patch.isActive = is_active

  if (Object.keys(patch).length > 0) {
    await db.update(schema.users).set(patch).where(eq(schema.users.id, id))
  }

  if (sites !== undefined) {
    await db.delete(schema.userSites).where(eq(schema.userSites.userId, id))
    if (sites.length > 0) {
      await db.insert(schema.userSites).values(sites.map(siteId => ({ userId: id, siteId })))
    }
  }

  const [updated] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      role: schema.roles.name,
      isActive: schema.users.isActive,
      createdAt: schema.users.createdAt
    })
    .from(schema.users)
    .innerJoin(schema.roles, eq(schema.roles.id, schema.users.roleId))
    .where(eq(schema.users.id, id))

  if (updated === undefined) {
    throw createError({ statusCode: 404, message: 'Compte introuvable' })
  }

  const account = { id: updated.id, email: updated.email, role: updated.role }
  return {
    id: updated.id,
    email: updated.email,
    role: updated.role,
    is_active: updated.isActive,
    sites: await allowedSites(db, account),
    created_at: updated.createdAt
  }
})
