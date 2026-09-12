import { randomUUID } from 'node:crypto'
import {
  runtimeFixture,
  type RuntimeFixtureOptions
} from './release-runtime.js'
import { profileProofFixture } from './release-profile-proof.js'
import { digestReleaseDocument } from '../../scripts/release/qualification.js'

export function uiFixture(options: RuntimeFixtureOptions = {}) {
  const baseline = runtimeFixture('historical-fixture', options),
    target = runtimeFixture('release'),
    data = profileProofFixture()
  const migrating = (options.campaign ?? 43) < 43
  const sourceProfile = migrating ? data.source : data.migrated
  const sourceHistory = migrating ? data.history.source : data.history.migrated
  const restoredHistory = migrating
    ? data.history.restored
    : data.history.migrated
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
    seeded: runtime(baseline, 'seed', sourceProfile),
    unchanged: runtime(baseline, 'read', sourceProfile),
    after: runtime(target, 'read', data.migrated),
    continued: runtime(target, 'read', data.continued),
    restored: runtime(target, 'read', data.restored),
    protectedRead: runtime(target, 'read', data.protection),
    partyHistoryEvidence: {
      source: sourceHistory,
      unchanged: sourceHistory,
      after: data.history.migrated,
      continued: data.history.continued,
      restored: restoredHistory,
      protected: data.history.protection
    },
    protectedBackup: saved(restoredTransaction.backup),
    restoredProtection: {
      journal: protectionJournal,
      readback: runtime(target, 'read', data.protectedRestore),
      history: data.history.protectedRestore,
      safety: saved(protectionJournal.backup),
      safetyHistory: restoredHistory,
      safetyReadback: runtime(target, 'read', data.secondProtection)
    },
    activationCrash: null,
    acceptedCrash: null,
    maintenanceCrash: null,
    commitCrash: null
  }
  const comparison = {
    id: 'test',
    scenario: migrating
      ? ('schema-migration' as const)
      : ('same-schema' as const),
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
export function recoveryUiFixture(options: RuntimeFixtureOptions = {}) {
  const v = uiFixture(options)
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
