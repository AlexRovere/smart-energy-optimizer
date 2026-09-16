import { z } from 'zod'

export const loginSchema = z.object({
  email: z.email({ error: 'L\'adresse email est requise' }),
  password: z.string({ error: 'Le mot de passe est requis' })
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
})
export type LoginInput = z.infer<typeof loginSchema>