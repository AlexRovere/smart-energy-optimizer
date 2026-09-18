import { defineEventHandler } from 'h3'
import { asc, eq } from 'drizzle-orm'
import { db } from '../../../database'
import * as schema from '../../../database/schema'
import { requireRole } from '../../../utils/guard'
import { allowedSites } from '../../../utils/session'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'ADMIN')

  const rows = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      role: schema.roles.name,
      isActive: schema.users.isActive,
      createdAt: schema.users.createdAt
    })
    .from(schema.users)
    .innerJoin(schema.roles, eq(schema.roles.id, schema.users.roleId))
    .orderBy(asc(schema.users.createdAt))

  return Promise.all(rows.map(async row => ({
    id: row.id,
    email: row.email,
    role: row.role,
    is_active: row.isActive,
    sites: await allowedSites(db, { id: row.id, email: row.email, role: row.role }),
    created_at: row.createdAt
  })))
})
