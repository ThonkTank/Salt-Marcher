import { describe, expect, it } from 'vitest'
import {
  newerRelease,
  releaseManifestSchema
} from '../../src/shared/contracts/release.js'
import { mainOperations } from '../../src/shared/contracts/operations.js'
import { operationAllowsRole } from '../../src/shared/contracts/operations/registry.js'
describe('release contracts', () => {
  it('compares numeric versions and rejects prereleases and malformed versions', () => {
    expect(newerRelease('0.10.0', '0.2.0')).toBe(true)
    expect(newerRelease('0.2.0', '0.10.0')).toBe(false)
    expect(newerRelease('0.2.0', '0.2.0')).toBe(false)
    expect(() => newerRelease('0.3.0-beta.1', '0.2.0')).toThrow()
  })
  it('rejects foreign repositories and executable traversal', () => {
    const manifest = {
      formatVersion: 1,
      repository: 'ThonkTank/Salt-Marcher',
      version: '0.2.0',
      commit: 'a'.repeat(40),
      platform: 'linux',
      arch: 'x64',
      schemaVersions: { installation: 39, campaign: 34 },
      artifact: {
        name: 'SaltMarcher-0.2.0-x64.AppImage',
        bytes: 12,
        sha256: 'b'.repeat(64)
      }
    }
    expect(releaseManifestSchema.safeParse(manifest).success).toBe(true)
    expect(
      releaseManifestSchema.safeParse({
        ...manifest,
        repository: 'other/repository'
      }).success
    ).toBe(false)
    expect(
      releaseManifestSchema.safeParse({
        ...manifest,
        artifact: { ...manifest.artifact, name: '../app' }
      }).success
    ).toBe(false)
  })
  it('exposes maintenance only to the main GM window with explicit confirmation', () => {
    const operation = mainOperations['updates.install']
    expect(operationAllowsRole(operation, 'passive')).toBe(false)
    expect(operation.input.safeParse({ confirmed: false }).success).toBe(false)
    expect(operation.input.safeParse({ confirmed: true }).success).toBe(true)
  })
})
