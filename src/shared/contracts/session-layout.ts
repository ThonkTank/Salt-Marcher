import { z } from 'zod'
import {
  defaultSessionLayoutPreferenceValue,
  sessionLayoutGeometry
} from '../values/session-layout-values.js'

const currentSessionLayoutPreferenceSchema = z
  .object({
    schemaVersion: z.literal(2),
    controlPaneWidth: z
      .number()
      .int()
      .min(sessionLayoutGeometry.controlPane.min)
      .max(sessionLayoutGeometry.controlPane.max),
    scenarioPaneWidth: z
      .number()
      .int()
      .min(sessionLayoutGeometry.scenarioPane.min)
      .max(sessionLayoutGeometry.scenarioPane.max),
    centerTab: z.enum(['details', 'catalog', 'map'])
  })
  .strict()

const unversionedPixelLayoutSchema = z
  .object({
    controlPaneWidth: z.number().finite(),
    scenarioPaneWidth: z.number().finite(),
    centerTab: z.enum(['details', 'catalog', 'map'])
  })
  .strict()

const legacyFractionLayoutSchema = z
  .object({
    leftFraction: z.number(),
    rightTopFraction: z.number(),
    upperRightTab: z.enum(['details', 'map'])
  })
  .strict()

export type SessionLayoutPreference = Readonly<
  z.infer<typeof currentSessionLayoutPreferenceSchema>
>

export type SessionLayoutMigrationResult =
  | Readonly<{
      kind: 'current'
      preference: SessionLayoutPreference
    }>
  | Readonly<{
      kind: 'migrated'
      migration: 'unversioned-pixels-to-v2' | 'legacy-fractions-to-v2'
      preference: SessionLayoutPreference
    }>
  | Readonly<{ kind: 'invalid'; issues: readonly z.core.$ZodIssue[] }>

/** Validation, named persistence migration, and runtime fit remain separate. */
export function migrateSessionLayoutPreference(
  value: unknown
): SessionLayoutMigrationResult {
  const current = currentSessionLayoutPreferenceSchema.safeParse(value)
  if (current.success) return { kind: 'current', preference: current.data }
  const pixels = unversionedPixelLayoutSchema.safeParse(value)
  if (pixels.success)
    return {
      kind: 'migrated',
      migration: 'unversioned-pixels-to-v2',
      preference: {
        schemaVersion: 2,
        controlPaneWidth: fitPaneWidth(
          pixels.data.controlPaneWidth,
          sessionLayoutGeometry.controlPane
        ),
        scenarioPaneWidth: fitPaneWidth(
          pixels.data.scenarioPaneWidth,
          sessionLayoutGeometry.scenarioPane
        ),
        centerTab: pixels.data.centerTab
      }
    }
  const fractions = legacyFractionLayoutSchema.safeParse(value)
  if (fractions.success)
    return {
      kind: 'migrated',
      migration: 'legacy-fractions-to-v2',
      preference: {
        schemaVersion: 2,
        controlPaneWidth: 300,
        scenarioPaneWidth: 264,
        centerTab: fractions.data.upperRightTab
      }
    }
  return { kind: 'invalid', issues: current.error.issues }
}

export const sessionLayoutPreferenceSchema = z.preprocess((value, context) => {
  const result = migrateSessionLayoutPreference(value)
  if (result.kind !== 'invalid') return result.preference
  context.addIssue({
    code: 'custom',
    message: 'Invalid Session layout preference'
  })
  return z.NEVER
}, currentSessionLayoutPreferenceSchema)

export const defaultSessionLayoutPreference: SessionLayoutPreference =
  currentSessionLayoutPreferenceSchema.parse(
    defaultSessionLayoutPreferenceValue
  )

function fitPaneWidth(
  value: number,
  bounds: Readonly<{ min: number; max: number }>
): number {
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(value)))
}
