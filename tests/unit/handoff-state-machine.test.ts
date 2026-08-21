import { describe, expect, it } from 'vitest'
import {
  continueHandoffReceipt,
  createHandoffReceipt,
  handoffPhases,
  handoffReceiptSchema,
  type HandoffPhaseEvidence,
  type HandoffPhaseName,
  type HandoffReceipt
} from '../../scripts/delivery-contract.js'
import {
  HandoffCrashForTest,
  runHandoffStateMachine,
  type HandoffPhaseDefinition
} from '../../scripts/handoff-state-machine.js'

describe('SHA handoff state machine', () => {
  it.each(handoffPhases)(
    'resumes safely after the durable %s boundary',
    (crashPhase) => {
      const fixture = createFixture()
      let persisted = fixture.receipt
      expect(() =>
        runHandoffStateMachine({
          receipt: persisted,
          definitions: fixture.definitions,
          persist: (receipt) => {
            persisted = receipt
          },
          now: fixture.now,
          afterPhasePersistedForTest: (phase) => {
            if (phase === crashPhase)
              throw new HandoffCrashForTest(`crash after ${phase}`)
          }
        })
      ).toThrowError(HandoffCrashForTest)

      const resumed = runHandoffStateMachine({
        receipt: continueHandoffReceipt(
          persisted,
          '00000000-0000-4000-8000-000000000002',
          fixture.now().toISOString()
        ),
        definitions: fixture.definitions,
        persist: (receipt) => {
          persisted = receipt
        },
        now: fixture.now
      })

      expect(resumed.status).toBe('complete')
      expect(resumed.originAttemptId).toBe(
        '00000000-0000-4000-8000-000000000001'
      )
      expect(resumed.activeAttemptId).toBe(
        '00000000-0000-4000-8000-000000000002'
      )
      expect(fixture.executions.get(crashPhase)).toBe(1)
      expect(resumed.phases.every(({ status }) => status === 'completed')).toBe(
        true
      )
    }
  )

  it.each(handoffPhases)(
    'repeats only the idempotent %s operation after a pre-commit failure',
    (failedPhase) => {
      const fixture = createFixture(failedPhase)
      let persisted = fixture.receipt
      expect(() =>
        runHandoffStateMachine({
          receipt: persisted,
          definitions: fixture.definitions,
          persist: (receipt) => {
            persisted = receipt
          },
          now: fixture.now
        })
      ).toThrow(`failure during ${failedPhase}`)

      const completed = runHandoffStateMachine({
        receipt: continueHandoffReceipt(
          persisted,
          '00000000-0000-4000-8000-000000000002',
          fixture.now().toISOString()
        ),
        definitions: fixture.definitions,
        persist: (receipt) => {
          persisted = receipt
        },
        now: fixture.now
      })

      expect(completed.status).toBe('complete')
      expect(fixture.executions.get(failedPhase)).toBe(2)
      for (const phase of handoffPhases.slice(
        0,
        handoffPhases.indexOf(failedPhase)
      ))
        expect(fixture.executions.get(phase)).toBe(1)
    }
  )

  it('invalidates the changed phase and every dependent successor', () => {
    const fixture = createFixture()
    let persisted = fixture.receipt
    persisted = runHandoffStateMachine({
      receipt: persisted,
      definitions: fixture.definitions,
      persist: (receipt) => {
        persisted = receipt
      },
      now: fixture.now
    })
    const changed = 'packaged' satisfies HandoffPhaseName
    fixture.evidence.set(changed, phaseEvidence('f'))

    runHandoffStateMachine({
      receipt: continueHandoffReceipt(
        persisted,
        '00000000-0000-4000-8000-000000000002',
        fixture.now().toISOString()
      ),
      definitions: fixture.definitions,
      persist: (receipt) => {
        persisted = receipt
      },
      now: fixture.now
    })

    for (const phase of handoffPhases)
      expect(fixture.executions.get(phase)).toBe(
        handoffPhases.indexOf(phase) < handoffPhases.indexOf(changed) ? 1 : 2
      )
  })

  it('rejects a tampered completed phase hash chain', () => {
    const fixture = createFixture()
    let persisted = fixture.receipt
    persisted = runHandoffStateMachine({
      receipt: persisted,
      definitions: fixture.definitions,
      persist: (receipt) => {
        persisted = receipt
      },
      now: fixture.now
    })
    expect(() =>
      handoffReceiptSchema.parse({
        ...persisted,
        phases: persisted.phases.map((phase, index) =>
          index === 3 ? { ...phase, outputHash: '0'.repeat(64) } : phase
        )
      })
    ).toThrow(/invalid hash chain/)
  })
})

function createFixture(failOnce?: HandoffPhaseName): {
  readonly receipt: HandoffReceipt
  readonly definitions: readonly HandoffPhaseDefinition[]
  readonly executions: Map<HandoffPhaseName, number>
  readonly evidence: Map<HandoffPhaseName, HandoffPhaseEvidence>
  readonly now: () => Date
} {
  let tick = 0
  const now = (): Date => new Date(1_787_184_000_000 + tick++ * 10)
  const receipt = createHandoffReceipt(
    {
      commit: 'a'.repeat(40),
      dirty: false,
      workspaceFingerprint: 'b'.repeat(64),
      appBuildInputFingerprint: 'c'.repeat(64),
      qualificationInputFingerprint: 'd'.repeat(64),
      deliveryInputFingerprint: 'e'.repeat(64),
      toolchainHash: 'f'.repeat(64),
      candidate: {
        runId: 1,
        url: 'https://github.example/runs/1',
        attempt: 1,
        headSha: 'a'.repeat(40),
        requiredJobManifestVersion: 4,
        jobs: [
          {
            name: 'required',
            platformRole: 'test',
            conclusion: 'success'
          }
        ]
      }
    },
    '00000000-0000-4000-8000-000000000010',
    '00000000-0000-4000-8000-000000000001',
    now().toISOString()
  )
  const executions = new Map<HandoffPhaseName, number>()
  const evidence = new Map<HandoffPhaseName, HandoffPhaseEvidence>(
    handoffPhases.map((phase, index) => [
      phase,
      phaseEvidence(index.toString(16))
    ])
  )
  let failed = false
  const definitions = handoffPhases.map((phase) => ({
    phase,
    execute: () => {
      executions.set(phase, (executions.get(phase) ?? 0) + 1)
      if (phase === failOnce && !failed) {
        failed = true
        throw new Error(`failure during ${phase}`)
      }
    },
    collect: () => evidence.get(phase)!
  }))
  return { receipt, definitions, executions, evidence, now }
}

function phaseEvidence(character: string): HandoffPhaseEvidence {
  const hash = character.repeat(64)
  return {
    workspaceFingerprint: 'b'.repeat(64),
    appBuildInputFingerprint: 'c'.repeat(64),
    qualificationInputFingerprint: 'd'.repeat(64),
    deliveryInputFingerprint: 'e'.repeat(64),
    toolchainHash: 'f'.repeat(64),
    candidateArtifactReceiptSha256: hash,
    artifactManifestSha256: hash,
    buildOutputHash: hash,
    artifactSha256: hash,
    sourceDataHash: hash,
    backupManifestSha256: hash,
    deploymentManifestSha256: hash,
    runtimeEvidenceSha256: hash,
    installedSha256: hash
  }
}
