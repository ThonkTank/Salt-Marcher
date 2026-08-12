import { z } from 'zod'
import { defaultSessionLayoutPreferenceValue } from '../values/session-layout-values.js'

const currentSessionLayoutPreferenceSchema = z
  .object({
    controlPaneWidth: z.number().int().min(240).max(440),
    scenarioPaneWidth: z.number().int().min(220).max(420),
    centerTab: z.enum(['details', 'catalog', 'map'])
  })
  .strict()

const legacySessionLayoutPreferenceSchema = z
  .object({
    leftFraction: z.number(),
    rightTopFraction: z.number(),
    upperRightTab: z.enum(['details', 'map'])
  })
  .strict()

export const sessionLayoutPreferenceSchema = z
  .union([
    currentSessionLayoutPreferenceSchema,
    legacySessionLayoutPreferenceSchema.transform((legacy) => ({
      controlPaneWidth: 300,
      scenarioPaneWidth: 264,
      centerTab: legacy.upperRightTab
    }))
  ])
  .pipe(currentSessionLayoutPreferenceSchema)

export type SessionLayoutPreference = Readonly<
  z.infer<typeof sessionLayoutPreferenceSchema>
>

export const defaultSessionLayoutPreference: SessionLayoutPreference =
  sessionLayoutPreferenceSchema.parse(defaultSessionLayoutPreferenceValue)
