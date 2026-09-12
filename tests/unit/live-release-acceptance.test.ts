import { expect, it } from 'vitest'
import { bytes, digest, fixture } from '../fixtures/release-qualification.js'
import { digestReleaseDocument } from '../../scripts/release/qualification.js'
import { createLiveAcceptanceReceipt } from '../../scripts/release/live-acceptance.js'

function accepted() {
  const value = fixture()
  const input = {
    formatVersion: 1,
    version: value.manifest.version,
    commit: value.manifest.commit,
    appimageSha256: value.manifest.artifact.sha256,
    requestSha256: value.qualification.requestSha256,
    qualificationSha256: digestReleaseDocument(bytes(value.qualification)),
    testedAt: '2026-09-12T15:00:00Z',
    checks: {
      campaignOpened: true,
      changeSaved: true,
      updatePerformed: true,
      continuedWork: true,
      backupRestored: true
    },
    notes:
      'Opened a campaign, saved a change, updated, continued work and restored the verified complete backup.'
  }
  const context = {
    publishRunId: 200,
    publishRunAttempt: 1,
    environmentId: 123,
    observedAt: '2026-09-12T16:00:00Z',
    reviewHistory: [
      {
        state: 'approved',
        environments: [{ id: 123, name: 'release' }],
        user: { id: 129946818, login: 'ThonkTank', type: 'User' }
      }
    ]
  }
  return { ...value, input, context }
}
function record(value: ReturnType<typeof accepted>) {
  return createLiveAcceptanceReceipt(
    bytes(value.input),
    bytes(value.requested),
    bytes(value.manifest),
    bytes(value.qualification),
    value.context
  )
}

it('records exact tested bytes and the reviewer identity from GitHub, not user text', () => {
  const value = accepted()
  const receipt = record(value)
  expect(receipt.acceptance.appimageSha256).toBe(value.manifest.artifact.sha256)
  expect(receipt.approval.reviewer).toEqual({
    id: 129946818,
    login: 'ThonkTank'
  })
  expect(receipt.approval.publishRunId).toBe(200)
  expect(receipt.qualificationWorkflow).toEqual(value.qualification.workflow)
})

it.each(['appimageSha256', 'requestSha256', 'qualificationSha256'] as const)(
  'rejects changed %s',
  (field) => {
    const value = accepted()
    value.input[field] = digest('f')
    expect(() => record(value)).toThrow(/different release bytes/)
  }
)

it.each([
  'campaignOpened',
  'changeSaved',
  'updatePerformed',
  'continuedWork',
  'backupRestored'
] as const)('requires the live test step %s', (field) => {
  const value = accepted()
  value.input.checks[field] = false
  expect(() => record(value)).toThrow()
})

it('rejects approvals by another identity, bots and reviews of another environment', () => {
  const other = accepted()
  other.context.reviewHistory[0]!.user.id = 999
  expect(() => record(other)).toThrow(/human release reviewer/)
  const bot = accepted()
  bot.context.reviewHistory[0]!.user.type = 'Bot'
  expect(() => record(bot)).toThrow(/human release reviewer/)
  const environment = accepted()
  environment.context.reviewHistory[0]!.environments[0]!.id = 456
  expect(() => record(environment)).toThrow(/Missing approval/)
  const name = accepted()
  name.context.reviewHistory[0]!.environments[0]!.name = 'staging'
  expect(() => record(name)).toThrow(/Missing approval/)
})

it('requires an actual approval and rejects ambiguous rejected-run history', () => {
  const absent = accepted()
  absent.context.reviewHistory = []
  expect(() => record(absent)).toThrow(/Missing approval/)
  const rejected = accepted()
  rejected.context.reviewHistory.push({
    ...rejected.context.reviewHistory[0]!,
    state: 'rejected'
  })
  expect(() => record(rejected)).toThrow(/rejected release review/)
})

it('does not accept reviewer claims added to dispatch input', () => {
  const value = accepted()
  expect(() =>
    createLiveAcceptanceReceipt(
      bytes({ ...value.input, reviewer: 'ThonkTank' }),
      bytes(value.requested),
      bytes(value.manifest),
      bytes(value.qualification),
      value.context
    )
  ).toThrow()
})
