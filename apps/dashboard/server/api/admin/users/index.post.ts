import { createError, defineEventHandler, readValidatedBody } from 'h3'
import { eq } from 'drizzle-orm'
import { hash } from '@node-rs/argon2'
import { createUserSchema } from '../../../../shared/adminSchema'
import { db } from '../../../database'
import * as schema from '../../../database/schema'
import { PARAMETRES_ARGON2ID } from '../../../database/seed'
import { requireRole } from '../../../utils/guard'
import { allowedSites } from '../../../utils/session'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'ADMIN')

  const entree = await readValidatedBody(event, createUserSchema.safeParse)
  if (!entree.success) {
    throw createError({ statusCode: 422, message: 'Entrée invalide' })
  }
  const { email, password, role, sites } = entree.data

  const [roleRow] = await db
    .select({ id: schema.roles.id })
    .from(schema.roles)
    .where(eq(schema.roles.name, role))

  if (roleRow === undefined) {
    throw createError({ statusCode: 422, message: 'Rôle inconnu' })
  }

  const passwordHash = await hash(password, PARAMETRES_ARGON2ID)

  let nouvelUtilisateur: { id: string, email: string, isActive: boolean, createdAt: Date }
  try {
    const [inserted] = await db
      .insert(schema.users)
      .values({ roleId: roleRow.id, email, passwordHash })
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        isActive: schema.users.isActive,
        createdAt: schema.users.createdAt
      })
    if (inserted === undefined) {
      throw new Error("L'insertion n'a rendu aucune ligne.")
    }
    nouvelUtilisateur = inserted
  } catch (err: unknown) {
    // Code 23505 : violation de contrainte unique (email déjà pris)
    const pgErr = err as { code?: string }
    if (pgErr.code === '23505') {
      throw createError({ statusCode: 409, message: 'Adresse déjà utilisée' })
    }
    throw err
  }

  if (sites.length > 0) {
    await db.insert(schema.userSites).values(
      sites.map(siteId => ({ userId: nouvelUtilisateur.id, siteId }))
    )
  }

  const account = { id: nouvelUtilisateur.id, email: nouvelUtilisateur.email, role }
  return {
    id: nouvelUtilisateur.id,
    email: nouvelUtilisateur.email,
    role,
    is_active: nouvelUtilisateur.isActive,
    sites: await allowedSites(db, account),
    created_at: nouvelUtilisateur.createdAt
  }
})
