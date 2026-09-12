import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  releaseManifestSchema,
  releaseRepository
} from '../../src/shared/contracts/release.js'
import { inspectReleaseFile } from '../release/bundle.js'
import { readHistoricalArtifact } from './historical-artifact-runner.js'

/** Preserve the distinction between instrumented historical fixtures and shipped bytes. */
export function readUpdateArtifact(directory: string) {
  if (existsSync(join(directory, 'historical-artifact.json'))) {
    const historical = readHistoricalArtifact(directory)
    const manifest = releaseManifestSchema.parse({
      formatVersion: 1,
      repository: releaseRepository,
      version: historical.receipt.version,
      commit: historical.receipt.source.commit,
      platform: 'linux',
      arch: 'x64',
      schemaVersions: historical.receipt.source.schemaVersions,
      artifact: historical.receipt.artifact
    })
    return {
      kind: 'historical-fixture' as const,
      manifest,
      executable: historical.executable,
      provenance: {
        kind: 'historical-fixture' as const,
        receipt: historical.receipt,
        receiptSha256: historical.receiptSha256
      }
    }
  }
  const document = inspectReleaseFile(
    join(directory, 'release-manifest.json'),
    4 * 1024 * 1024,
    true
  )
  const manifest = releaseManifestSchema.parse(
    JSON.parse(document.content.toString('utf8'))
  )
  if (manifest.artifact.name !== `SaltMarcher-${manifest.version}-x64.AppImage`)
    throw new Error('Release target filename differs from its version.')
  const executable = resolve(directory, manifest.artifact.name)
  const actual = inspectReleaseFile(executable, manifest.artifact.bytes, false)
  if (
    actual.bytes !== manifest.artifact.bytes ||
    actual.sha256 !== manifest.artifact.sha256
  )
    throw new Error('Release target bytes differ from their manifest.')
  return {
    kind: 'release' as const,
    manifest,
    executable,
    provenance: {
      kind: 'release' as const,
      manifest,
      manifestSha256: document.sha256
    }
  }
}
export type UpdateArtifact = ReturnType<typeof readUpdateArtifact>
