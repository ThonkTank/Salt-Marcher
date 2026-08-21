import { describe, expect, it } from 'vitest'
import {
  appendHandoffInvocation,
  continueHandoffReceipt,
  createHandoffReceipt,
  handoffInvocationHistorySchema,
  handoffPhases,
  parseHandoffInvocationHistory,
  readRequiredJobManifest,
  requiredJobManifestSchema,
  sameHandoffApplicationIdentity,
  verifyRequiredJobs,
  type GithubWorkflowRun
} from '../../scripts/delivery-contract.js'

const sha = 'a'.repeat(40)

describe('delivery contract', () => {
  it('loads an ordered, unique required-job manifest', () => {
    const manifest = readRequiredJobManifest()
    expect(manifest.schemaVersion).toBe(3)
    expect(manifest.jobs).toHaveLength(13)
    expect(new Set(manifest.jobs.map(({ name }) => name)).size).toBe(13)
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
      requiredJobManifestVersion: 3
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

  it('retains every safe attempt without treating duplicates as a violation', () => {
    const empty = handoffInvocationHistorySchema.parse({
      formatVersion: 2,
      invocations: []
    })
    const first = appendHandoffInvocation(empty, invocation('1'))
    const second = appendHandoffInvocation(first, invocation('2'))
    expect(second.invocations).toHaveLength(2)
    expect(second.invocations.map(({ attemptId }) => attemptId)).toEqual([
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002'
    ])
  })

  it('migrates the legacy invocation audit without losing provenance', () => {
    const migrated = parseHandoffInvocationHistory({
      formatVersion: 1,
      invocations: [
        {
          invocationId: '00000000-0000-4000-8000-000000000001',
          applicationSha: sha,
          createdAt: '2026-08-18T12:00:00.000Z',
          receiptPath: 'legacy-receipt.json'
        }
      ]
    })
    expect(migrated).toMatchObject({
      formatVersion: 2,
      invocations: [
        {
          attemptId: '00000000-0000-4000-8000-000000000001',
          intent: 'advance',
          auditPath: 'legacy-receipt.json'
        }
      ]
    })
  })

  it('preserves original state provenance across later attempts', () => {
    const createdAt = '2026-08-18T12:00:00.000Z'
    const updatedAt = '2026-08-18T12:30:00.000Z'
    const origin = '00000000-0000-4000-8000-000000000001'
    const later = '00000000-0000-4000-8000-000000000002'
    const receipt = createHandoffReceipt(
      identity(),
      '00000000-0000-4000-8000-000000000010',
      origin,
      createdAt
    )

    expect(continueHandoffReceipt(receipt, later, updatedAt)).toMatchObject({
      stateId: receipt.stateId,
      originAttemptId: origin,
      activeAttemptId: later,
      status: 'running',
      createdAt,
      updatedAt,
      completedAt: null,
      phases: handoffPhases.map((phase) => ({ phase }))
    })
  })

  it('accepts a new successful CI attempt for the same application identity', () => {
    const existing = identity()
    const current = {
      ...identity(),
      candidate: {
        ...identity().candidate,
        runId: 456,
        url: 'https://github.example/actions/runs/456',
        attempt: 3
      }
    }
    expect(sameHandoffApplicationIdentity(existing, current)).toBe(true)
    expect(
      sameHandoffApplicationIdentity(existing, {
        ...current,
        deliveryInputFingerprint: '0'.repeat(64)
      })
    ).toBe(false)
    expect(
      sameHandoffApplicationIdentity(existing, {
        ...current,
        candidate: {
          ...current.candidate,
          jobs: current.candidate.jobs.slice(1)
        }
      })
    ).toBe(false)
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
  const attemptId = `00000000-0000-4000-8000-${suffix.padStart(12, '0')}`
  return {
    attemptId,
    applicationSha: sha,
    intent: 'advance' as const,
    createdAt: '2026-08-18T12:00:00.000Z',
    statePath: `.tmp/handoff-local-app/states/${sha}.json`,
    auditPath: `.tmp/handoff-local-app/attempts/${attemptId}.json`
  }
}

function identity() {
  return {
    commit: sha,
    dirty: false,
    workspaceFingerprint: 'b'.repeat(64),
    appBuildInputFingerprint: 'c'.repeat(64),
    qualificationInputFingerprint: 'd'.repeat(64),
    deliveryInputFingerprint: 'e'.repeat(64),
    toolchainHash: 'f'.repeat(64),
    candidate: verifyRequiredJobs(
      readRequiredJobManifest(),
      successfulRun(),
      sha
    )
  }
}
