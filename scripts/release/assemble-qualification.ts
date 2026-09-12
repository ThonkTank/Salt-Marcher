import assert from 'node:assert/strict'
import type { UpdateArtifact } from '../qualification/update-artifact.js'
import {
  assertRequestedTarget,
  releaseRequestSchema,
  type ComparisonArtifact
} from './request.js'
import {
  digestReleaseDocument,
  releaseEvidenceFileSchema,
  releaseQualificationSchema,
  verifyQualificationDocuments,
  type ReleaseQualification
} from './qualification.js'
import {
  verifyFirstInstallUiEvidence,
  verifyUpdateUiEvidence
} from './ui-evidence.js'

export type QualificationCase = {
  id: string
  baseline: UpdateArtifact
  intermediate: UpdateArtifact[]
  profileFixture?: UpdateArtifact
  report: Uint8Array
}

/** Artifacts and workflow identity must already be authenticated by the transport/CI boundary. */
export function assembleQualification(input: {
  request: Uint8Array
  manifest: Uint8Array
  target: UpdateArtifact
  workflow: ReleaseQualification['workflow']
  completedAt: string
  firstInstallation: Uint8Array
  recoveryComparisonId: string
  cases: QualificationCase[]
}) {
  const document = (bytes: Uint8Array, limit: number): unknown => {
    assert(
      bytes.byteLength > 0 && bytes.byteLength <= limit,
      'Qualification document exceeds bounds'
    )
    return JSON.parse(Buffer.from(bytes).toString('utf8')) as unknown
  }
  const request = releaseRequestSchema.parse(
    document(input.request, 4 * 1024 * 1024)
  )
  const target = assertRequestedTarget(
    request,
    document(input.manifest, 4 * 1024 * 1024)
  )
  assert.equal(input.target.kind, 'release')
  assert.deepEqual(input.target.manifest, target)
  assert(input.target.provenance.kind === 'release')
  assert.equal(
    input.target.provenance.manifestSha256,
    digestReleaseDocument(input.manifest),
    'Target manifest bytes differ'
  )
  assert.equal(
    input.workflow.commit,
    target.commit,
    'Qualification workflow differs from target commit'
  )
  assert.equal(
    input.cases.length,
    request.comparisons.length,
    'Missing or additional qualification cases'
  )
  const cases = new Map(input.cases.map((value) => [value.id, value]))
  assert.equal(
    cases.size,
    input.cases.length,
    'Duplicate qualification case IDs'
  )
  const recoveryRequest = request.comparisons.find(
    (value) => value.id === input.recoveryComparisonId
  )
  assert(
    recoveryRequest?.scenario === 'schema-migration',
    'Recovery must qualify an explicitly requested migration case'
  )
  const files = new Map<string, Buffer>()
  const evidence = (name: string, raw: Uint8Array) => {
    const bytes = Buffer.from(raw)
    const descriptor = releaseEvidenceFileSchema.parse({
      name,
      bytes: bytes.length,
      sha256: digestReleaseDocument(bytes)
    })
    assert(!files.has(name), 'Evidence filename collision')
    files.set(name, bytes)
    return descriptor
  }
  verifyFirstInstallUiEvidence(
    document(input.firstInstallation, 64 * 1024 * 1024),
    input.target
  )
  const firstInstallation = evidence(
    'first-installation.json',
    input.firstInstallation
  )
  const matchingArtifact = (
    actual: UpdateArtifact,
    expected: ComparisonArtifact
  ) => {
    assert.deepEqual(
      actual.manifest,
      expected.manifest,
      'Comparison artifact differs from request'
    )
    assert.equal(
      actual.kind,
      expected.source.kind === 'qualification-fixture'
        ? 'historical-fixture'
        : 'release',
      'Comparison origin kind differs from request'
    )
    if (actual.provenance.kind === 'release')
      assert.equal(actual.provenance.manifestSha256, expected.manifestSha256)
  }
  let recovery: ReleaseQualification['recovery'] | undefined
  const comparisons = request.comparisons.map((comparison) => {
    const value = cases.get(comparison.id)
    assert(value, 'Requested case is missing')
    matchingArtifact(value.baseline, comparison.baseline)
    assert.equal(
      value.intermediate.length,
      comparison.intermediate.length,
      'Missing or extra intermediate artifacts'
    )
    value.intermediate.forEach((artifact, index) =>
      matchingArtifact(artifact, comparison.intermediate[index]!)
    )
    if (comparison.profileFixture) {
      assert(value.profileFixture, 'Missing requested profile fixture')
      matchingArtifact(value.profileFixture, comparison.profileFixture)
    } else assert(!value.profileFixture, 'Unexpected profile fixture')
    const isRecovery = comparison.id === input.recoveryComparisonId
    const verified = verifyUpdateUiEvidence(
      document(value.report, 64 * 1024 * 1024),
      value.baseline,
      input.target,
      comparison,
      isRecovery,
      value.profileFixture
    )
    if (isRecovery) {
      assert(verified.recovery)
      // Retain the full original case under a dedicated filename; do not synthesize crash evidence.
      recovery = {
        comparisonId: comparison.id,
        evidence: evidence('recovery.json', value.report),
        ...verified.recovery
      }
    }
    return {
      id: comparison.id,
      baseline: comparison.baseline,
      runtime: verified.runtime,
      evidence: evidence(`comparison-${comparison.id}.json`, value.report),
      profile: verified.profile
    }
  })
  assert(recovery)
  const qualification = releaseQualificationSchema.parse({
    formatVersion: 2,
    requestSha256: digestReleaseDocument(input.request),
    target,
    targetManifestSha256: digestReleaseDocument(input.manifest),
    workflow: input.workflow,
    completedAt: input.completedAt,
    comparisons,
    firstInstallation,
    recovery
  })
  const bytes = Buffer.from(JSON.stringify(qualification, null, 2) + '\n')
  assert.deepEqual(
    verifyQualificationDocuments(input.request, input.manifest, bytes),
    qualification
  )
  files.set('release-request.json', Buffer.from(input.request))
  files.set('release-manifest.json', Buffer.from(input.manifest))
  files.set('update-qualification.json', bytes)
  return { qualification, files }
}
