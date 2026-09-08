import { z } from 'zod'
import { hexColorSchema, idSchema } from './common'

const optionalPositiveInt = z.number().int().positive().nullable().optional()

export const voteOptionInputSchema = z.object({
  label: z.string().trim().min(1, 'Etiqueta obligatoria').max(120),
  color: hexColorSchema.nullable().optional(),
  canWin: z.boolean().optional(),
})

export const createVoteSchema = z.object({
  name: z.string().trim().min(1, 'Nombre obligatorio').max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  committeeId: idSchema.nullable(),
  visible: z.boolean().optional(),
  allowChange: z.boolean().optional(),
  showLiveResults: z.boolean().optional(),
  minimumVotes: optionalPositiveInt,
  maxWinners: optionalPositiveInt,
  options: z.array(voteOptionInputSchema).max(20).optional(),
})

export const updateVoteSchema = createVoteSchema
  .omit({ options: true, committeeId: true })
  .partial()
  .extend({
    committeeId: idSchema.nullable().optional(),
    order: z.number().int().min(0).max(10_000).optional(),
  })

export const updateOptionSchema = voteOptionInputSchema.partial()

export const reorderOptionsSchema = z.object({
  optionIds: z.array(idSchema).min(1).max(20),
})

export const castBallotSchema = z.object({
  optionId: idSchema,
})
