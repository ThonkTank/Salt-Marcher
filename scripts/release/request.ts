import { z } from 'zod'
import {
  newerRelease,
  releaseManifestSchema,
  releaseRepository,
  releaseVersionSchema
} from '../../src/shared/contracts/release.js'

export const releaseDigestSchema = z.string().regex(/^[a-f0-9]{64}$/)
const commitSchema = z.string().regex(/^[a-f0-9]{40}$/)
const githubId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)

export const comparisonArtifactSchema = z
  .object({
    manifest: releaseManifestSchema,
    manifestSha256: releaseDigestSchema,
    source: z.discriminatedUnion('kind', [
      z
        .object({ kind: z.literal('published-release'), tag: z.string() })
        .strict(),
      z
        .object({
          kind: z.literal('qualification-fixture'),
          workflowRunId: githubId,
          workflowRunAttempt: githubId,
          workflowCommit: commitSchema,
          artifactId: githubId,
          artifactName: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/)
        })
        .strict()
    ])
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.manifest.artifact.name !==
      `SaltMarcher-${value.manifest.version}-x64.AppImage`
    )
      context.addIssue({
        code: 'custom',
        message: 'Artifact filename must match its version.'
      })
    if (
      value.source.kind === 'published-release' &&
      value.source.tag !== `v${value.manifest.version}`
    )
      context.addIssue({
        code: 'custom',
        message: 'Published comparison tag must match its manifest.'
      })
  })

export const releaseComparisonSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/),
    scenario: z.enum(['same-schema', 'schema-migration', 'skipped-releases']),
    baseline: comparisonArtifactSchema,
    intermediate: z.array(comparisonArtifactSchema)
  })
  .strict()

export const releaseRequestSchema = z
  .object({
    formatVersion: z.literal(1),
    repository: z.literal(releaseRepository),
    target: z
      .object({
        version: releaseVersionSchema,
        commit: commitSchema,
        schemaVersions: releaseManifestSchema.shape.schemaVersions
      })
      .strict(),
    comparisons: z.array(releaseComparisonSchema).min(3).max(12)
  })
  .strict()
  .superRefine((request, context) => {
    const issue = (message: string) =>
      context.addIssue({ code: 'custom', message })
    const ids = request.comparisons.map((comparison) => comparison.id)
    if (new Set(ids).size !== ids.length)
      issue('Comparison IDs must be unique.')
    for (const scenario of [
      'same-schema',
      'schema-migration',
      'skipped-releases'
    ])
      if (
        !request.comparisons.some(
          (comparison) => comparison.scenario === scenario
        )
      )
        issue(`Missing required comparison: ${scenario}.`)
    for (const comparison of request.comparisons) {
      const baseline = comparison.baseline.manifest
      if (baseline.commit === request.target.commit)
        issue(
          'A comparison must come from a different source commit, not a repackaged target.'
        )
      const sameSchema = schemasEqual(
        baseline.schemaVersions,
        request.target.schemaVersions
      )
      if (comparison.scenario === 'same-schema' && !sameSchema)
        issue('Same-schema comparison has different data formats.')
      if (comparison.scenario === 'schema-migration' && sameSchema)
        issue('Migration comparison requires an actual schema transition.')
      if (comparison.scenario === 'skipped-releases') {
        if (comparison.intermediate.length === 0)
          issue(
            'Skipped-release comparison requires explicit intermediate artifacts.'
          )
      } else if (comparison.intermediate.length !== 0)
        issue(
          'Only skipped-release comparisons may name intermediate artifacts.'
        )
      const path = [
        baseline,
        ...comparison.intermediate.map((artifact) => artifact.manifest),
        request.target
      ]
      if (new Set(path.map((stand) => stand.commit)).size !== path.length)
        issue(
          'Comparison path must not reuse a source commit under another version.'
        )
      for (let index = 1; index < path.length; index++) {
        const before = path[index - 1]!
        const after = path[index]!
        if (!newerRelease(after.version, before.version))
          issue(
            'Comparison versions must increase strictly towards the requested target.'
          )
        if (after.commit === before.commit)
          issue(
            'Each comparison stand must identify its actual distinct source commit.'
          )
        if (
          after.schemaVersions.installation <
            before.schemaVersions.installation ||
          after.schemaVersions.campaign < before.schemaVersions.campaign
        )
          issue('Comparison path must never require a database downgrade.')
      }
    }
  })

export type ReleaseRequest = z.infer<typeof releaseRequestSchema>
export type ComparisonArtifact = z.infer<typeof comparisonArtifactSchema>

export function assertRequestedTarget(
  request: ReleaseRequest,
  rawManifest: unknown
): z.infer<typeof releaseManifestSchema> {
  const manifest = releaseManifestSchema.parse(rawManifest)
  if (
    manifest.version !== request.target.version ||
    manifest.commit !== request.target.commit ||
    !schemasEqual(manifest.schemaVersions, request.target.schemaVersions) ||
    manifest.artifact.name !== `SaltMarcher-${manifest.version}-x64.AppImage`
  )
    throw new Error(
      'Built release does not match the immutable release request.'
    )
  if (
    request.comparisons.some((comparison) =>
      [comparison.baseline, ...comparison.intermediate].some(
        (artifact) =>
          artifact.manifest.artifact.sha256 === manifest.artifact.sha256
      )
    )
  )
    throw new Error('The target bytes cannot also be a comparison artifact.')
  return manifest
}

function schemasEqual(
  left: { installation: number; campaign: number },
  right: { installation: number; campaign: number }
): boolean {
  return (
    left.installation === right.installation && left.campaign === right.campaign
  )
}
