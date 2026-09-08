import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { ProfileMaintenance } from '../../src/core/maintenance/profile-maintenance.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import {
  currentProgram,
  deploymentProgram,
  setCurrent
} from '../../src/main/release/deployment.js'
import {
  completeRelease,
  recoverRelease
} from '../../src/main/release/recovery.js'
import { MaintenanceCoordinator } from '../../src/shared/maintenance/coordinator.js'
import { durableJson } from '../../src/shared/maintenance/files.js'
import { releaseDeployment } from '../support/release-maintenance.js'

vi.mock('electron', () => ({
  app: { getVersion: () => '0.2.0', isPackaged: false }
}))
let workspace: string
let root: string
let oldDeployment: string
let nextDeployment: string
let maintenance: ProfileMaintenance
let coordinator: MaintenanceCoordinator
let prepared: { id: string; backup: string | null }
const originalArgv = [...process.argv]
beforeEach(async () => {
  workspace = mkdtempSync(join(tmpdir(), 'salt-pair-recovery-'))
  vi.stubEnv('XDG_DATA_HOME', workspace)
  root = join(workspace, 'salt-marcher')
  oldDeployment = releaseDeployment(root, '0.1.99')
  nextDeployment = releaseDeployment(root, '0.2.0')
  setCurrent(root, oldDeployment)
  maintenance = new ProfileMaintenance(root, '0.1.99')
  mkdirSync(maintenance.data)
  const store = new CampaignStore(maintenance.data)
  store.create('Recovery campaign')
  store.close()
  writeFileSync(join(maintenance.data, 'note.txt'), 'original')
  prepared = await maintenance.prepare(randomUUID())
  coordinator = new MaintenanceCoordinator(root)
})
afterEach(() => {
  process.argv = [...originalArgv]
  vi.unstubAllEnvs()
  rmSync(workspace, { recursive: true, force: true })
})
function begin() {
  return coordinator.begin({
    ...prepared,
    operation: 'update',
    previous: currentProgram(root),
    next: deploymentProgram(root, nextDeployment)
  })
}
describe('coupled program and data recovery', () => {
  it('redirects a separately launched newer AppImage before it can open installed data', () => {
    expect(recoverRelease()).toBe('relaunch')
    expect(readlinkSync(join(root, 'current'))).toContain(oldDeployment)
    expect(readFileSync(join(maintenance.data, 'note.txt'), 'utf8')).toBe(
      'original'
    )
  })
  it.each([
    'prepared',
    'data-moving',
    'old-data-moved',
    'new-data-moved',
    'data-ready',
    'program-moving',
    'program-linked',
    'awaiting-start'
  ])('recovers an interruption at %s to the original pair', (boundary) => {
    coordinator = new MaintenanceCoordinator(root, (at) => {
      if (at === boundary) throw new Error('interrupted')
    })
    expect(() => {
      begin()
      coordinator.activate()
    }).toThrow('interrupted')
    recoverRelease()
    recoverRelease()
    expect(readlinkSync(join(root, 'current'))).toContain(oldDeployment)
    expect(readFileSync(join(maintenance.data, 'note.txt'), 'utf8')).toBe(
      'original'
    )
  })
  it('never reverts accepted writes after a completed startup', () => {
    const state = begin()
    coordinator.activate()
    process.argv = [...originalArgv, '--release-complete', state.id]
    expect(recoverRelease()).toBe('verify')
    completeRelease()
    writeFileSync(join(maintenance.data, 'note.txt'), 'accepted edits')
    process.argv = [...originalArgv]
    expect(recoverRelease()).toBe('normal')
    expect(coordinator.read()?.phase).toBe('committed')
    expect(readFileSync(join(maintenance.data, 'note.txt'), 'utf8')).toBe(
      'accepted edits'
    )
  })
  it('requires the matching activation token before accepting the new runtime', () => {
    begin()
    coordinator.activate()
    process.argv = [...originalArgv, '--release-complete', randomUUID()]
    expect(() => completeRelease()).toThrow()
    expect(recoverRelease()).toBe('relaunch')
    expect(readlinkSync(join(root, 'current'))).toContain(oldDeployment)
  })
})

describe('pre-baseline journal adoption', () => {
  it.each([
    'prepared',
    'data-moving',
    'data-ready',
    'rolling-back',
    'committed'
  ])(
    'adopts legacy %s state without an independent activation authority',
    (phase) => {
      durableJson(join(root, 'maintenance-journal.json'), {
        formatVersion: 1,
        id: prepared.id,
        phase,
        hadData: true
      })
      durableJson(join(root, 'activation.json'), {
        formatVersion: 1,
        id: randomUUID(),
        previous: oldDeployment,
        next: nextDeployment,
        phase: 'pending'
      })
      if (['data-ready', 'rolling-back', 'committed'].includes(phase)) {
        renameSync(maintenance.data, join(root, `previous-${prepared.id}`))
        renameSync(join(root, `staged-${prepared.id}`), maintenance.data)
        setCurrent(root, nextDeployment)
        writeFileSync(join(maintenance.data, 'note.txt'), 'target writes')
      }
      recoverRelease()
      recoverRelease()
      const committed = phase === 'committed'
      expect(readFileSync(join(maintenance.data, 'note.txt'), 'utf8')).toBe(
        committed ? 'target writes' : 'original'
      )
      expect(readlinkSync(join(root, 'current'))).toContain(
        committed ? nextDeployment : oldDeployment
      )
      expect(existsSync(join(root, 'activation.json'))).toBe(false)
    }
  )
  it('preserves an ambiguous legacy rollback without declaring a previous data pair', () => {
    rmSync(join(root, `staged-${prepared.id}`), { recursive: true })
    setCurrent(root, nextDeployment)
    const old = {
      formatVersion: 1,
      id: prepared.id,
      phase: 'rolling-back',
      hadData: true
    }
    durableJson(join(root, 'maintenance-journal.json'), old)
    durableJson(join(root, 'activation.json'), {
      formatVersion: 1,
      id: randomUUID(),
      previous: oldDeployment,
      next: nextDeployment,
      phase: 'pending'
    })
    expect(() => recoverRelease()).toThrow('nicht eindeutig')
    expect(
      JSON.parse(readFileSync(join(root, 'maintenance-journal.json'), 'utf8'))
    ).toEqual(old)
    expect(readFileSync(join(maintenance.data, 'note.txt'), 'utf8')).toBe(
      'original'
    )
    expect(readlinkSync(join(root, 'current'))).toContain(nextDeployment)
    expect(existsSync(join(root, 'activation.json'))).toBe(true)
  })
  it('resumes legacy rollback after the old data already moved back', () => {
    renameSync(
      join(root, `staged-${prepared.id}`),
      join(root, `failed-${prepared.id}`)
    )
    setCurrent(root, nextDeployment)
    durableJson(join(root, 'maintenance-journal.json'), {
      formatVersion: 1,
      id: prepared.id,
      phase: 'rolling-back',
      hadData: true
    })
    durableJson(join(root, 'activation.json'), {
      formatVersion: 1,
      id: randomUUID(),
      previous: oldDeployment,
      next: nextDeployment,
      phase: 'pending'
    })
    recoverRelease()
    expect(readFileSync(join(maintenance.data, 'note.txt'), 'utf8')).toBe(
      'original'
    )
    expect(readlinkSync(join(root, 'current'))).toContain(oldDeployment)
  })
})
