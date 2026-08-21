import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { removeSupersededLocalInstallation } from '../../scripts/local-installation-legacy.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('superseded local installation cleanup', () => {
  it('removes a hash-owned legacy pair after current runtime verification', () => {
    const fixture = createFixture()
    const legacyAppImage = join(fixture.root, 'SaltMarcher.AppImage')
    const legacyMarker = join(fixture.root, 'installed-artifact.json')
    writeFileSync(legacyAppImage, 'legacy-app')
    writeFileSync(
      legacyMarker,
      JSON.stringify({
        formatVersion: 1,
        artifactSha256: hash('legacy-app')
      })
    )

    expect(removeSupersededLocalInstallation(fixture.input)).toEqual({
      status: 'removed',
      removed: [legacyAppImage, legacyMarker]
    })
    expect(existsSync(legacyAppImage)).toBe(false)
    expect(existsSync(legacyMarker)).toBe(false)
  })

  it('preserves legacy files when current runtime evidence is stale', () => {
    const fixture = createFixture({ currentArtifactHash: hash('other-app') })
    const legacyAppImage = join(fixture.root, 'SaltMarcher.AppImage')
    const legacyMarker = join(fixture.root, 'installed-artifact.json')
    writeFileSync(legacyAppImage, 'legacy-app')
    writeFileSync(
      legacyMarker,
      JSON.stringify({
        formatVersion: 1,
        artifactSha256: hash('legacy-app')
      })
    )

    expect(() => removeSupersededLocalInstallation(fixture.input)).toThrow(
      /verified runtime evidence/
    )
    expect(existsSync(legacyAppImage)).toBe(true)
    expect(existsSync(legacyMarker)).toBe(true)
  })

  it('preserves a legacy executable whose ownership hash does not match', () => {
    const fixture = createFixture()
    const legacyAppImage = join(fixture.root, 'SaltMarcher.AppImage')
    const legacyMarker = join(fixture.root, 'installed-artifact.json')
    writeFileSync(legacyAppImage, 'changed-legacy-app')
    writeFileSync(
      legacyMarker,
      JSON.stringify({
        formatVersion: 1,
        artifactSha256: hash('original-legacy-app')
      })
    )

    expect(() => removeSupersededLocalInstallation(fixture.input)).toThrow(
      /does not match its ownership marker/
    )
    expect(existsSync(legacyAppImage)).toBe(true)
    expect(existsSync(legacyMarker)).toBe(true)
  })

  it('preserves an unowned legacy executable and clears an orphaned marker', () => {
    const unowned = createFixture()
    const unownedAppImage = join(unowned.root, 'SaltMarcher.AppImage')
    writeFileSync(unownedAppImage, 'unknown-app')
    expect(() => removeSupersededLocalInstallation(unowned.input)).toThrow(
      /missing its ownership marker/
    )
    expect(existsSync(unownedAppImage)).toBe(true)

    const orphaned = createFixture()
    const orphanedMarker = join(orphaned.root, 'installed-artifact.json')
    writeFileSync(
      orphanedMarker,
      JSON.stringify({ formatVersion: 1, artifactSha256: hash('gone') })
    )
    expect(removeSupersededLocalInstallation(orphaned.input)).toEqual({
      status: 'removed',
      removed: [orphanedMarker]
    })
  })
})

function createFixture(
  override: { readonly currentArtifactHash?: string } = {}
): Readonly<{
  root: string
  input: Parameters<typeof removeSupersededLocalInstallation>[0]
}> {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-legacy-cleanup-'))
  roots.push(root)
  const current = join(root, 'current')
  mkdirSync(current)
  const currentAppImage = join(current, 'SaltMarcher.AppImage')
  const currentManifest = join(current, 'artifact-manifest.json')
  const runtimeEvidencePath = join(root, 'installed-runtime-evidence.json')
  writeFileSync(currentAppImage, 'current-app')
  writeFileSync(currentManifest, 'current-manifest')
  writeFileSync(
    runtimeEvidencePath,
    JSON.stringify({
      artifactSha256: override.currentArtifactHash ?? hash('current-app'),
      manifestSha256: hash('current-manifest'),
      utilityReady: true,
      generation: 1,
      bootstrap: { totalMs: 1, phases: { configuration: 1 } },
      quickChecks: [
        { path: 'installation.sqlite', role: 'installation', result: 'ok' }
      ],
      domainReadbacks: [
        {
          name: 'installation.readyCampaignCount',
          expected: 1,
          actual: 1,
          passed: true
        }
      ]
    })
  )
  return {
    root,
    input: {
      installationRoot: root,
      currentAppImage,
      currentManifest,
      runtimeEvidencePath
    }
  }
}

function hash(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}
