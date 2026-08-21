import {
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  rmSync
} from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { installedRuntimeEvidenceSchema } from './delivery-contract.js'
import { sha256File } from './file-hash.js'

const fingerprintSchema = z.string().regex(/^[a-f0-9]{64}$/)

const legacyInstalledArtifactSchema = z
  .object({
    formatVersion: z.literal(1),
    artifactSha256: fingerprintSchema
  })
  .passthrough()

export type SupersededInstallationCleanup = Readonly<{
  status: 'absent' | 'removed'
  removed: readonly string[]
}>

/**
 * Removes the pre-deployment-layout AppImage and marker only after the current
 * immutable deployment has produced matching runtime evidence.
 */
export function removeSupersededLocalInstallation(input: {
  readonly installationRoot: string
  readonly currentAppImage: string
  readonly currentManifest: string
  readonly runtimeEvidencePath: string
}): SupersededInstallationCleanup {
  const evidence = installedRuntimeEvidenceSchema.parse(
    JSON.parse(readFileSync(input.runtimeEvidencePath, 'utf8'))
  )
  if (
    sha256File(input.currentAppImage) !== evidence.artifactSha256 ||
    sha256File(input.currentManifest) !== evidence.manifestSha256
  )
    throw new Error(
      'Current installation no longer matches its verified runtime evidence'
    )

  const legacyAppImage = join(input.installationRoot, 'SaltMarcher.AppImage')
  const legacyMarker = join(input.installationRoot, 'installed-artifact.json')
  const appImageExists = existsSync(legacyAppImage)
  const markerExists = existsSync(legacyMarker)
  if (!appImageExists && !markerExists) return { status: 'absent', removed: [] }
  if (appImageExists && !markerExists)
    throw new Error(
      'Unverified legacy AppImage is missing its ownership marker and was preserved'
    )

  const marker = legacyInstalledArtifactSchema.parse(
    JSON.parse(readFileSync(legacyMarker, 'utf8'))
  )
  if (appImageExists && sha256File(legacyAppImage) !== marker.artifactSha256)
    throw new Error(
      'Legacy AppImage does not match its ownership marker and was preserved'
    )

  const removed: string[] = []
  if (appImageExists) {
    rmSync(legacyAppImage)
    removed.push(legacyAppImage)
  }
  rmSync(legacyMarker)
  removed.push(legacyMarker)
  syncDirectory(input.installationRoot)
  return { status: 'removed', removed }
}

function syncDirectory(path: string): void {
  const descriptor = openSync(path, 'r')
  try {
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
}
