import { describe, expect, it } from 'vitest'
import type { FinalEvidence } from '../../scripts/delivery-contract.js'
import {
  expectedFollowupRequirementIds,
  followupLedgerSchema,
  readFollowupLedger,
  summarizeLedger
} from '../../scripts/quality-reset-ledger.js'
import {
  renderFinalReport,
  renderLiveStatus
} from '../../scripts/quality-reset-documents.js'

const hash = 'a'.repeat(64)
const sha = 'b'.repeat(40)
const ledger = followupLedgerSchema.parse({
  schemaVersion: 1,
  source: 'salt-marcher-nacharbeit-handoff',
  requirements: expectedFollowupRequirementIds.map((id) => ({
    id,
    status: 'verified',
    evidence: ['pnpm check'],
    decision: null
  }))
})

describe('quality-reset generated documents', () => {
  it('requires the exact handoff requirement identity set', () => {
    const checkedIn = readFollowupLedger()
    expect(checkedIn.requirements.map(({ id }) => id)).toEqual(
      expectedFollowupRequirementIds
    )
    expect(summarizeLedger(checkedIn.requirements).open).toBe(0)
    expect(ledger.requirements).toHaveLength(64)
    expect(() =>
      followupLedgerSchema.parse({
        ...ledger,
        requirements: ledger.requirements.slice(1)
      })
    ).toThrow('Requirement identity drift')
    expect(() =>
      followupLedgerSchema.parse({
        ...ledger,
        requirements: [ledger.requirements[0], ...ledger.requirements]
      })
    ).toThrow('Duplicate requirement ids')
  })

  it('rejects unsupported closure claims and summarizes every state', () => {
    expect(() =>
      followupLedgerSchema.parse({
        ...ledger,
        requirements: ledger.requirements.map((entry, index) =>
          index === 0 ? { ...entry, evidence: [] } : entry
        )
      })
    ).toThrow('concrete evidence')
    expect(summarizeLedger(ledger.requirements)).toEqual({
      total: 64,
      verified: 64,
      notApplicable: 0,
      open: 0,
      inProgress: 0,
      blocked: 0
    })
  })

  it('renders live status and every mandatory final-report section', () => {
    const live = renderLiveStatus(evidence(), ledger)
    const report = renderFinalReport(evidence(), ledger)
    expect(live).toContain(`Application-SHA: \`${sha}\``)
    expect(live).toContain('64/64 verified')
    for (let section = 1; section <= 12; section += 1)
      expect(report).toContain(`## ${section}.`)
    expect(report).toContain('| DEL | 10 | 10 | 0 | 0 |')
    expect(report).toContain('No required platform')
  })
})

function evidence(): FinalEvidence {
  const workflow = {
    runId: 1,
    url: 'https://example.test/runs/1',
    attempt: 1,
    headSha: sha,
    requiredJobManifestVersion: 1,
    jobs: [
      {
        name: 'Required',
        platformRole: 'portable',
        conclusion: 'success' as const
      }
    ]
  }
  return {
    schemaVersion: 1,
    status: 'complete',
    application: {
      sha,
      workspaceFingerprint: hash,
      appBuildInputFingerprint: hash,
      dirty: false,
      toolchain: {
        node: 'v24',
        pnpm: '10',
        electron: '43',
        electronVite: '5',
        electronBuilder: '26',
        platform: 'linux',
        arch: 'x64'
      },
      versions: {
        installationSchema: 35,
        campaignSchema: 34,
        migrationRegistry: 1,
        encounterEngine: 1,
        rewardEngine: 1,
        config: 1,
        catalogVersion: 1,
        catalogHash: hash
      }
    },
    candidate: workflow,
    handoff: {
      invocationId: '00000000-0000-4000-8000-000000000001',
      mode: 'fresh',
      freshInvocationCountForApplicationSha: 1,
      exactlyOnce: true,
      startedAt: '2026-08-18T12:00:00.000Z',
      completedAt: '2026-08-18T13:00:00.000Z',
      steps: [
        'check',
        'package',
        'packaged-smoke',
        'backup-and-install',
        'installed-runtime-verification'
      ].map((name) => ({
        name: name as FinalEvidence['handoff']['steps'][number]['name'],
        status: 'completed' as const,
        startedAt: '2026-08-18T12:00:00.000Z',
        durationMs: 1,
        outputHash: hash
      }))
    },
    artifact: {
      path: 'release/local/SaltMarcher.AppImage',
      sha256: hash,
      manifestSha256: hash,
      outputHash: hash
    },
    installation: {
      artifactSha256: hash,
      manifestSha256: hash,
      utilityReady: true,
      generation: 1,
      bootstrap: { totalMs: 10, phases: { configuration: 1 } },
      backup: {
        path: 'backup',
        manifestSha256: hash,
        fileCount: 1,
        databaseCount: 1
      },
      quickChecks: [
        { path: 'installation.sqlite', role: 'installation', result: 'ok' }
      ],
      domainReadbacks: [
        { name: 'ready campaign', expected: true, actual: true, passed: true }
      ]
    },
    main: workflow,
    ledger: {
      path: 'followup-requirements-ledger.json',
      sha256: hash,
      total: 64,
      verified: 64,
      notApplicable: 0,
      open: 0,
      inProgress: 0,
      blocked: 0
    },
    reproduction: { commands: ['pnpm check:delivery'] }
  }
}
