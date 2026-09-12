import { expect, it } from 'vitest'
import {
  qualificationJobName,
  resolveQualificationOrigin
} from '../../scripts/release/qualification-origin.js'
import { releaseRepository } from '../../src/shared/contracts/release.js'
function fixture() {
  const expected = { runId: 123, attempt: 1, commit: 'a'.repeat(40) }
  const run = {
    id: 123,
    run_attempt: 1,
    head_sha: expected.commit,
    head_branch: 'main',
    path: '.github/workflows/release.yml',
    event: 'workflow_dispatch',
    status: 'in_progress',
    conclusion: null as string | null,
    repository: { full_name: releaseRepository },
    head_repository: { full_name: releaseRepository }
  }
  const jobs = [
    {
      id: 234,
      name: qualificationJobName,
      status: 'completed',
      conclusion: 'success'
    }
  ]
  const artifacts = [
    {
      id: 345,
      name: `release-${expected.commit}`,
      expired: false,
      size_in_bytes: 500,
      digest: `sha256:${'b'.repeat(64)}`,
      workflow_run: { id: 123, head_sha: expected.commit }
    }
  ]
  const api = (_method: string, endpoint: string) => {
    expect(endpoint.startsWith(`repos/${releaseRepository}/`)).toBe(true)
    if (endpoint.endsWith('/123')) return { status: 200, body: run }
    if (endpoint.endsWith('/attempts/1/jobs?per_page=100&page=1'))
      return { status: 200, body: { jobs } }
    if (endpoint.endsWith('/artifacts?per_page=100&page=1'))
      return { status: 200, body: { artifacts } }
    throw new Error(`Unexpected endpoint ${endpoint}`)
  }
  return { expected, run, jobs, artifacts, api }
}
it('allows a draft only after its exact qualification job uploaded the unique artifact', () => {
  const v = fixture()
  expect(
    resolveQualificationOrigin(v.expected, 'draft', v.api).artifact.id
  ).toBe(345)
  expect(() =>
    resolveQualificationOrigin(v.expected, 'publish', v.api)
  ).toThrow()
  v.run.status = 'completed'
  v.run.conclusion = 'success'
  expect(
    resolveQualificationOrigin(v.expected, 'publish', v.api).workflow
  ).toEqual(v.expected)
})
it.each([
  'rerun',
  'wrong-commit',
  'wrong-branch',
  'wrong-workflow',
  'failed-run',
  'failed-job',
  'duplicate-job',
  'missing-artifact',
  'duplicate-artifact',
  'expired-artifact',
  'missing-digest',
  'foreign-artifact'
] as const)('rejects %s origin', (field) => {
  const v = fixture()
  if (field === 'rerun') v.run.run_attempt++
  if (field === 'wrong-commit') v.run.head_sha = 'c'.repeat(40)
  if (field === 'wrong-branch') v.run.head_branch = 'candidate/example'
  if (field === 'wrong-workflow') v.run.path = '.github/workflows/check.yml'
  if (field === 'failed-run') {
    v.run.status = 'completed'
    v.run.conclusion = 'failure'
  }
  if (field === 'failed-job') v.jobs[0]!.conclusion = 'failure'
  if (field === 'duplicate-job') v.jobs.push(v.jobs[0]!)
  if (field === 'missing-artifact') v.artifacts.pop()
  if (field === 'duplicate-artifact') v.artifacts.push(v.artifacts[0]!)
  if (field === 'expired-artifact') v.artifacts[0]!.expired = true
  if (field === 'missing-digest') v.artifacts[0]!.digest = ''
  if (field === 'foreign-artifact') v.artifacts[0]!.workflow_run.id++
  expect(() => resolveQualificationOrigin(v.expected, 'draft', v.api)).toThrow()
})
