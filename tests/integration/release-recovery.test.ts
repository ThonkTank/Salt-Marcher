import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { ProfileTransaction } from '../../src/core/maintenance/profile-transaction.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import {
  beginActivation,
  readActivation,
  setCurrent
} from '../../src/main/release/deployment.js'
import {
  completeRelease,
  recoverRelease
} from '../../src/main/release/recovery.js'

vi.mock('electron', () => ({ app: { getVersion: () => '0.2.0' } }))
vi.mock('../../src/main/release/maintenance-worker.js', () => ({
  maintenanceWorker: async (input: {
    root: string
    version: string
    operation: 'rollback' | 'commit'
  }) => {
    const transaction = new ProfileTransaction(input.root, input.version)
    transaction[input.operation]()
  }
}))
let workspace: string
let root: string
let oldDeployment: string
let nextDeployment: string
let transaction: ProfileTransaction
const originalArgv = [...process.argv]
function deployment(version: string): string {
  const id = randomUUID()
  const path = join(root, 'deployments', id)
  mkdirSync(path, { recursive: true })
  writeFileSync(join(path, 'SaltMarcher.AppImage'), version)
  writeFileSync(join(path, 'manifest.json'), JSON.stringify({ version }))
  return id
}
beforeEach(async () => {
  workspace = mkdtempSync(join(tmpdir(), 'salt-pair-recovery-'))
  vi.stubEnv('XDG_DATA_HOME', workspace)
  root = join(workspace, 'salt-marcher')
  oldDeployment = deployment('0.1.99')
  nextDeployment = deployment('0.2.0')
  setCurrent(root, oldDeployment)
  transaction = new ProfileTransaction(root, '0.1.99')
  mkdirSync(transaction.data)
  const store = new CampaignStore(transaction.data)
  store.create('Recovery campaign')
  store.close()
  writeFileSync(join(transaction.data, 'note.txt'), 'original')
  await transaction.prepare()
})
afterEach(() => {
  process.argv = [...originalArgv]
  vi.unstubAllEnvs()
  rmSync(workspace, { recursive: true, force: true })
})
describe('coupled program and data recovery', () => {
  it.each([
    'prepared',
    'activation-recorded',
    'data-activated',
    'program-activated'
  ])(
    'recovers a process interruption after %s to the original pair',
    async (boundary) => {
      if (boundary !== 'prepared') beginActivation(root, nextDeployment)
      if (['data-activated', 'program-activated'].includes(boundary)) {
        transaction.activate()
        writeFileSync(join(transaction.data, 'note.txt'), 'unaccepted target')
      }
      if (boundary === 'program-activated') setCurrent(root, nextDeployment)
      await recoverRelease()
      await recoverRelease()
      expect(readlinkSync(join(root, 'current'))).toContain(oldDeployment)
      expect(readFileSync(join(transaction.data, 'note.txt'), 'utf8')).toBe(
        'original'
      )
    }
  )
  it('finishes an interrupted commit without reverting accepted writes', async () => {
    beginActivation(root, nextDeployment)
    transaction.activate()
    setCurrent(root, nextDeployment)
    transaction.commit()
    writeFileSync(join(transaction.data, 'note.txt'), 'accepted edits')
    expect(await recoverRelease()).toBe('normal')
    expect(readActivation(root)?.phase).toBe('committed')
    expect(readlinkSync(join(root, 'current'))).toContain(nextDeployment)
    expect(readFileSync(join(transaction.data, 'note.txt'), 'utf8')).toBe(
      'accepted edits'
    )
  })
  it('requires the activation token before accepting the new runtime', async () => {
    const activation = beginActivation(root, nextDeployment)
    transaction.activate()
    setCurrent(root, nextDeployment)
    process.argv = [...originalArgv, '--release-complete', activation.id]
    expect(await recoverRelease()).toBe('verify')
    await completeRelease()
    writeFileSync(join(transaction.data, 'note.txt'), 'later work')
    process.argv = [...originalArgv]
    await recoverRelease()
    expect(readFileSync(join(transaction.data, 'note.txt'), 'utf8')).toBe(
      'later work'
    )
  })
})
