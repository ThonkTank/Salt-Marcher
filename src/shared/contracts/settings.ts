import { z } from 'zod'
import {
  defaultSessionLayoutPreference,
  sessionLayoutPreferenceSchema
} from './session-layout.js'

export const installationPreferencesSchema = z
  .object({
    theme: z.enum(['light', 'dark']),
    sessionLayout: sessionLayoutPreferenceSchema
  })
  .strict()

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
    theme: 'light',
    sessionLayout: defaultSessionLayoutPreference
  })

export type InstallationPreferences = Readonly<
  z.infer<typeof installationPreferencesSchema>
>
export type InstallationPreferencesPatch = Readonly<
  z.infer<typeof installationPreferencesPatchSchema>
>
export type InstallationSettings = Readonly<
  z.infer<typeof installationSettingsSchema>
>
