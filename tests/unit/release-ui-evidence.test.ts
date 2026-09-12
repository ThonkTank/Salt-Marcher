import { randomUUID } from 'node:crypto'
import { afterEach, expect, it } from 'vitest'
import {
  runtimeFixture,
  cleanupRuntimeFixtures
} from '../fixtures/release-runtime.js'
import { profileProofFixture } from '../fixtures/release-profile-proof.js'
import { digestReleaseDocument } from '../../scripts/release/qualification.js'
import {
  verifyFirstInstallUiEvidence,
  verifyUpdateUiEvidence
} from '../../scripts/release/ui-evidence.js'
afterEach(cleanupRuntimeFixtures)

function recoveryFixture() {
  const v = fixture()
  const interrupted = {
    ...v.report.transaction,
    id: randomUUID(),
    phase: 'data-moving'
  }
  return {
    ...v,
    report: {
      ...v.report,
      processExits: [
        { pid: 1, code: null, signal: 'SIGKILL' },
        { pid: 2, code: null, signal: 'SIGKILL' },
        { pid: 3, code: 0, signal: null }
      ],
      activationCrash: {
        boundary: {
          id: randomUUID(),
          point: 'new-data-moved',
          processRole: 'main',
          pid: 100,
          journal: interrupted
        },
        killedPids: [1, 100],
        recoveryCrash: null,
        recovered: {
          ...interrupted,
          formatVersion: 2,
          phase: 'rolled-back',
          rollbackFrom: 'data-moving'
        },
        readback: v.report.unchanged,
        failedReadback: null
      },
      acceptedCrash: { killedPids: [2], readback: v.report.continued }
    }
  }
}

it('requires a proven early rollback and preservation of later accepted work', () => {
  const v = recoveryFixture()
  const result = verifyUpdateUiEvidence(
    v.report,
    v.baseline,
    v.target,
    v.comparison,
    true
  )
  expect(result.recovery?.recoveredProfile).toBe(result.profile.before)
  expect(result.recovery?.acceptedWorkAfterCrash).toBe(
    result.profile.continuedActual
  )
})

it.each([
  'boundary-pid',
  'target-version',
  'recovery-journal',
  'later-readback',
  'kill-exit',
  'duplicate-pid'
] as const)('rejects disconnected recovery %s', (field) => {
  const v = recoveryFixture()
  if (field === 'boundary-pid') v.report.activationCrash.boundary.pid = 999
  if (field === 'target-version')
    v.report.activationCrash.boundary.journal.next = {
      ...v.report.transaction.next,
      version: '0.9.0'
    }
  if (field === 'recovery-journal')
    v.report.activationCrash.recovered.id = randomUUID()
  if (field === 'later-readback')
    v.report.acceptedCrash.readback = v.report.after
  if (field === 'kill-exit') v.report.processExits[0]!.code = 0
  if (field === 'duplicate-pid') v.report.processExits[1]!.pid = 1
  expect(() =>
    verifyUpdateUiEvidence(v.report, v.baseline, v.target, v.comparison, true)
  ).toThrow()
})

