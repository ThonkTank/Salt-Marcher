import { afterEach, expect, it } from 'vitest'
import { cleanupRuntimeFixtures } from '../fixtures/release-runtime.js'
import { qualificationInputFixture as fixture } from '../fixtures/release-qualification-input.js'
import { assembleQualification } from '../../scripts/release/assemble-qualification.js'
afterEach(cleanupRuntimeFixtures)

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
