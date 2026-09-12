import assert from 'node:assert/strict'
import { z } from 'zod'
import {
  maintenanceJournalSchema,
  maintenanceProgramSchema
} from '../../src/shared/contracts/maintenance.js'
import { profileBackupSchema } from '../../src/shared/contracts/profile-backup.js'
import {
  releaseManifestSchema,
  releaseRepository
} from '../../src/shared/contracts/release.js'
import type { UpdateArtifact } from '../qualification/update-artifact.js'
import { verifyRuntimeEvidence } from './runtime-evidence.js'
import { profileDigest, verifyProfileProof } from './profile-proof.js'
import type { ReleaseRequest } from './request.js'

const digest = z.string().regex(/^[a-f0-9]{64}$/)
const exit = z
  .object({
    pid: z.number().int().positive().optional(),
    code: z.number().int().nullable(),
    signal: z.string().nullable()
  })
  .strict()
const backup = z
  .object({
    manifest: profileBackupSchema,
    manifestSha256: digest,
    data: z.string()
  })
  .strict()
const crash = z
  .object({
    boundary: z
      .object({
        id: z.uuid(),
        point: z.literal('new-data-moved'),
        processRole: z.literal('main'),
        pid: z.number().int().positive(),
        journal: maintenanceJournalSchema
      })
      .strict(),
    killedPids: z.array(z.number().int().positive()).min(1),
    recoveryCrash: z.null(),
    recovered: maintenanceJournalSchema,
    readback: z.unknown(),
    failedReadback: z.null()
  })
  .strict()
const updateReport = z
  .object({
    formatVersion: z.literal(2),
    coverage: z.literal(
      'ui-check-download-install-restart-continue-restore-protected-work'
    ),
    startPath: z.literal('installed-launcher'),
    baseline: z.unknown(),
    baselineProvenance: z.unknown(),
    target: releaseManifestSchema,
    targetProvenance: z.unknown(),
    targetIdentity: z.unknown(),
    requests: z.array(z.string()),
    transaction: maintenanceJournalSchema,
    restoredTransaction: maintenanceJournalSchema,
    processExits: z.array(exit).min(2),
    seeded: z.unknown(),
    unchanged: z.unknown(),
    after: z.unknown(),
    continued: z.unknown(),
    restored: z.unknown(),
    protectedRead: z.unknown(),
    partyHistoryEvidence: z
      .object({
        source: z.unknown(),
        unchanged: z.unknown(),
        after: z.unknown(),
        continued: z.unknown(),
        restored: z.unknown(),
        protected: z.unknown()
      })
      .strict(),
    protectedBackup: backup,
    restoredProtection: z
      .object({
        journal: maintenanceJournalSchema,
        readback: z.unknown(),
        history: z.unknown(),
        safety: backup,
        safetyHistory: z.unknown(),
        safetyReadback: z.unknown()
      })
      .strict(),
    activationCrash: crash.nullable(),
    acceptedCrash: z
      .object({
        killedPids: z.array(z.number().int().positive()).min(1),
        readback: z.unknown()
      })
      .strict()
      .nullable(),
    maintenanceCrash: z.null(),
    commitCrash: z.null()
  })
  .passthrough()

function targetBinding(
  report: { target: unknown; targetProvenance: unknown },
  target: UpdateArtifact
) {
  assert.equal(
    target.kind,
    'release',
    'Qualification target must be unchanged release bytes'
  )
  assert.deepEqual(report.target, target.manifest, 'Wrong qualification target')
  assert.deepEqual(
    report.targetProvenance,
    target.provenance,
    'Wrong qualification target provenance'
  )
}
function committed(
  journal: z.infer<typeof maintenanceJournalSchema>,
  operation: 'install' | 'update' | 'restore',
  target: UpdateArtifact
) {
  assert.equal(journal.operation, operation)
  assert.equal(
    journal.phase,
    'committed',
    'Normal use was not durably accepted'
  )
  assert.equal(journal.next.version, target.manifest.version)
  assert.equal(journal.next.sha256, target.manifest.artifact.sha256)
}

