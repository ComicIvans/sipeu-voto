import { z } from 'zod'
import { hexColorSchema } from './common'
import { COMMITTEE_ICONS, GROUP_ICONS } from '~~/shared/constants/icons'

const committeeIconSchema = z.enum(COMMITTEE_ICONS).nullable().optional()
const groupIconSchema = z.enum(GROUP_ICONS).nullable().optional()

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
  icon: committeeIconSchema,
})

export const groupSchema = z.object({
  name: z.string().trim().min(1, 'Nombre obligatorio').max(120),
  abbreviation: z.string().trim().min(1, 'Siglas obligatorias').max(12),
  color: hexColorSchema,
  order: z.number().int().min(0).max(1000).optional(),
  icon: groupIconSchema,
})

/** Full ordering, front to back. Every row must be present exactly once. */
export const reorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
})
