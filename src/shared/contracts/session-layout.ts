import { z } from 'zod'
import {
  defaultSessionLayoutPreferenceValue,
  sessionLayoutGeometry
} from '../values/session-layout-values.js'

const clampPaneWidth = (value: number, minimum: number, maximum: number) =>
  Math.round(Math.max(minimum, Math.min(maximum, value)))

const currentSessionLayoutPreferenceSchema = z
  .object({
    controlPaneWidth: z
      .number()
      .transform((value) =>
        clampPaneWidth(
          value,
          sessionLayoutGeometry.controlPane.min,
          sessionLayoutGeometry.controlPane.max
        )
      ),
    scenarioPaneWidth: z
      .number()
      .transform((value) =>
        clampPaneWidth(
          value,
          sessionLayoutGeometry.scenarioPane.min,
          sessionLayoutGeometry.scenarioPane.max
        )
      ),
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
