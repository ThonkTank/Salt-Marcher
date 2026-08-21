import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach } from 'vitest'
import {
  assertCompletedHandoffReceipt,
  assertCandidateState,
  parseRemoteHead,
  postPromotionJobName,
  requiresApplicationHandoff,
  successfulCandidateEvidence,
  successfulPostPromotionEvidence,
  type CandidateState
} from '../../scripts/candidate-delivery.js'
import {
  createHandoffReceipt,
  handoffPhases,
  handoffReceiptSchema,
  hashHandoffValue,
  readRequiredJobManifest
} from '../../scripts/delivery-contract.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

const valid: CandidateState = {
  branch: 'candidate/delivery-test',
  upstream: 'origin/candidate/delivery-test',
  head: 'b'.repeat(40),
  upstreamHead: 'b'.repeat(40),
  remoteMain: 'a'.repeat(40),
  clean: true,
  mainIsAncestor: true,
  candidate: {
    runId: 1,
    url: 'https://github.example/check/1',
    attempt: 1,
    headSha: 'b'.repeat(40),
    requiredJobManifestVersion: 4,
    jobs: readRequiredJobManifest().jobs.map((job) => ({
      ...job,
      conclusion: 'success' as const
    }))
  }
}

describe('candidate delivery policy', () => {
  it('requires local application handoff only when app-build inputs changed', () => {
    expect(requiresApplicationHandoff('same', 'same')).toBe(false)
    expect(requiresApplicationHandoff('candidate', 'main')).toBe(true)
  })

  it('parses the live remote head without consulting local main', () => {
    expect(parseRemoteHead(`${'a'.repeat(40)}\trefs/heads/main\n`)).toBe(
      'a'.repeat(40)
    )
    expect(() => parseRemoteHead('')).toThrow(/resolve origin\/main/)
  })

  it('requires a successful Check for the exact candidate SHA', () => {
    const manifest = readRequiredJobManifest()
    const run = {
      databaseId: 1,
      headSha: valid.head,
      status: 'completed',
      conclusion: 'success',
      url: 'https://github.example/check/1',
      attempt: 1,
      jobs: manifest.jobs.map(({ name }) => ({
        name,
        status: 'completed',
        conclusion: 'success'
      }))
    }
    expect(successfulCandidateEvidence([run], valid.head)?.url).toBe(run.url)
    expect(
      successfulCandidateEvidence(
        [{ ...run, jobs: run.jobs.slice(1) }, run],
        valid.head
      )?.url
    ).toBe(run.url)
    expect(successfulCandidateEvidence([run], 'c'.repeat(40))).toBeNull()
  })

  it('accepts only the successful post-promotion attestation job', () => {
    const run = {
      databaseId: 2,
      headSha: valid.head,
      status: 'completed',
      conclusion: 'success',
      url: 'https://github.example/check/2',
      attempt: 1,
      jobs: [
        {
          name: postPromotionJobName,
          status: 'completed',
          conclusion: 'success'
        }
      ]
    }
    expect(successfulPostPromotionEvidence(run, valid.head)?.jobs).toEqual([
      {
        name: postPromotionJobName,
        platformRole: 'post-promotion-candidate-attestation',
        conclusion: 'success'
      }
    ])
    expect(
      successfulPostPromotionEvidence(
        { ...run, jobs: [{ ...run.jobs[0]!, conclusion: 'skipped' }] },
        valid.head
      )
    ).toBeNull()
  })

  it('rejects stale upstreams, dirty trees, direct main, and unproved SHAs', () => {
    expect(() => assertCandidateState(valid)).not.toThrow()
    for (const patch of [
      { branch: 'main', upstream: 'origin/main' },
      { upstream: 'origin/old-candidate' },
      { upstreamHead: 'c'.repeat(40) },
      { clean: false },
      { mainIsAncestor: false },
      { candidate: null }
    ])
      expect(() => assertCandidateState({ ...valid, ...patch })).toThrow()
  })

  it('uses the strict completed SHA state and permits multiple audited attempts', () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-marcher-delivery-'))
    roots.push(root)
    const directory = join(root, '.tmp', 'handoff-local-app')
    const attempts = join(directory, 'attempts')
    mkdirSync(attempts, { recursive: true })
    const originAttemptId = '00000000-0000-4000-8000-000000000001'
    const activeAttemptId = '00000000-0000-4000-8000-000000000002'
    const timestamp = '2026-08-18T12:00:00.000Z'
    const hash = 'c'.repeat(64)
    const initial = createHandoffReceipt(
      {
        commit: valid.head,
        dirty: false,
        workspaceFingerprint: hash,
        appBuildInputFingerprint: hash,
        qualificationInputFingerprint: hash,
        deliveryInputFingerprint: hash,
        toolchainHash: hash,
        candidate: valid.candidate!
      },
      '00000000-0000-4000-8000-000000000010',
      originAttemptId,
      timestamp
    )
    let predecessor = hashHandoffValue(initial.identity)
    const phases = handoffPhases.map((phase) => {
      const evidence = {
        workspaceFingerprint: hash,
        appBuildInputFingerprint: hash,
        qualificationInputFingerprint: hash,
        deliveryInputFingerprint: hash,
        toolchainHash: hash,
        candidateArtifactReceiptSha256: hash,
        artifactManifestSha256: hash,
        buildOutputHash: hash,
        artifactSha256: hash,
        sourceDataHash: hash,
        backupManifestSha256: hash,
        deploymentManifestSha256: hash,
        runtimeEvidenceSha256: hash,
        installedSha256: hash,
        storageRetention:
          phase === 'storage-retention-applied'
            ? {
                receiptSha256: hash,
                activeDeploymentFingerprint: hash,
                retainedDeploymentFingerprints: [hash],
                deletedDeploymentFingerprints: [],
                releasedBytes: 0,
                retainedInvocations: 2,
                removedInvocations: 0,
                removedAttemptFiles: [],
                reachableLegacyCount: 0,
                reachableNonCurrentCount: 0,
                unknownInvalidCount: 0
              }
            : null
      }
      const outputHash = hashHandoffValue({
        phase,
        inputHash: predecessor,
        evidence
      })
      const record = {
        phase,
        status: 'completed',
        startedAt: timestamp,
        durationMs: 1,
        inputHash: predecessor,
        outputHash,
        evidence,
        error: null
      }
      predecessor = outputHash
      return record
    })
    const receipt = handoffReceiptSchema.parse({
      ...initial,
      activeAttemptId,
      status: 'complete',
      updatedAt: timestamp,
      completedAt: timestamp,
      phases
    })
    writeFileSync(
      join(directory, 'handoff-receipt.json'),
      JSON.stringify(receipt)
    )
    writeFileSync(
      join(directory, 'invocations.json'),
      JSON.stringify({
        formatVersion: 2,
        invocations: [
          {
            attemptId: originAttemptId,
            applicationSha: valid.head,
            intent: 'advance',
            createdAt: timestamp,
            statePath: 'state.json',
            auditPath: join(attempts, `${originAttemptId}.json`)
          },
          {
            attemptId: activeAttemptId,
            applicationSha: valid.head,
            intent: 'resume',
            createdAt: timestamp,
            statePath: 'state.json',
            auditPath: join(attempts, `${activeAttemptId}.json`)
          }
        ]
      })
    )

    expect(() =>
      assertCompletedHandoffReceipt(valid.head, valid.candidate!, root)
    ).not.toThrow()
    expect(() =>
      assertCompletedHandoffReceipt(
        valid.head,
        {
          ...valid.candidate!,
          runId: 2,
          url: 'https://github.example/check/2',
          attempt: 2
        },
        root
      )
    ).not.toThrow()
    writeFileSync(
      join(directory, 'handoff-receipt.json'),
      JSON.stringify({ ...receipt, unexpected: true })
    )
    expect(() =>
      assertCompletedHandoffReceipt(valid.head, valid.candidate!, root)
    ).toThrow()
  })
})
