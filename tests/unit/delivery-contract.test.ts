import { describe, expect, it } from 'vitest'
import {
  appendHandoffInvocation,
  freshInvocationCount,
  handoffInvocationHistorySchema,
  handoffReceiptSchema,
  handoffSteps,
  readRequiredJobManifest,
  requiredJobManifestSchema,
  resumeHandoffReceipt,
  verifyRequiredJobs,
  type GithubWorkflowRun
} from '../../scripts/delivery-contract.js'

const sha = 'a'.repeat(40)

describe('delivery contract', () => {
  it('loads an ordered, unique required-job manifest', () => {
    const manifest = readRequiredJobManifest()
    expect(manifest.schemaVersion).toBe(1)
    expect(manifest.jobs).toHaveLength(12)
    expect(new Set(manifest.jobs.map(({ name }) => name)).size).toBe(12)
    expect(() =>
      requiredJobManifestSchema.parse({
        ...manifest,
        jobs: [manifest.jobs[0], manifest.jobs[0]]
      })
    ).toThrow('Duplicate required job name')
  })

  it('freezes every required successful job into workflow evidence', () => {
    const manifest = readRequiredJobManifest()
    const evidence = verifyRequiredJobs(manifest, successfulRun(), sha)
    expect(evidence).toMatchObject({
      runId: 123,
      attempt: 2,
      headSha: sha,
      requiredJobManifestVersion: 1
    })
    expect(evidence.jobs.map(({ name }) => name)).toEqual(
      manifest.jobs.map(({ name }) => name)
    )
  })

  it.each([
    [
      'missing',
      (run: GithubWorkflowRun) => ({ ...run, jobs: run.jobs.slice(1) })
    ],
    [
      'skipped',
      (run: GithubWorkflowRun) => ({
        ...run,
        jobs: run.jobs.map((job, index) =>
          index === 0
            ? { ...job, status: 'completed', conclusion: 'skipped' }
            : job
        )
      })
    ],
    [
      'duplicated',
      (run: GithubWorkflowRun) => ({
        ...run,
        jobs: [...run.jobs, run.jobs[0]!]
      })
    ],
    [
      'foreign SHA',
      (run: GithubWorkflowRun) => ({ ...run, headSha: 'b'.repeat(40) })
    ]
  ] as const)('rejects a %s required-job proof', (_name, mutate) => {
    expect(() =>
      verifyRequiredJobs(
        readRequiredJobManifest(),
        mutate(successfulRun()),
        sha
      )
    ).toThrow()
  })

  it('retains every fresh invocation and makes exactly-once machine-checkable', () => {
    const empty = handoffInvocationHistorySchema.parse({
      formatVersion: 1,
      invocations: []
    })
    const first = appendHandoffInvocation(empty, invocation('1'))
    const second = appendHandoffInvocation(first, invocation('2'))
    expect(freshInvocationCount(first, sha)).toBe(1)
    expect(freshInvocationCount(second, sha)).toBe(2)
    expect(second.invocations.map(({ invocationId }) => invocationId)).toEqual([
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002'
    ])
  })

  it('preserves fresh invocation provenance across resume attempts', () => {
    const createdAt = '2026-08-18T12:00:00.000Z'
    const updatedAt = '2026-08-18T12:30:00.000Z'
    const receipt = handoffReceiptSchema.parse({
      formatVersion: 3,
      invocationId: '00000000-0000-4000-8000-000000000001',
      status: 'failed',
      mode: 'fresh',
      createdAt,
      updatedAt: createdAt,
      completedAt: null,
      identity: {
        commit: sha,
        dirty: false,
        workspaceFingerprint: 'b'.repeat(64),
        appBuildInputFingerprint: 'c'.repeat(64),
        toolchainHash: 'd'.repeat(64),
        candidate: verifyRequiredJobs(
          readRequiredJobManifest(),
          successfulRun(),
          sha
        )
      },
      steps: handoffSteps.map((step) => ({
        step,
        status: 'pending',
        startedAt: null,
        durationMs: null,
        evidence: null,
        error: null
      }))
    })

    expect(resumeHandoffReceipt(receipt, updatedAt)).toMatchObject({
      invocationId: receipt.invocationId,
      status: 'running',
      mode: 'fresh',
      createdAt,
      updatedAt,
      completedAt: null
    })
  })
})

function successfulRun(): GithubWorkflowRun {
  const manifest = readRequiredJobManifest()
  return {
    databaseId: 123,
    headSha: sha,
    status: 'completed',
    conclusion: 'success',
    url: 'https://github.example/actions/runs/123',
    attempt: 2,
    jobs: manifest.jobs.map(({ name }) => ({
      name,
      status: 'completed',
      conclusion: 'success',
      url: 'https://github.example/actions/jobs/1'
    }))
  }
}

function invocation(suffix: string) {
  const invocationId = `00000000-0000-4000-8000-${suffix.padStart(12, '0')}`
  return {
    invocationId,
    applicationSha: sha,
    createdAt: '2026-08-18T12:00:00.000Z',
    receiptPath: `.tmp/handoff-local-app/invocations/${invocationId}.json`
  }
}
