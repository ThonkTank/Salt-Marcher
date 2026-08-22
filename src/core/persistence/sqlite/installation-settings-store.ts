import type Database from 'better-sqlite3'
import {
  defaultInstallationPreferences,
  installationPreferencesSchema,
  persistedInstallationPreferences,
  persistedInstallationPreferencesSchema,
  installationSettingsSchema,
  type InstallationPreferencesPatch,
  type InstallationSettings
} from '../../../shared/contracts/settings.js'
import { CapabilityError } from '../../../shared/errors/capability-error.js'

export class InstallationSettingsStore {
  constructor(private readonly db: Database.Database) {}

  read(): InstallationSettings {
    const row = this.db
      .prepare(
        'SELECT revision, preferences_json AS preferencesJson FROM installation_settings WHERE singleton = 1'
      )
      .get() as { revision: number; preferencesJson: string }
    return installationSettingsSchema.parse({
      revision: row.revision,
      preferences: persistedInstallationPreferencesSchema.parse(
        JSON.parse(row.preferencesJson) as unknown
      ).preferences
    })
  }

  update(
    patch: InstallationPreferencesPatch,
    expectedRevision: number
  ): InstallationSettings {
    const current = this.read()
    const preferences = installationPreferencesSchema.parse({
      ...defaultInstallationPreferences,
      ...current.preferences,
      ...patch
    })
    const changed = this.db
      .prepare(
        'UPDATE installation_settings SET revision = revision + 1, preferences_json = ? WHERE singleton = 1 AND revision = ?'
      )
      .run(
        JSON.stringify(persistedInstallationPreferences(preferences)),
        expectedRevision
      )
    if (changed.changes !== 1) throw new CapabilityError('stale', true)
    return this.read()
  }
}
