import { describe, expect, it } from 'vitest'
import {
  defaultInstallationPreferences,
  persistedInstallationPreferences,
  persistedInstallationPreferencesSchema
} from '../../src/shared/contracts/settings.js'

describe('persisted installation preferences envelope', () => {
  it('accepts only the strict current versioned shape', () => {
    expect(
      persistedInstallationPreferences(defaultInstallationPreferences)
    ).toEqual({
      schemaVersion: 1,
      preferences: defaultInstallationPreferences
    })
    expect(() =>
      persistedInstallationPreferencesSchema.parse(
        defaultInstallationPreferences
      )
    ).toThrow()
    expect(() =>
      persistedInstallationPreferencesSchema.parse({
        schemaVersion: 2,
        preferences: defaultInstallationPreferences
      })
    ).toThrow()
  })
})
