import { afterEach, expect, it } from 'vitest'
import { cleanupRuntimeFixtures } from '../fixtures/release-runtime.js'
import { uiFixture, recoveryUiFixture } from '../fixtures/release-ui.js'
import { assembleQualification } from '../../scripts/release/assemble-qualification.js'
import { releaseRequestSchema } from '../../scripts/release/request.js'
afterEach(cleanupRuntimeFixtures)
const bytes = (value: unknown) => Buffer.from(JSON.stringify(value))
function fixture() {
  const same = uiFixture({ version: '0.0.170', commit: 'b' })
  const migration = recoveryUiFixture({
    version: '0.0.167',
    commit: 'c',
    installation: 42,
    campaign: 42
  })
  const skip = uiFixture({
    version: '0.0.160',
    commit: 'd',
    installation: 42,
    campaign: 41
  })
  const target = same.target
  const request = releaseRequestSchema.parse({
    formatVersion: 1,
    repository: target.manifest.repository,
    target: {
      version: target.manifest.version,
      commit: target.manifest.commit,
      schemaVersions: target.manifest.schemaVersions
    },
    comparisons: [
      { ...same.comparison, id: 'same' },
      { ...migration.comparison, id: 'migration' },
      {
        ...skip.comparison,
        id: 'skip',
        scenario: 'skipped-releases',
        intermediate: [migration.comparison.baseline]
      }
    ]
  })
  return {
    request: bytes(request),
    manifest: bytes(target.manifest),
    target,
    workflow: { runId: 123, attempt: 1, commit: target.manifest.commit },
    completedAt: '2026-09-12T12:00:00Z',
    firstInstallation: bytes(same.installation),
    recoveryComparisonId: 'migration',
    cases: [
      {
        id: 'same',
        baseline: same.baseline,
        intermediate: [],
        report: bytes(same.report)
      },
      {
        id: 'migration',
        baseline: migration.baseline,
        intermediate: [],
        report: bytes(migration.report)
      },
      {
        id: 'skip',
        baseline: skip.baseline,
        intermediate: [migration.baseline],
        report: bytes(skip.report)
      }
    ]
  }
}
it('recomputes the v2 qualification and retains exact original report and control bytes', () => {
  const v = fixture(),
    result = assembleQualification(v)
  expect(result.qualification.comparisons).toHaveLength(3)
  expect(result.qualification.recovery.comparisonId).toBe('migration')
  expect(result.files.get('release-request.json')).toEqual(v.request)
  expect(result.files.get('release-manifest.json')).toEqual(v.manifest)
  expect(result.files.get('comparison-migration.json')).toEqual(
    v.cases[1]!.report
  )
  expect(result.files.get('recovery.json')).toEqual(v.cases[1]!.report)
  expect(result.files.get('first-installation.json')).toEqual(
    v.firstInstallation
  )
  expect(result.files.size).toBe(8)
})
it.each([
  'missing',
  'extra',
  'duplicate',
  'swapped-report',
  'intermediate',
  'target-manifest',
  'workflow',
  'recovery-case',
  'truncated-report'
] as const)('rejects %s qualification input', (field) => {
  const v = fixture()
  if (field === 'missing') v.cases.pop()
  if (field === 'extra') v.cases.push(v.cases[0]!)
  if (field === 'duplicate') v.cases[1]!.id = v.cases[0]!.id
  if (field === 'swapped-report') v.cases[0]!.report = v.cases[1]!.report
  if (field === 'intermediate')
    v.cases[2]!.intermediate = [v.cases[0]!.baseline]
  if (field === 'target-manifest')
    v.manifest = Buffer.from(JSON.stringify(v.target.manifest, null, 2))
  if (field === 'workflow') v.workflow.commit = 'f'.repeat(40)
  if (field === 'recovery-case') v.recoveryComparisonId = 'same'
  if (field === 'truncated-report') v.cases[0]!.report = Buffer.from('{')
  expect(() => assembleQualification(v)).toThrow()
})