/** Semantic proof; CI origin, request files and artifact transport are checked by the caller. */
export function verifyUpdateUiEvidence(
  raw: unknown,
  baseline: UpdateArtifact,
  target: UpdateArtifact,
  comparison: ReleaseRequest['comparisons'][number],
  requireRecovery = false
) {
  const v = updateReport.parse(raw)
  targetBinding(v, target)
  assert.equal(
    baseline.kind,
    'historical-fixture',
    'Current seeded UI qualification needs an explicit historical fixture'
  )
  assert.deepEqual(
    baseline.manifest,
    comparison.baseline.manifest,
    'Wrong requested baseline'
  )
  assert.deepEqual(v.baselineProvenance, baseline.provenance)
  assert.deepEqual(
    v.baseline,
    baseline.provenance.kind === 'historical-fixture'
      ? baseline.provenance.receipt
      : baseline.manifest
  )
  const sameFormats =
    baseline.manifest.schemaVersions.installation ===
      target.manifest.schemaVersions.installation &&
    baseline.manifest.schemaVersions.campaign ===
      target.manifest.schemaVersions.campaign
  if (comparison.scenario === 'same-schema')
    assert(sameFormats, 'Same-schema case changed data formats')
  if (comparison.scenario === 'schema-migration')
    assert(!sameFormats, 'Migration case did not change data formats')
  if (comparison.scenario === 'skipped-releases')
    assert(
      comparison.intermediate.length > 0,
      'Skip case has no explicit intermediate'
    )
  const pids = v.processExits.map((e) =>
    z.number().int().positive().parse(e.pid)
  )
  assert.equal(new Set(pids).size, pids.length, 'Duplicate process evidence')
  verifyRuntimeEvidence(v.targetIdentity, target, 'identity')
  for (const path of [
    `/repos/${releaseRepository}/releases/latest`,
    `/${releaseRepository}/releases/download/v${target.manifest.version}/release-manifest.json`,
    `/${releaseRepository}/releases/download/v${target.manifest.version}/${target.manifest.artifact.name}`
  ])
    assert(v.requests.includes(path), 'Missing real check/download transport')
  committed(v.transaction, 'update', target)
  assert(v.transaction.backup && v.transaction.previous)
  assert.equal(v.transaction.previous.sha256, baseline.manifest.artifact.sha256)
  assert.equal(v.transaction.previous.version, baseline.manifest.version)
  committed(v.restoredTransaction, 'restore', target)
  committed(v.restoredProtection.journal, 'restore', target)
  assert.equal(
    new Set([
      v.transaction.id,
      v.restoredTransaction.id,
      v.restoredProtection.journal.id
    ]).size,
    3
  )
  for (const journal of [v.restoredTransaction, v.restoredProtection.journal]) {
    assert(journal.backup)
    assert.deepEqual(journal.previous, v.transaction.next)
    assert.deepEqual(
      journal.next,
      v.transaction.next,
      'Restore changed program'
    )
  }
  assert.equal(v.restoredTransaction.backup, v.protectedBackup.manifest.id)
  assert.equal(
    v.restoredProtection.journal.backup,
    v.restoredProtection.safety.manifest.id
  )
  assert.notEqual(
    v.protectedBackup.manifest.id,
    v.restoredProtection.safety.manifest.id
  )
  for (const saved of [v.protectedBackup, v.restoredProtection.safety]) {
    assert.equal(saved.manifest.formatVersion, 2)
    assert(saved.manifest.restorable && saved.manifest.files.length > 0)
    assert.equal(saved.manifest.version, target.manifest.version)
  }
  const read = (report: unknown) =>
    verifyRuntimeEvidence(report, target, 'read')
  const source = verifyRuntimeEvidence(v.seeded, baseline, 'seed')
  const continued = read(v.continued)
  const h = v.partyHistoryEvidence
  const profile = verifyProfileProof({
    source,
    unchanged: verifyRuntimeEvidence(v.unchanged, baseline, 'read'),
    migrated: read(v.after),
    continued,
    restored: read(v.restored),
    protection: read(v.protectedRead),
    protectedRestore: read(v.restoredProtection.readback),
    secondProtection: read(v.restoredProtection.safetyReadback),
    history: {
      source: h.source,
      unchanged: h.unchanged,
      migrated: h.after,
      continued: h.continued,
      restored: h.restored,
      protection: h.protected,
      protectedRestore: v.restoredProtection.history,
      secondProtection: v.restoredProtection.safetyHistory
    }
  })
  let recovery = null
  if (requireRecovery || v.activationCrash || v.acceptedCrash) {
    assert(
      v.activationCrash && v.acceptedCrash,
      'Both early rollback and later-work crash evidence are required'
    )
    const early = v.activationCrash
    assert(
      early.killedPids.includes(early.boundary.pid),
      'Boundary process was not killed'
    )
    assert.equal(early.boundary.journal.phase, 'data-moving')
    assert.equal(early.boundary.journal.operation, 'update')
    assert.equal(early.boundary.journal.next.version, target.manifest.version)
    assert.deepEqual(early.boundary.journal.previous, v.transaction.previous)
    assert.equal(
      early.boundary.journal.next.sha256,
      target.manifest.artifact.sha256
    )
    assert.deepEqual(early.recovered, {
      ...early.boundary.journal,
      formatVersion: early.recovered.formatVersion,
      phase: 'rolled-back',
      rollbackFrom: 'data-moving'
    })
    const recovered = verifyRuntimeEvidence(early.readback, baseline, 'read')
    assert.deepEqual(
      recovered,
      source,
      'Early recovery lost the previous profile'
    )
    assert.deepEqual(
      read(v.acceptedCrash.readback),
      continued,
      'Later crash rolled back accepted work'
    )
    const killed = v.processExits.filter((e) => e.signal === 'SIGKILL')
    assert.equal(killed.length, 2)
    assert(
      killed.every((e) => e.code === null),
      'Killed processes cannot claim normal exit codes'
    )
    for (const group of [early.killedPids, v.acceptedCrash.killedPids])
      assert.equal(
        killed.filter((e) => e.pid && group.includes(e.pid)).length,
        1
      )
    for (const e of v.processExits)
      assert(
        killed.includes(e) || (e.code === 0 && e.signal === null),
        'Unexpected process failure'
      )
    recovery = {
      previousProgram: baseline.manifest.artifact.sha256,
      recoveredProgram: early.recovered.previous!.sha256,
      previousProfile: profile.before,
      recoveredProfile: profileDigest({
        profile: recovered,
        history: h.source
      }),
      acceptedWorkAfterCrash: profile.continuedActual
    }
  } else
    for (const e of v.processExits)
      assert(e.code === 0 && e.signal === null, 'Unexpected process failure')
  return {
    profile,
    recovery,
    runtime: {
      version: target.manifest.version,
      commit: target.manifest.commit,
      schemaVersions: target.manifest.schemaVersions
    }
  }
}

