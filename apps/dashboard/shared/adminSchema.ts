import { z } from 'zod'

const siteIdSchema = z.string().regex(/^SITE\d{3}$/)
const roleSchema = z.enum(['ADMIN', 'OPERATOR', 'VIEWER'])

export const createUserSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  role: roleSchema,
  sites: z.array(siteIdSchema)
})

export const updateUserSchema = z.object({
  email: z.email().optional(),
  role: roleSchema.optional(),
  sites: z.array(siteIdSchema).optional(),
  is_active: z.boolean().optional()
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
