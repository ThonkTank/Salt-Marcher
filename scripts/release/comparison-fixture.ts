import { isDeepStrictEqual } from 'node:util'
import { join } from 'node:path'
import { z } from 'zod'
import { releaseManifestSchema } from '../../src/shared/contracts/release.js'
import {
  comparisonArtifactSchema,
  releaseDigestSchema,
  type ComparisonArtifact
} from './request.js'
import { inspectReleaseFile } from './bundle.js'

export const comparisonFixtureReceiptSchema = z
  .object({
    formatVersion: z.literal(1),
    kind: z.literal('historical-qualification-fixture'),
    manifest: releaseManifestSchema,
    manifestSha256: releaseDigestSchema,
    historicalReceiptSha256: releaseDigestSchema,
    workflow: z
      .object({
        runId: z.number().int().positive(),
        attempt: z.number().int().positive(),
        commit: z.string().regex(/^[a-f0-9]{40}$/)
      })
      .strict()
  })
  .strict()

export function verifyComparisonFiles(
  directory: string,
  raw: ComparisonArtifact
) {
  const expected = comparisonArtifactSchema.parse(raw)
  const document = inspectReleaseFile(
    join(directory, 'release-manifest.json'),
    4 * 1024 * 1024,
    true
  )
  const manifest = releaseManifestSchema.parse(
    JSON.parse(document.content.toString('utf8'))
  )
  if (
    document.sha256 !== expected.manifestSha256 ||
    !isDeepStrictEqual(manifest, expected.manifest)
  )
    throw new Error('Comparison manifest differs from the immutable request.')
  const image = inspectReleaseFile(
    join(directory, manifest.artifact.name),
    manifest.artifact.bytes,
    false
  )
  if (
    image.bytes !== manifest.artifact.bytes ||
    image.sha256 !== manifest.artifact.sha256
  )
    throw new Error('Comparison AppImage differs from the immutable request.')
  if (expected.source.kind === 'qualification-fixture') {
    const receipt = comparisonFixtureReceiptSchema.parse(
      JSON.parse(
        inspectReleaseFile(
          join(directory, 'comparison-fixture.json'),
          4 * 1024 * 1024,
          true
        ).content.toString('utf8')
      )
    )
    const historical = inspectReleaseFile(
      join(directory, 'historical-artifact.json'),
      4 * 1024 * 1024,
      true
    )
    const origin = z
      .object({
        formatVersion: z.literal(1),
        evidence: z.literal('historical-test-artifact-not-public-release'),
        version: z.string(),
        source: z.object({
          commit: z.string(),
          schemaVersions: releaseManifestSchema.shape.schemaVersions
        }),
        artifact: releaseManifestSchema.shape.artifact
      })
      .parse(JSON.parse(historical.content.toString('utf8')))
    if (
      !isDeepStrictEqual(receipt.manifest, manifest) ||
      receipt.manifestSha256 !== document.sha256 ||
      receipt.historicalReceiptSha256 !== historical.sha256 ||
      receipt.workflow.runId !== expected.source.workflowRunId ||
      receipt.workflow.attempt !== expected.source.workflowRunAttempt ||
      receipt.workflow.commit !== expected.source.workflowCommit ||
      origin.version !== manifest.version ||
      origin.source.commit !== manifest.commit ||
      !isDeepStrictEqual(
        origin.source.schemaVersions,
        manifest.schemaVersions
      ) ||
      !isDeepStrictEqual(origin.artifact, manifest.artifact)
    )
      throw new Error(
        'Historical fixture receipt does not bind its source, bytes and build workflow.'
      )
  }
  return manifest
}
