import { z } from 'zod'

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Color no válido. Usa formato hex (#RRGGBB).')

export const idSchema = z.string().min(1).max(64)

export const emailSchema = z
  .email('Correo no válido')
  .max(200)
  .transform((value) => value.trim().toLowerCase())

export const passwordSchema = z.string().min(8, 'Mínimo 8 caracteres').max(128)

export function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.output<T> {
  const result = schema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error.issues[0]?.message ?? 'Datos no válidos.',
      data: { issues: result.error.issues },
    })
  }
  return result.data
}
