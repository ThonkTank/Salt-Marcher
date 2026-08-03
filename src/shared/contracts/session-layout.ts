import { z } from 'zod'

const fraction = z.number().min(0.18).max(0.82)

export const sessionLayoutPreferenceSchema = z
  .object({
    leftFraction: fraction,
    rightTopFraction: fraction,
    upperRightTab: z.enum(['details', 'map'])
  })
  .strict()

export type SessionLayoutPreference = Readonly<
  z.infer<typeof sessionLayoutPreferenceSchema>
>

export const defaultSessionLayoutPreference: SessionLayoutPreference =
  sessionLayoutPreferenceSchema.parse({
    leftFraction: 0.62,
    rightTopFraction: 0.45,
    upperRightTab: 'details'
  })
