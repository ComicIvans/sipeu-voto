import { z } from 'zod'
import { hexColorSchema } from './common'

export const committeeSchema = z.object({
  name: z.string().trim().min(1, 'Nombre obligatorio').max(120),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'El slug solo puede contener minúsculas, números y guiones.')
    .optional(),
  order: z.number().int().min(0).max(1000).optional(),
})

export const groupSchema = z.object({
  name: z.string().trim().min(1, 'Nombre obligatorio').max(120),
  abbreviation: z.string().trim().min(1, 'Siglas obligatorias').max(12),
  color: hexColorSchema,
  order: z.number().int().min(0).max(1000).optional(),
})
