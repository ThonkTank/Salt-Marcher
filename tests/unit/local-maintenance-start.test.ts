import { verifyLocalRuntimeStartup } from '../../scripts/local-installation/runtime-start.js'
import { acquireProfileLock } from '../../src/main/local-profile/local-profile-lock.js'
import { randomUUID } from 'node:crypto'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  recoverLocalMaintenance,
  completeLocalMaintenance
} from '../../src/main/local-profile/maintenance.js'
import { MaintenanceCoordinator } from '../../src/shared/maintenance/coordinator.js'
import { localProgram } from '../../src/shared/maintenance/local-program.js'
import { durableJson, sha256 } from '../../src/shared/maintenance/files.js'
const runtime = vi.hoisted(() => ({ packaged: false }))
vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return runtime.packaged
    }
  }
}))
let root: string
let id: string
let coordinator: MaintenanceCoordinator
const argv = [...process.argv]
const oldCommit = 'a'.repeat(40)
const nextCommit = 'b'.repeat(40)
beforeEach(() => {
  runtime.packaged = false
  root = mkdtempSync(join(tmpdir(), 'salt-local-start-'))
  for (const key of ['a', 'b']) {
    const deployment = join(root, 'deployments', key.repeat(64))
    mkdirSync(deployment, { recursive: true })
    const executable = join(deployment, 'SaltMarcher.AppImage')
    writeFileSync(executable, key)
    durableJson(join(deployment, 'artifact-manifest.json'), {
      formatVersion: 2,
      artifactFile: 'SaltMarcher.AppImage',
      artifactSha256: sha256(executable),
      receiptSha256: 'f'.repeat(64),
      receipt: {
        formatVersion: 2,
        outputHash: 'e'.repeat(64),
        files: [],
        build: {
          channel: 'local',
          commit: key.repeat(40),
          dirty: false,
          workspaceFingerprint: key.repeat(64),
          appBuildInputFingerprint: key.repeat(64),
          builtAt: '2026-09-08T00:00:00.000Z',
          schemaVersions: { installation: 39, campaign: 34 },
          migrationRegistryVersion: 11,
          toolchain: {
            node: '22',
            pnpm: '10',
            electron: '43',
            electronVite: '5',
            electronBuilder: '26',
            platform: 'linux',
            arch: 'x64'
          }
        }
      }
    })
  }
  symlinkSync(join('deployments', 'a'.repeat(64)), join(root, 'current'))
  mkdirSync(join(root, 'profile', 'campaign-data'), { recursive: true })
  writeFileSync(join(root, 'profile', 'campaign-data', 'state'), 'old')
  id = randomUUID()
  mkdirSync(join(root, `staged-${id}`))
  writeFileSync(join(root, `staged-${id}`, 'state'), 'new')
  coordinator = new MaintenanceCoordinator(root)
  coordinator.begin({
    id,
    operation: 'update',
    backup: randomUUID(),
    previous: localProgram(root, 'a'.repeat(64)),
    next: localProgram(root, 'b'.repeat(64))
  })
  coordinator.activate()
})
afterEach(() => {
  process.argv = [...argv]
  vi.unstubAllEnvs()
  rmSync(root, { recursive: true, force: true })
})
describe('Local startup admission', () => {
  it('requires the verifier token before normal data access', () => {
    expect(recoverLocalMaintenance(root, nextCommit)).toBe('relaunch')
    expect(
      readFileSync(join(root, 'profile', 'campaign-data', 'state'), 'utf8')
    ).toBe('old')
    expect(readlinkSync(join(root, 'current'))).toContain('a'.repeat(64))
    expect(recoverLocalMaintenance(root, oldCommit)).toBe('normal')
  })
  it('accepts the intended runtime and preserves all later writes', () => {
    process.argv = [...argv, '--maintenance-complete', id]
    expect(recoverLocalMaintenance(root, nextCommit)).toBe('verify')
    completeLocalMaintenance(root, nextCommit)
    writeFileSync(join(root, 'profile', 'campaign-data', 'state'), 'later work')
    process.argv = [...argv]
    expect(recoverLocalMaintenance(root, nextCommit)).toBe('normal')
    expect(
      readFileSync(join(root, 'profile', 'campaign-data', 'state'), 'utf8')
    ).toBe('later work')
    expect(recoverLocalMaintenance(root, oldCommit)).toBe('relaunch')
  })
  it('rejects an executable with the right commit label but different bytes', () => {
    runtime.packaged = true
    process.argv = [...argv, '--maintenance-complete', id]
    const other = join(root, 'different.AppImage')
    writeFileSync(other, 'different binary')
    vi.stubEnv('APPIMAGE', other)
    expect(() => completeLocalMaintenance(root, nextCommit)).toThrow()
    expect(coordinator.read()?.phase).toBe('awaiting-start')
  })
  it('does not treat a missing journal during completion as success', () => {
    process.argv = [...argv, '--maintenance-complete', id]
    expect(recoverLocalMaintenance(root, nextCommit)).toBe('verify')
    rmSync(coordinator.journalPath)
    expect(() => completeLocalMaintenance(root, nextCommit)).toThrow(
      'Kein Wartungsjournal'
    )
  })
})

describe('Local external startup verification', () => {
  const artifact = () => localProgram(root, 'b'.repeat(64)).sha256
  it('rolls back a failure before Electron can acquire its profile', () => {
    expect(() =>
      verifyLocalRuntimeStartup(root, artifact(), (arguments_) => {
        expect(arguments_).toEqual(['--maintenance-complete', id])
        throw new Error('cannot execute AppImage')
      })
    ).toThrow('cannot execute AppImage')
    expect(coordinator.read()?.phase).toBe('rolled-back')
    expect(
      readFileSync(join(root, 'profile', 'campaign-data', 'state'), 'utf8')
    ).toBe('old')
  })
  it('rejects exit zero without durable acceptance and restores previous data', () => {
    expect(() => verifyLocalRuntimeStartup(root, artifact(), () => 0)).toThrow(
      'did not durably accept'
    )
    expect(coordinator.read()?.phase).toBe('rolled-back')
  })
  it('allows the child to acquire the lock and accept the intended update', () => {
    expect(
      verifyLocalRuntimeStartup(root, artifact(), () => {
        const lock = acquireProfileLock(
          join(root, 'runtime.lock'),
          'application'
        )
        try {
          coordinator.commit(id)
        } finally {
          lock.release()
        }
        return 'verified'
      })
    ).toBe('verified')
    expect(coordinator.read()?.phase).toBe('committed')
  })
  it('keeps later work when verification fails after acceptance', () => {
    const state = join(root, 'profile', 'campaign-data', 'state')
    expect(() =>
      verifyLocalRuntimeStartup(root, artifact(), () => {
        coordinator.commit(id)
        writeFileSync(state, 'later work')
        throw new Error('later verification failure')
      })
    ).toThrow('later verification failure')
    expect(coordinator.read()?.phase).toBe('committed')
    expect(readFileSync(state, 'utf8')).toBe('later work')
  })
  it('does not roll back while an application still holds the lock', () => {
    const lock = acquireProfileLock(join(root, 'runtime.lock'), 'application')
    const launch = vi.fn<(arguments_: readonly string[]) => void>()
    try {
      expect(() => verifyLocalRuntimeStartup(root, artifact(), launch)).toThrow(
        'locked'
      )
      expect(launch).not.toHaveBeenCalled()
      expect(coordinator.read()?.phase).toBe('awaiting-start')
    } finally {
      lock.release()
    }
  })
})