export function verifyFirstInstallUiEvidence(
  raw: unknown,
  target: UpdateArtifact
) {
  const v = z
    .object({
      formatVersion: z.literal(2),
      coverage: z.literal(
        'empty-profile-first-install-and-installed-starter-restart-not-profile-import'
      ),
      target: releaseManifestSchema,
      targetProvenance: z.unknown(),
      targetIdentity: z.unknown(),
      transaction: maintenanceJournalSchema,
      installed: maintenanceProgramSchema,
      installedArtifact: z
        .object({ bytes: z.number().int().positive(), sha256: digest })
        .passthrough(),
      desktop: z.string(),
      processExits: z.array(exit).length(2)
    })
    .strict()
    .parse(raw)
  targetBinding(v, target)
  verifyRuntimeEvidence(v.targetIdentity, target, 'identity')
  committed(v.transaction, 'install', target)
  assert.equal(v.transaction.previous, null)
  assert.deepEqual(v.installed, v.transaction.next)
  assert.equal(v.installedArtifact.bytes, target.manifest.artifact.bytes)
  assert.equal(v.installedArtifact.sha256, target.manifest.artifact.sha256)
  assert(
    v.desktop
      .split('\n')
      .some((line) => /^Exec="\/[^"\r\n]+\/salt-marcher\/start"$/.test(line)),
    'Missing stable desktop startpoint'
  )
  assert(v.desktop.includes('\nType=Application\n'))
  for (const e of v.processExits) assert(e.code === 0 && e.signal === null)
  return {
    program: v.installed,
    runtime: {
      version: target.manifest.version,
      commit: target.manifest.commit,
      schemaVersions: target.manifest.schemaVersions
    }
  }
}
