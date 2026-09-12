import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { z } from 'zod'
import { releaseManifestSchema } from '../../src/shared/contracts/release.js'
import {
  assertRequestedTarget,
  comparisonArtifactSchema,
  releaseDigestSchema,
  releaseRequestSchema
} from './request.js'

export const releaseEvidenceFileSchema = z
  .object({
    name: z
      .string()
      .regex(/^[a-z0-9][a-z0-9.-]*\.json$/)
      .refine(
        (name) =>
          ![
            'release-manifest.json',
            'release-request.json',
            'update-qualification.json',
            'release-acceptance.json'
          ].includes(name),
        'Evidence must not replace a release control document.'
      ),
    bytes: z
      .number()
      .int()
      .positive()
      .max(64 * 1024 * 1024),
    sha256: releaseDigestSchema
  })
  .strict()

const profileProofSchema = z
  .object({
    sourceUnchanged: z.literal(true),
    campaigns: z
      .object({
        active: z.number().int().positive(),
        inactive: z.number().int().positive(),
        recoverableDeleted: z.number().int().positive()
      })
      .strict(),
    before: releaseDigestSchema,
    migratedExpected: releaseDigestSchema,
    migratedActual: releaseDigestSchema,
    continuedExpected: releaseDigestSchema,
    continuedActual: releaseDigestSchema,
    restored: releaseDigestSchema,
    protection: releaseDigestSchema,
    protectedRestore: releaseDigestSchema,
    secondProtection: releaseDigestSchema
  })
  .strict()
  .superRefine((proof, context) => {
    const equal = (left: string, right: string, message: string) => {
      if (left !== right) context.addIssue({ code: 'custom', message })
    }
    equal(
      proof.migratedExpected,
      proof.migratedActual,
      'Complete migrated profile differs from expectation.'
    )
    equal(
      proof.continuedExpected,
      proof.continuedActual,
      'Continued work differs from expectation.'
    )
    if (proof.continuedActual === proof.migratedActual)
      context.addIssue({
        code: 'custom',
        message: 'Qualification must prove an actual saved change.'
      })
    equal(
      proof.restored,
      proof.migratedActual,
      'Restoration did not recover the complete migrated original.'
    )
    equal(
      proof.protection,
      proof.continuedActual,
      'Protective backup lost later work.'
    )
    equal(
      proof.protectedRestore,
      proof.continuedActual,
      'Protective backup was not actually restored.'
    )
    equal(
      proof.secondProtection,
      proof.restored,
      'Second restoration did not protect the preceding state.'
    )
  })

export const releaseQualificationSchema = z
  .object({
    formatVersion: z.literal(2),
    requestSha256: releaseDigestSchema,
    target: releaseManifestSchema,
    targetManifestSha256: releaseDigestSchema,
    workflow: z
      .object({
        runId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
        attempt: z.number().int().positive(),
        commit: z.string().regex(/^[a-f0-9]{40}$/)
      })
      .strict(),
    completedAt: z.iso.datetime(),
    comparisons: z
      .array(
        z
          .object({
            id: z.string(),
            baseline: comparisonArtifactSchema,
            runtime: z
              .object({
                version: z.string(),
                commit: z.string().regex(/^[a-f0-9]{40}$/),
                schemaVersions: releaseManifestSchema.shape.schemaVersions
              })
              .strict(),
            evidence: releaseEvidenceFileSchema,
            profile: profileProofSchema
          })
          .strict()
      )
      .min(3),
    firstInstallation: releaseEvidenceFileSchema,
    recovery: z
      .object({
        comparisonId: z.string(),
        evidence: releaseEvidenceFileSchema,
        previousProgram: releaseDigestSchema,
        recoveredProgram: releaseDigestSchema,
        previousProfile: releaseDigestSchema,
        recoveredProfile: releaseDigestSchema,
        acceptedWorkAfterCrash: releaseDigestSchema
      })
      .strict()
  })
  .strict()

export type ReleaseQualification = z.infer<typeof releaseQualificationSchema>

/** Validates document bindings; callers must also verify files and live CI provenance. */
export function verifyQualificationDocuments(
  requestBytes: Uint8Array,
  manifestBytes: Uint8Array,
  qualificationBytes: Uint8Array
): ReleaseQualification {
  const request = releaseRequestSchema.parse(parseDocument(requestBytes))
  const target = assertRequestedTarget(request, parseDocument(manifestBytes))
  const qualification = releaseQualificationSchema.parse(
    parseDocument(qualificationBytes)
  )
  if (
    qualification.requestSha256 !== digestReleaseDocument(requestBytes) ||
    qualification.targetManifestSha256 !==
      digestReleaseDocument(manifestBytes) ||
    !isDeepStrictEqual(qualification.target, target) ||
    qualification.workflow.commit !== target.commit
  )
    throw new Error(
      'Qualification does not prove these exact release documents and source commit.'
    )
  const requested = new Map(
    request.comparisons.map((comparison) => [comparison.id, comparison])
  )
  const seen = new Set<string>()
  for (const result of qualification.comparisons) {
    const comparison = requested.get(result.id)
    if (
      !comparison ||
      seen.has(result.id) ||
      !isDeepStrictEqual(result.baseline, comparison.baseline) ||
      !isDeepStrictEqual(result.runtime, request.target)
    )
      throw new Error(
        'Qualification comparison does not match its request or target runtime.'
      )
    seen.add(result.id)
  }
  if (seen.size !== requested.size)
    throw new Error('Qualification omits a requested comparison.')
  const recovery = qualification.recovery
  const result = qualification.comparisons.find(
    (comparison) => comparison.id === recovery.comparisonId
  )
  if (
    !result ||
    recovery.previousProgram !== result.baseline.manifest.artifact.sha256 ||
    recovery.recoveredProgram !== recovery.previousProgram ||
    recovery.previousProfile !== result.profile.before ||
    recovery.recoveredProfile !== recovery.previousProfile ||
    recovery.acceptedWorkAfterCrash !== result.profile.continuedActual
  )
    throw new Error(
      'Recovery evidence does not preserve the required program/data pair and later work.'
    )
  const files = [
    qualification.firstInstallation,
    qualification.recovery.evidence,
    ...qualification.comparisons.map((comparison) => comparison.evidence)
  ]
  if (new Set(files.map((file) => file.name)).size !== files.length)
    throw new Error('Every qualification case needs its own evidence file.')
  return qualification
}

export function digestReleaseDocument(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function parseDocument(bytes: Uint8Array): unknown {
  if (bytes.byteLength > 4 * 1024 * 1024)
    throw new Error('Release control document is too large.')
  return JSON.parse(Buffer.from(bytes).toString('utf8')) as unknown
}
