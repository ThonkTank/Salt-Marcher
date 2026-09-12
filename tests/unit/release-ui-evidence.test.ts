import { randomUUID } from 'node:crypto'
import { afterEach, expect, it } from 'vitest'
import { cleanupRuntimeFixtures } from '../fixtures/release-runtime.js'
import {
  uiFixture as fixture,
  recoveryUiFixture as recoveryFixture
} from '../fixtures/release-ui.js'
import {
  verifyFirstInstallUiEvidence,
  verifyUpdateUiEvidence
} from '../../scripts/release/ui-evidence.js'
afterEach(cleanupRuntimeFixtures)

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
