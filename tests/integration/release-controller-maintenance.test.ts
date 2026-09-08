import { exportCompleteProfile } from '../../src/core/maintenance/export-profile.js'
import { inventory } from '../../src/shared/maintenance/files.js'
import {
  preparedMaintenance,
  acceptMaintenance
} from '../support/release-maintenance.js'
import type { MessageBoxOptions, MessageBoxReturnValue } from 'electron'
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
  quit: vi.fn(),
  chooseBackup: vi.fn(),
  confirmBackup:
    vi.fn<(options: MessageBoxOptions) => Promise<MessageBoxReturnValue>>()
}))
vi.mock('../../src/shared/maintenance/appimage-launcher.js', () => ({
  readAppImageLauncher: () => Buffer.from('// synthetic fixture helper')
}))
vi.mock('../../src/main/local-profile/source-profile-admission.js', () => ({
  withQualifiedSourceProfile: (
    root: string,
    _target: string,
    operation: (profile: string) => Promise<string>
  ) => operation(join(root, 'profile'))
}))
vi.mock('../../src/main/release/maintenance-worker.js', () => ({
  maintenanceWorker: (input: {
    source: string
    destination: string
    version: string
  }) => exportCompleteProfile(input.source, input.destination, input.version)
}))
vi.mock('node:child_process', () => ({ spawn: mocks.spawn }))
vi.mock('electron', () => ({
  app: { getVersion: () => '0.2.0', quit: mocks.quit, isPackaged: false },
  BrowserWindow: { getAllWindows: () => [] },
  dialog: {
    showOpenDialog: mocks.chooseBackup,
    showMessageBox: mocks.confirmBackup
  }
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
  mocks.confirmBackup.mockResolvedValue({ response: 1, checkboxChecked: false })
  workspace = mkdtempSync(join(tmpdir(), 'salt-controller-'))
  vi.stubEnv('XDG_DATA_HOME', workspace)
  root = join(workspace, 'salt-marcher')
  setCurrent(root, releaseDeployment(root, '0.2.0'))
  maintenance = new ProfileMaintenance(root, '0.2.0', 'profile')
  mkdirSync(maintenance.data, { recursive: true })
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
          backupDirectory?: string
          expectedManifestSha256?: string
        }
        requestOperations.push(request.operation)
        try {
          const source =
            request.operation === 'restore'
              ? maintenance.backupSource(request.id!)
              : request.source
          const result =
            request.operation === 'import-backup'
              ? await maintenance.importBackup(
                  request.transactionId,
                  request.backupDirectory!,
                  request.expectedManifestSha256
                )
              : await maintenance.prepare(request.transactionId, source)
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
  it('exports a selected qualified profile unchanged and activates it with a target backup', async () => {
    const source = join(workspace, 'source-installation')
    const producer = new ProfileMaintenance(source, '0.3.0', 'profile')
    const store = new CampaignStore(producer.data)
    store.create('Imported campaign')
    store.close()
    writeFileSync(join(source, 'profile', 'own-map.svg'), 'source map')
    acceptMaintenance(producer, await preparedMaintenance(producer))
    const before = inventory(join(source, 'profile'))
    mocks.chooseBackup.mockResolvedValue({
      canceled: false,
      filePaths: [join(source, 'profile')]
    })
    const controller = new ReleaseController(true, async () => {}, vi.fn())
    await controller.importProfile(undefined, 'profile')
    expect(controller.status().phase).toBe('maintenance')
    expect(requestOperations).toEqual(['import-backup'])
    expect(inventory(join(source, 'profile'))).toEqual(before)
    expect(readFileSync(join(root, 'profile', 'own-map.svg'), 'utf8')).toBe(
      'source map'
    )
    const imported = new CampaignStore(maintenance.data)
    expect(imported.list().campaigns[0]?.name).toBe('Imported campaign')
    imported.close()
    const state = new MaintenanceCoordinator(root).read()!
    expect(
      readFileSync(
        join(
          maintenance.backupSource(state.backup!),
          'campaign-data',
          'notes.txt'
        ),
        'utf8'
      )
    ).toBe('backup state')
    expect(readdirSync(join(root, 'cache'))).toEqual([])
  })

  it('restores while the live campaign database is corrupt and preserves its bytes', async () => {
    const id = await maintenance.backup()
    const path = join(maintenance.data, 'installation.sqlite')
    writeFileSync(path, 'damaged current database')
    const controller = new ReleaseController(true, async () => {}, vi.fn())
    await controller.restore(id!)
    expect(controller.status().phase).toBe('maintenance')
    const transaction = new MaintenanceCoordinator(root).read()!
    expect(
      readFileSync(
        join(
          root,
          'backups',
          transaction.backup!,
          'data',
          'campaign-data',
          'installation.sqlite'
        ),
        'utf8'
      )
    ).toBe('damaged current database')
    const restored = new CampaignStore(maintenance.data)
    expect(restored.list().campaigns[0]?.name).toBe('Alltagskampagne')
    restored.close()
  })

  it('does not start target maintenance when the old data process cannot be stopped', async () => {
    const id = await maintenance.backup()
    const before = readFileSync(join(maintenance.data, 'notes.txt'))
    const controller = new ReleaseController(
      true,
      () => Promise.reject(new Error('Datenprozess ist noch nicht beendet')),
      vi.fn()
    )
    await controller.restore(id!)
    expect(controller.status()).toMatchObject({
      phase: 'error',
      message: 'Datenprozess ist noch nicht beendet'
    })
    expect(mocks.spawn).not.toHaveBeenCalled()
    expect(readFileSync(join(maintenance.data, 'notes.txt'))).toEqual(before)
    expect(maintenance.backups()).toHaveLength(1)
  })

  it('routes the selected backup through target-version validation and shared activation', async () => {
    const id = await maintenance.backup()
    mocks.chooseBackup.mockResolvedValue({
      canceled: false,
      filePaths: [join(root, 'backups', id!)]
    })
    writeFileSync(join(maintenance.data, 'notes.txt'), 'later work')
    const controller = new ReleaseController(true, async () => {}, vi.fn())
    await controller.importProfile()
    expect(requestOperations).toEqual(['import-backup'])
    expect(new MaintenanceCoordinator(root).read()).toMatchObject({
      operation: 'import',
      phase: 'awaiting-start'
    })
    expect(readFileSync(join(maintenance.data, 'notes.txt'), 'utf8')).toBe(
      'backup state'
    )
    expect(maintenance.backups()).toHaveLength(2)
  })

  it('rejects an ordinary profile folder before confirmation or stopping Core', async () => {
    mocks.chooseBackup.mockResolvedValue({
      canceled: false,
      filePaths: [maintenance.data]
    })
    const stop = vi.fn(async () => {})
    const controller = new ReleaseController(true, stop, vi.fn())
    await controller.importProfile()
    expect(controller.status().phase).toBe('error')
    expect(controller.status().message).toContain(
      'Bitte einen Sicherungsordner mit manifest.json und data auswählen'
    )
    expect(mocks.confirmBackup).not.toHaveBeenCalled()
    expect(stop).not.toHaveBeenCalled()
    expect(mocks.spawn).not.toHaveBeenCalled()
  })

  it.each(['profile', 'campaign-data'] as const)(
    'explains %s scope after selection and cancels without stopping Core',
    async (scope) => {
      const producer = new ProfileMaintenance(root, '0.2.0', scope)
      const id = await producer.backup()
      mocks.chooseBackup.mockResolvedValue({
        canceled: false,
        filePaths: [join(root, 'backups', id!)]
      })
      mocks.confirmBackup.mockResolvedValue({
        response: 0,
        checkboxChecked: false
      })
      const stop = vi.fn(async () => {})
      const controller = new ReleaseController(true, stop, vi.fn())
      await controller.importProfile()
      expect(mocks.confirmBackup).toHaveBeenCalledWith(
        expect.objectContaining({
          message:
            scope === 'profile'
              ? 'Das gesamte Profil durch diese Sicherung ersetzen?'
              : 'Diese ältere Sicherung enthält nur Kampagnendaten. Das gesamte Profil ersetzen?',
          defaultId: 0,
          cancelId: 0
        })
      )
      expect(mocks.confirmBackup.mock.calls[0]?.[0].detail).toContain(
        'Version 0.2.0'
      )
      expect(stop).not.toHaveBeenCalled()
      expect(mocks.spawn).not.toHaveBeenCalled()
      expect(maintenance.backups()).toHaveLength(1)
      expect(new MaintenanceCoordinator(root).read()).toBeNull()
    }
  )

  it('rejects replacement of the confirmed manifest before any preparation', async () => {
    const id = await maintenance.backup()
    const directory = join(root, 'backups', id!)
    mocks.chooseBackup.mockResolvedValue({
      canceled: false,
      filePaths: [directory]
    })
    mocks.confirmBackup.mockImplementation(() => {
      const path = join(directory, 'manifest.json')
      const manifest = JSON.parse(readFileSync(path, 'utf8')) as {
        version: string
      }
      manifest.version = 'another backup'
      durableJson(path, manifest)
      return Promise.resolve({ response: 1, checkboxChecked: false })
    })
    const controller = new ReleaseController(true, async () => {}, vi.fn())
    await controller.importProfile()
    expect(controller.status().phase).toBe('error')
    expect(controller.status().message).toContain(
      'seit der Bestätigung verändert'
    )
    expect(maintenance.backups()).toHaveLength(1)
    expect(new MaintenanceCoordinator(root).read()).toBeNull()
    expect(mocks.relaunch).not.toHaveBeenCalled()
  })

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
      readFileSync(
        join(root, `previous-${state.id}`, 'campaign-data', 'notes.txt'),
        'utf8'
      )
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
