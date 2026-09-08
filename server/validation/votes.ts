import { z } from 'zod'
import { hexColorSchema, idSchema } from './common'

const optionalPositiveInt = z.number().int().positive().nullable().optional()

/** Accepts the ISO string the browser sends and hands the handler a Date. */
const optionalDate = z.coerce.date().nullable().optional()

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
  // Both optional, and neither has to be in the future: a closing time that has
  // already passed is a valid way of saying "close it at the top of the hour"
  // once the hour has gone by.
  opensAt: optionalDate,
  closesAt: optionalDate,
  options: z.array(voteOptionInputSchema).max(20).optional(),
})

export const updateVoteSchema = createVoteSchema
  .omit({ options: true, committeeId: true })
  .partial()
  .extend({
    committeeId: idSchema.nullable().optional(),
    order: z.number().int().min(0).max(10_000).optional(),
  })

export const replaceOptionsSchema = z.object({
  options: z
    .array(voteOptionInputSchema.extend({ id: idSchema.optional() }))
    .min(1)
    .max(20),
})

export const castBallotSchema = z.object({
  optionId: idSchema,
})
