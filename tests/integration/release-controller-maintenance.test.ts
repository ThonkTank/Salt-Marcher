import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ProfileMaintenance } from '../../src/core/maintenance/profile-maintenance.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { MaintenanceCoordinator } from '../../src/shared/maintenance/coordinator.js'
import { durableJson } from '../../src/shared/maintenance/files.js'
import {
  currentProgram,
  setCurrent
} from '../../src/main/release/deployment.js'
import { ReleaseController } from '../../src/main/release/controller.js'
import { releaseDeployment } from '../support/release-maintenance.js'

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(),
  relaunch: vi.fn(),
  quit: vi.fn()
}))
vi.mock('../../src/shared/maintenance/appimage-launcher.js', () => ({
  readAppImageLauncher: () => Buffer.from('// synthetic fixture helper')
}))
vi.mock('node:child_process', () => ({ spawn: mocks.spawn }))
vi.mock('electron', () => ({
  app: { getVersion: () => '0.2.0', quit: mocks.quit, isPackaged: false },
  BrowserWindow: { getAllWindows: () => [] },
  dialog: {}
}))
vi.mock('../../src/main/release/relaunch.js', () => ({
  relaunchRelease: mocks.relaunch
}))
let workspace: string
let root: string
let maintenance: ProfileMaintenance
let requestOperations: string[]
beforeEach(() => {
  vi.clearAllMocks()
  workspace = mkdtempSync(join(tmpdir(), 'salt-controller-'))
  vi.stubEnv('XDG_DATA_HOME', workspace)
  root = join(workspace, 'salt-marcher')
  setCurrent(root, releaseDeployment(root, '0.2.0'))
  maintenance = new ProfileMaintenance(root, '0.2.0')
  mkdirSync(maintenance.data)
  const store = new CampaignStore(maintenance.data)
  store.create('Alltagskampagne')
  store.close()
  writeFileSync(join(maintenance.data, 'notes.txt'), 'backup state')
  requestOperations = []
  mocks.spawn.mockImplementation(() => {
    const child = new EventEmitter()
    setImmediate(() => {
      void (async () => {
        const request = JSON.parse(
          readFileSync(join(root, 'maintenance-request.json'), 'utf8')
        ) as {
          token: string
          operation: string
          id?: string
          transactionId: string
          source?: string
        }
        requestOperations.push(request.operation)
        try {
          const source =
            request.operation === 'restore'
              ? maintenance.backupSource(request.id!)
              : request.source
          const result = await maintenance.prepare(
            request.transactionId,
            source
          )
          durableJson(join(root, `maintenance-result-${request.token}.json`), {
            ok: true,
            result
          })
        } catch (error) {
          durableJson(join(root, `maintenance-result-${request.token}.json`), {
            ok: false,
            message: String(error)
          })
        }
        child.emit('exit', 0)
      })()
    })
    return child
  })
})
afterEach(() => {
  vi.unstubAllEnvs()
  rmSync(workspace, { recursive: true, force: true })
})
describe('release controller uses shared maintenance', () => {
  it('restores using the installed deployment, preserves current work and awaits startup acceptance', async () => {
    const id = await maintenance.backup()
    writeFileSync(join(maintenance.data, 'notes.txt'), 'later valuable work')
    const deployment = currentProgram(root)!
    const count = readdirSync(join(root, 'deployments')).length
    const stop = vi.fn(async () => {})
    const resume = vi.fn()
    const controller = new ReleaseController(true, stop, resume)
    await controller.restore(id!)
    expect(controller.status().phase).toBe('maintenance')
    expect(stop).toHaveBeenCalledOnce()
    expect(resume).not.toHaveBeenCalled()
    expect(requestOperations).toEqual(['restore'])
    expect(readdirSync(join(root, 'deployments'))).toHaveLength(count)
    expect(currentProgram(root)).toEqual(deployment)
    expect(readFileSync(join(maintenance.data, 'notes.txt'), 'utf8')).toBe(
      'backup state'
    )
    expect(maintenance.backups()).toHaveLength(2)
    const state = new MaintenanceCoordinator(root).read()!
    expect(state.phase).toBe('awaiting-start')
    expect(state.previous).toEqual(state.next)
    expect(
      readFileSync(join(root, `previous-${state.id}`, 'notes.txt'), 'utf8')
    ).toBe('later valuable work')
    expect(mocks.relaunch).toHaveBeenCalledWith(
      join(root, 'deployments', deployment.deployment, 'SaltMarcher.AppImage'),
      ['--release-complete', state.id]
    )
    expect(mocks.quit).toHaveBeenCalledOnce()
  })
  it('resumes the original core after a rejected backup without replacing data', async () => {
    const id = await maintenance.backup()
    writeFileSync(join(root, 'backups', id!, 'data', 'notes.txt'), 'tampered')
    const before = currentProgram(root)
    const resume = vi.fn()
    const controller = new ReleaseController(true, async () => {}, resume)
    await controller.restore(id!)
    expect(controller.status().phase).toBe('error')
    expect(resume).toHaveBeenCalledOnce()
    expect(currentProgram(root)).toEqual(before)
    expect(readFileSync(join(maintenance.data, 'notes.txt'), 'utf8')).toBe(
      'backup state'
    )
    expect(mocks.relaunch).not.toHaveBeenCalled()
  })
})
