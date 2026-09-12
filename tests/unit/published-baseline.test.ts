import { afterEach, expect, it } from 'vitest'
import { publishedUiFixture } from '../fixtures/release-ui.js'
import { request as requestFixture } from '../fixtures/release-request.js'
import { cleanupRuntimeFixtures } from '../fixtures/release-runtime.js'
import { qualificationInputFixture } from '../fixtures/release-qualification-input.js'
import { releaseRequestSchema } from '../../scripts/release/request.js'
import { verifyUpdateUiEvidence } from '../../scripts/release/ui-evidence.js'
import { qualificationCasePlan } from '../../scripts/release/qualification-case-plan.js'
import { assembleQualification } from '../../scripts/release/assemble-qualification.js'
import { digestReleaseDocument } from '../../scripts/release/qualification.js'
afterEach(cleanupRuntimeFixtures)
it('accepts an unchanged release baseline that reads an explicit complete historical fixture', () => {
  const v = publishedUiFixture()
  expect(
    verifyUpdateUiEvidence(
      v.report,
      v.baseline,
      v.target,
      v.comparison,
      false,
      v.profileFixture
    ).profile.sourceUnchanged
  ).toBe(true)
  const request = releaseRequestSchema.parse(requestFixture())
  request.target = {
    version: v.target.manifest.version,
    commit: v.target.manifest.commit,
    schemaVersions: v.target.manifest.schemaVersions
  }
  // Other historical sources must remain distinct from the new target source.
  request.comparisons = [v.comparison, ...request.comparisons.slice(1)]
  expect(() => releaseRequestSchema.parse(request)).not.toThrow()
  expect(
    qualificationCasePlan(request, 'migration')[0]!.comparison.profileFixture
  ).toEqual(v.comparison.profileFixture)
})
it('retains fixture provenance inside the exact original report and immutable request', () => {
  const input = qualificationInputFixture(),
    v = publishedUiFixture()
  const request = releaseRequestSchema.parse(
    JSON.parse(input.request.toString('utf8'))
  )
  request.comparisons[0] = { ...v.comparison, id: 'same' }
  input.request = Buffer.from(JSON.stringify(request))
  const result = assembleQualification({
    ...input,
    cases: [
      {
        id: 'same',
        baseline: v.baseline,
        profileFixture: v.profileFixture,
        intermediate: [],
        report: Buffer.from(JSON.stringify(v.report))
      },
      ...input.cases.slice(1)
    ]
  })
  expect(result.qualification.comparisons[0]!.baseline.source.kind).toBe(
    'published-release'
  )
  expect(result.files.get('release-request.json')!.equals(input.request)).toBe(
    true
  )
})
it.each([
  'missing-fixture',
  'wrong-fixture',
  'missing-preparation',
  'wrong-identity',
  'lost-content',
  'lost-history',
  'changed-source',
  'early-hook'
] as const)('rejects %s public baseline evidence', (field) => {
  const v = publishedUiFixture()
  if (field === 'missing-fixture') {
    expect(() =>
      verifyUpdateUiEvidence(v.report, v.baseline, v.target, v.comparison)
    ).toThrow()
    return
  }
  if (field === 'wrong-fixture') {
    expect(() =>
      verifyUpdateUiEvidence(
        v.report,
        v.baseline,
        v.target,
        v.comparison,
        false,
        v.baseline
      )
    ).toThrow()
    return
  }
  if (field === 'missing-preparation') {
    const report = { ...v.report, profilePreparation: undefined }
    expect(() =>
      verifyUpdateUiEvidence(
        report,
        v.baseline,
        v.target,
        v.comparison,
        false,
        v.profileFixture
      )
    ).toThrow()
    return
  }
  if (field === 'wrong-identity')
    v.report.profilePreparation.baselineIdentity.sourceCommit = 'f'.repeat(40)
  if (field === 'lost-content') {
    v.report.seeded.result.response.result = { lost: true }
    v.report.seeded.resultSha256 = digestReleaseDocument(
      Buffer.from(JSON.stringify(v.report.seeded.result))
    )
  }
  if (field === 'lost-history')
    v.report.profilePreparation.history = {
      ...v.report.profilePreparation.history,
      campaigns: []
    }
  if (field === 'changed-source') {
    v.report.profilePreparation.unchanged.result.response.result = {
      lost: true
    }
    v.report.profilePreparation.unchanged.resultSha256 = digestReleaseDocument(
      Buffer.from(JSON.stringify(v.report.profilePreparation.unchanged.result))
    )
  }
  expect(() =>
    verifyUpdateUiEvidence(
      v.report,
      v.baseline,
      v.target,
      v.comparison,
      field === 'early-hook',
      v.profileFixture
    )
  ).toThrow()
})
it.each([
  'missing',
  'formats',
  'published-fixture',
  'same-bytes',
  'target-source',
  'historical-extra'
] as const)('rejects %s fixture request', (field) => {
  const request = releaseRequestSchema.parse(requestFixture()),
    v = publishedUiFixture()
  request.comparisons[0] = { ...v.comparison, id: 'same' }
  const comparison = request.comparisons[0]
  if (field === 'missing') delete comparison.profileFixture
  if (field === 'formats')
    comparison.profileFixture!.manifest.schemaVersions.campaign++
  if (field === 'published-fixture')
    comparison.profileFixture!.source = {
      kind: 'published-release',
      tag: `v${comparison.profileFixture!.manifest.version}`
    }
  if (field === 'same-bytes')
    comparison.profileFixture!.manifest.artifact.sha256 =
      comparison.baseline.manifest.artifact.sha256
  if (field === 'target-source')
    comparison.profileFixture!.manifest.commit = request.target.commit
  if (field === 'historical-extra')
    comparison.baseline.source = comparison.profileFixture!.source
  expect(() => releaseRequestSchema.parse(request)).toThrow()
})
