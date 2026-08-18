import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach } from 'vitest'
import {
  assertCompletedHandoffReceipt,
  assertCandidateState,
  parseRemoteHead,
  successfulCandidateEvidence,
  type CandidateState
} from '../../scripts/candidate-delivery.js'
import { readRequiredJobManifest } from '../../scripts/delivery-contract.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

const valid: CandidateState = {
  branch: 'quality-reset/candidate',
  upstream: 'origin/quality-reset/candidate',
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
    requiredJobManifestVersion: 1,
    jobs: readRequiredJobManifest().jobs.map((job) => ({
      ...job,
      conclusion: 'success' as const
    }))
  }
}

describe('candidate delivery policy', () => {
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
    expect(successfulCandidateEvidence([run], 'c'.repeat(40))).toBeNull()
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

  it('uses the shared strict receipt and append-only history for promotion', () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-marcher-delivery-'))
    roots.push(root)
    const directory = join(root, '.tmp', 'handoff-local-app')
    mkdirSync(directory, { recursive: true })
    const invocationId = '00000000-0000-4000-8000-000000000001'
    const timestamp = '2026-08-18T12:00:00.000Z'
    const hash = 'c'.repeat(64)
    const receipt = {
      formatVersion: 3,
      invocationId,
      status: 'complete',
      mode: 'fresh',
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: timestamp,
      identity: {
        commit: valid.head,
        dirty: false,
        workspaceFingerprint: hash,
        appBuildInputFingerprint: hash,
        toolchainHash: hash,
        candidate: valid.candidate
      },
      steps: [
        'check',
        'package',
        'packaged-smoke',
        'backup-and-install',
        'installed-runtime-verification'
      ].map((step) => ({
        step,
        status: 'completed',
        startedAt: timestamp,
        durationMs: 1,
        evidence: {
          workspaceFingerprint: hash,
          appBuildInputFingerprint: hash,
          toolchainHash: hash,
          outputHash: hash,
          artifactSha256: hash,
          installedSha256: hash
        },
        error: null
      }))
    }
    writeFileSync(
      join(directory, 'handoff-receipt.json'),
      JSON.stringify(receipt)
    )
    writeFileSync(
      join(directory, 'invocations.json'),
      JSON.stringify({
        formatVersion: 1,
        invocations: [
          {
            invocationId,
            applicationSha: valid.head,
            createdAt: timestamp,
            receiptPath: 'receipt.json'
          }
        ]
      })
    )

    expect(() =>
      assertCompletedHandoffReceipt(valid.head, valid.candidate!, root)
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
