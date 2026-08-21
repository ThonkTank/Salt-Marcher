import { describe, expect, it } from 'vitest'
import {
  e2eShardDurationMs,
  initializeE2eResults,
  recordE2eAttempt,
  validateE2eResumeIdentity,
  type E2eRunSummary,
  type E2eSuiteResult
} from '../../scripts/e2e-run-receipt.js'

describe('E2E run receipt resume', () => {
  it('retains the first failure diagnostics while reusing independent passes', () => {
    let results = initializeE2eResults(['passed-suite', 'flaky-suite'], null)
    results = recordE2eAttempt(results, 'passed-suite', {
      attempt: 1,
      status: 'passed',
      exitCode: 0,
      durationMs: 10,
      logPath: 'passed-suite.attempt-1.log',
      artifactDirectory: 'artifacts/passed-suite'
    })
    results = recordE2eAttempt(results, 'flaky-suite', {
      attempt: 1,
      status: 'failed',
      exitCode: 1,
      durationMs: 20,
      logPath: 'flaky-suite.attempt-1.log',
      artifactDirectory: 'artifacts/flaky-suite'
    })
    const failedSummary = summary(results)

    const resumed = initializeE2eResults(
      ['passed-suite', 'flaky-suite'],
      failedSummary
    )
    expect(resumed[0]?.status).toBe('passed')
    expect(resumed[0]?.attempts).toHaveLength(1)
    const completed = recordE2eAttempt(resumed, 'flaky-suite', {
      attempt: 2,
      status: 'passed',
      exitCode: 0,
      durationMs: 12,
      logPath: 'flaky-suite.attempt-2.log',
      artifactDirectory: 'artifacts/flaky-suite'
    })
    expect(completed[1]?.attempts.map((attempt) => attempt.logPath)).toEqual([
      'flaky-suite.attempt-1.log',
      'flaky-suite.attempt-2.log'
    ])
    expect(completed.every((result) => result.status === 'passed')).toBe(true)
    expect(e2eShardDurationMs(completed)).toBe(22)
  })

  it('rejects reuse after any build, registry, or suite-set change', () => {
    const value = summary(initializeE2eResults(['one'], null))
    expect(() =>
      validateE2eResumeIdentity(value, {
        buildIdentity: 'changed',
        registryIdentity: value.registryIdentity,
        selectedSuites: value.selectedSuites
      })
    ).toThrow('Cannot resume')
  })

  it('binds resume identity to the generated CI shard', () => {
    const value = {
      ...summary(initializeE2eResults(['one'], null)),
      ciShard: 'a'
    }
    expect(() =>
      validateE2eResumeIdentity(value, {
        buildIdentity: value.buildIdentity,
        registryIdentity: value.registryIdentity,
        selectedSuites: value.selectedSuites,
        ciShard: 'b'
      })
    ).toThrow('Cannot resume')
  })
})

function summary<Name extends string>(
  results: readonly E2eSuiteResult<Name>[]
): E2eRunSummary<Name> {
  return {
    version: 2,
    runId: 'run',
    buildIdentity: 'build',
    registryIdentity: 'registry',
    selectedSuites: results.map((result) => result.name),
    updatedAt: '2026-08-17T00:00:00.000Z',
    results
  }
}
