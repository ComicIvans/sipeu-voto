import { z } from 'zod'
import { emailSchema, idSchema, passwordSchema } from './common'

export const userRoleSchema = z.enum(['admin', 'delegate'])

const DELEGATE_NEEDS_AFFILIATION = 'Los participantes deben tener comisión y grupo parlamentario.'

export const createUserSchema = z
  .object({
    firstName: z.string().trim().min(1, 'Nombre obligatorio').max(100),
    lastName: z.string().trim().min(1, 'Apellidos obligatorios').max(150),
    email: emailSchema,
    role: userRoleSchema.default('delegate'),
    committeeId: idSchema.nullable().optional(),
    groupId: idSchema.nullable().optional(),
    password: passwordSchema.optional(),
    sendCredentials: z.boolean().default(true),
  })
  .refine((value) => value.role === 'admin' || (value.committeeId && value.groupId), {
    message: DELEGATE_NEEDS_AFFILIATION,
    path: ['committeeId'],
  })

export const updateUserSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(150).optional(),
  email: emailSchema.optional(),
  role: userRoleSchema.optional(),
  committeeId: idSchema.nullable().optional(),
  groupId: idSchema.nullable().optional(),
})

export const userIdsSchema = z.object({
  ids: z.array(idSchema).min(1).max(500),
})
