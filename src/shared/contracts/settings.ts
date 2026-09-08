import { z } from 'zod'
import { sessionLayoutPreferenceSchema } from './session-layout.js'

/** Historical envelope codec, used only when migrating pre-desktop settings. */
export const legacyInstallationPreferencesSchema = z
  .object({
    theme: z.enum(['light', 'dark']),
    sceneDesktopPreview: z.boolean().optional(),
    sessionLayout: sessionLayoutPreferenceSchema
  })
  .strict()
export const legacyPersistedInstallationPreferencesSchema = z
  .object({
    schemaVersion: z.literal(1),
    preferences: legacyInstallationPreferencesSchema
  })
  .strict()

export const installationPreferencesSchema = z
  .object({
    theme: z.enum(['light', 'dark'])
  })
  .strict()

export const persistedInstallationPreferencesSchema = z
  .object({
    schemaVersion: z.literal(2),
    preferences: installationPreferencesSchema
  })
  .strict()
  .readonly()

export const installationSettingsSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    preferences: installationPreferencesSchema
  })
  .strict()
  .readonly()

export const installationPreferencesPatchSchema =
  installationPreferencesSchema.partial()

export const updateInstallationSettingsInputSchema = z
  .object({
    patch: installationPreferencesPatchSchema,
    expectedRevision: z.number().int().nonnegative()
  })
  .strict()

export const defaultInstallationPreferences: InstallationPreferences =
  installationPreferencesSchema.parse({
    theme: 'light'
  })

export function persistedInstallationPreferences(
  preferences: InstallationPreferences
): PersistedInstallationPreferences {
  return persistedInstallationPreferencesSchema.parse({
    schemaVersion: 2,
    preferences
  })
}

export type InstallationPreferences = Readonly<
  z.infer<typeof installationPreferencesSchema>
>
export type InstallationPreferencesPatch = Readonly<
  z.infer<typeof installationPreferencesPatchSchema>
>
export type PersistedInstallationPreferences = Readonly<
  z.infer<typeof persistedInstallationPreferencesSchema>
>
export type InstallationSettings = Readonly<
  z.infer<typeof installationSettingsSchema>
>