function fixture() {
  const baseline = runtimeFixture('historical-fixture'),
    target = runtimeFixture('release'),
    data = profileProofFixture()
  const runtime = (
    kind: typeof baseline,
    operation: string,
    result: unknown
  ) => {
    const id = randomUUID()
    const report = {
      ...kind.envelope.result,
      operation,
      response: { ok: true, requestId: id, result }
    }
    return {
      ...kind.envelope,
      requestId: id,
      operation,
      result: report,
      resultSha256: digestReleaseDocument(Buffer.from(JSON.stringify(report)))
    }
  }
  const program = {
    deployment: randomUUID(),
    version: target.target.manifest.version,
    sha256: target.target.manifest.artifact.sha256
  }
  const previous = {
    deployment: randomUUID(),
    version: baseline.target.manifest.version,
    sha256: baseline.target.manifest.artifact.sha256
  }
  const journal = (operation: string) => ({
    formatVersion: 3,
    id: randomUUID(),
    operation,
    phase: 'committed',
    rollbackFrom: null,
    hadData: true,
    backup: randomUUID(),
    integration: [],
    previous: program,
    next: program
  })
  const restoredTransaction = journal('restore'),
    protectionJournal = journal('restore')
  const saved = (id: string) => ({
    manifest: {
      formatVersion: 2,
      id,
      createdAt: '2026-09-12T10:00:00Z',
      version: program.version,
      restorable: true,
      files: [{ path: 'preferences.json', bytes: 2, sha256: 'a'.repeat(64) }],
      directories: []
    },
    manifestSha256: 'b'.repeat(64),
    data: '/isolated/backup'
  })
  const report = {
    formatVersion: 2,
    coverage:
      'ui-check-download-install-restart-continue-restore-protected-work',
    startPath: 'installed-launcher',
    baseline:
      baseline.target.provenance.kind === 'historical-fixture'
        ? baseline.target.provenance.receipt
        : null,
    baselineProvenance: baseline.target.provenance,
    target: target.target.manifest,
    targetProvenance: target.target.provenance,
    targetIdentity: target.envelope,
    requests: [
      '/repos/ThonkTank/Salt-Marcher/releases/latest',
      `/ThonkTank/Salt-Marcher/releases/download/v${program.version}/release-manifest.json`,
      `/ThonkTank/Salt-Marcher/releases/download/v${program.version}/${target.target.manifest.artifact.name}`
    ],
    transaction: { ...journal('update'), previous },
    restoredTransaction,
    processExits: [
      { pid: 1, code: 0 as number | null, signal: null as string | null },
      { pid: 2, code: 0 as number | null, signal: null as string | null }
    ],
    seeded: runtime(baseline, 'seed', data.migrated),
    unchanged: runtime(baseline, 'read', data.migrated),
    after: runtime(target, 'read', data.migrated),
    continued: runtime(target, 'read', data.continued),
    restored: runtime(target, 'read', data.restored),
    protectedRead: runtime(target, 'read', data.protection),
    partyHistoryEvidence: {
      source: data.history.migrated,
      unchanged: data.history.migrated,
      after: data.history.migrated,
      continued: data.history.continued,
      restored: data.history.migrated,
      protected: data.history.protection
    },
    protectedBackup: saved(restoredTransaction.backup),
    restoredProtection: {
      journal: protectionJournal,
      readback: runtime(target, 'read', data.protectedRestore),
      history: data.history.protectedRestore,
      safety: saved(protectionJournal.backup),
      safetyHistory: data.history.migrated,
      safetyReadback: runtime(target, 'read', data.secondProtection)
    },
    activationCrash: null,
    acceptedCrash: null,
    maintenanceCrash: null,
    commitCrash: null
  }
  const comparison = {
    id: 'test',
    scenario: 'same-schema' as const,
    baseline: {
      manifest: baseline.target.manifest,
      manifestSha256: 'a'.repeat(64),
      source: {
        kind: 'qualification-fixture' as const,
        workflowRunId: 1,
        workflowRunAttempt: 1,
        workflowCommit: 'c'.repeat(40),
        artifactId: 2,
        artifactName: 'explicit-test-fixture'
      }
    },
    intermediate: []
  }
  const installation = {
    formatVersion: 2,
    coverage:
      'empty-profile-first-install-and-installed-starter-restart-not-profile-import',
    target: target.target.manifest,
    targetProvenance: target.target.provenance,
    targetIdentity: target.envelope,
    transaction: { ...journal('install'), previous: null },
    installed: program,
    installedArtifact: {
      bytes: target.target.manifest.artifact.bytes,
      sha256: program.sha256
    },
    desktop:
      '[Desktop Entry]\nType=Application\nExec="/isolated/salt-marcher/start"\n',
    processExits: report.processExits
  }
  return {
    baseline: baseline.target,
    target: target.target,
    report,
    comparison,
    installation
  }
}
it('combines verified runtime, complete content, safety backups and committed program journals', () => {
  const v = fixture(),
    result = verifyUpdateUiEvidence(
      v.report,
      v.baseline,
      v.target,
      v.comparison
    )
  expect(result.profile.protectedRestore).toBe(result.profile.continuedActual)
  expect(result.recovery).toBeNull()
  expect(
    verifyFirstInstallUiEvidence(v.installation, v.target).program
  ).toEqual(v.installation.installed)
})
it.each([
  'target',
  'backup',
  'program',
  'phase',
  'transport',
  'exit',
  'missing-history'
] as const)('rejects disconnected update %s evidence', (field) => {
  const v = fixture()
  if (field === 'target')
    v.report.target = { ...v.report.target, commit: 'f'.repeat(40) }
  if (field === 'backup') v.report.restoredTransaction.backup = randomUUID()
  if (field === 'program')
    v.report.restoredProtection.journal.next = {
      ...v.report.transaction.next,
      deployment: randomUUID()
    }
  if (field === 'phase') v.report.transaction.phase = 'awaiting-start'
  if (field === 'transport') v.report.requests.pop()
  if (field === 'exit') v.report.processExits[0]!.signal = 'SIGKILL'
  if (field === 'missing-history')
    Reflect.deleteProperty(v.report.partyHistoryEvidence, 'unchanged')
  expect(() =>
    verifyUpdateUiEvidence(v.report, v.baseline, v.target, v.comparison)
  ).toThrow()
})
it('does not substitute a successful update for required recovery evidence', () => {
  const v = fixture()
  expect(() =>
    verifyUpdateUiEvidence(v.report, v.baseline, v.target, v.comparison, true)
  ).toThrow(/Both early/)
})
it.each(['bytes', 'desktop', 'phase', 'process'] as const)(
  'rejects incomplete first-install %s evidence',
  (field) => {
    const v = fixture()
    if (field === 'bytes') v.installation.installedArtifact.bytes++
    if (field === 'desktop')
      v.installation.desktop = 'Exec=/tmp/unrelated.AppImage'
    if (field === 'phase') v.installation.transaction.phase = 'awaiting-start'
    if (field === 'process') v.installation.processExits.pop()
    expect(() =>
      verifyFirstInstallUiEvidence(v.installation, v.target)
    ).toThrow()
  }
)
