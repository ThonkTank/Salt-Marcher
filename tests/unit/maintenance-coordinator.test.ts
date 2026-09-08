import { randomUUID } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { MaintenanceCoordinator } from '../../src/shared/maintenance/coordinator.js'
import { sha256 } from '../../src/shared/maintenance/files.js'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

function fixture(channel: 'local' | 'release', fresh = false) {
  const root = mkdtempSync(join(tmpdir(), `salt-${channel}-transaction-`))
  roots.push(root)
  const program = (deployment: string, version: string) => {
    const directory = join(root, 'deployments', deployment)
    mkdirSync(directory, { recursive: true })
    const path = join(directory, 'SaltMarcher.AppImage')
    writeFileSync(path, `executable ${version}`)
    return { deployment, version, sha256: sha256(path) }
  }
  const previous = fresh ? null : program('previous', '0.2.0')
  const next = program('next', '0.3.0')
  const id = randomUUID()
  const data = join(root, 'profile', 'campaign-data')
  if (previous) {
    mkdirSync(data, { recursive: true })
    writeFileSync(join(data, 'state'), 'old campaign')
    symlinkSync(join('deployments', previous.deployment), join(root, 'current'))
  }
  mkdirSync(join(root, `staged-${id}`))
  writeFileSync(join(root, `staged-${id}`, 'state'), 'migrated campaign')
  const input = {
    id,
    operation: fresh ? ('install' as const) : ('update' as const),
    backup: fresh ? null : randomUUID(),
    previous,
    next
  }
  return { root, data, input }
}

class Interrupted extends Error {}
function interruptAt(name: string) {
  return (boundary: string) => {
    if (boundary === name) throw new Interrupted(name)
  }
}

describe.each(['local', 'release'] as const)(
  '%s common maintenance transaction',
  (channel) => {
    it.each([
      'prepared',
      'data-moving',
      'old-data-moved',
      'new-data-moved',
      'data-ready',
      'program-moving',
      'program-linked',
      'awaiting-start'
    ])('recovers the previous pair after interruption at %s', (boundary) => {
      const { root, data, input } = fixture(channel)
      const transaction = new MaintenanceCoordinator(
        root,
        interruptAt(boundary)
      )
      expect(() => {
        transaction.begin(input)
        transaction.activate()
      }).toThrow(Interrupted)
      const recovery = new MaintenanceCoordinator(root)
      recovery.rollback()
      recovery.rollback()
      expect(readFileSync(join(data, 'state'), 'utf8')).toBe('old campaign')
      expect(readlinkSync(join(root, 'current'))).toBe(
        join('deployments', 'previous')
      )
      expect(recovery.read()?.phase).toBe('rolled-back')
      expect(
        existsSync(join(root, 'deployments', 'next', 'SaltMarcher.AppImage'))
      ).toBe(true)
    })

    it.each([
      'rollback-started',
      'rollback-preserving',
      'failed-data-preserved',
      'rollback-restoring',
      'old-data-restored',
      'rollback-program',
      'program-linked',
      'rolled-back'
    ])(
      'can interrupt recovery itself at %s without losing either data tree',
      (boundary) => {
        const { root, data, input } = fixture(channel)
        const transaction = new MaintenanceCoordinator(root)
        transaction.begin(input)
        transaction.activate()
        expect(() =>
          new MaintenanceCoordinator(root, interruptAt(boundary)).rollback()
        ).toThrow(Interrupted)
        new MaintenanceCoordinator(root).rollback()
        expect(readFileSync(join(data, 'state'), 'utf8')).toBe('old campaign')
        expect(
          readFileSync(join(root, `failed-${input.id}`, 'state'), 'utf8')
        ).toBe('migrated campaign')
        expect(readlinkSync(join(root, 'current'))).toBe(
          join('deployments', 'previous')
        )
      }
    )

    it('keeps subsequent user writes after a durable commit even if the process then dies', () => {
      const { root, data, input } = fixture(channel)
      const transaction = new MaintenanceCoordinator(
        root,
        interruptAt('committed')
      )
      transaction.begin(input)
      transaction.activate()
      expect(() => transaction.commit(input.id)).toThrow(Interrupted)
      writeFileSync(join(data, 'state'), 'later user work')
      new MaintenanceCoordinator(root).rollback()
      expect(readFileSync(join(data, 'state'), 'utf8')).toBe('later user work')
      expect(readlinkSync(join(root, 'current'))).toBe(
        join('deployments', 'next')
      )
      expect(
        readFileSync(join(root, `previous-${input.id}`, 'state'), 'utf8')
      ).toBe('old campaign')
    })

    it.each(['prepared', 'new-data-moved', 'program-linked', 'awaiting-start'])(
      'rolls a fresh installation back after %s without inventing previous data',
      (boundary) => {
        const { root, data, input } = fixture(channel, true)
        const transaction = new MaintenanceCoordinator(
          root,
          interruptAt(boundary)
        )
        expect(() => {
          transaction.begin(input)
          transaction.activate()
        }).toThrow(Interrupted)
        new MaintenanceCoordinator(root).rollback()
        expect(existsSync(data)).toBe(false)
        expect(existsSync(join(root, 'current'))).toBe(false)
      }
    )

    it('requires the matching transaction token and immutable executable for acceptance', () => {
      const { root, input } = fixture(channel)
      const transaction = new MaintenanceCoordinator(root)
      transaction.begin(input)
      transaction.activate()
      expect(() => transaction.commit(randomUUID())).toThrow()
      writeFileSync(
        join(root, 'deployments', 'next', 'SaltMarcher.AppImage'),
        'changed'
      )
      expect(() => transaction.commit(input.id)).toThrow()
      expect(transaction.read()?.phase).toBe('awaiting-start')
    })
  }
)

function integratedFixture() {
  const { root: sandbox, input } = fixture('local')
  const root = join(sandbox, 'salt-marcher-local')
  mkdirSync(root)
  // Keep every integration path within this test's private data directory.
  renameSync(join(sandbox, 'deployments'), join(root, 'deployments'))
  renameSync(join(sandbox, 'profile'), join(root, 'profile'))
  renameSync(join(sandbox, 'current'), join(root, 'current'))
  renameSync(
    join(sandbox, `staged-${input.id}`),
    join(root, `staged-${input.id}`)
  )
  const desktop = join(sandbox, 'applications', 'salt.desktop')
  const icon = join(sandbox, 'icons', 'salt.png')
  mkdirSync(join(sandbox, 'applications'))
  mkdirSync(join(sandbox, 'icons'))
  writeFileSync(desktop, 'previous desktop')
  return {
    root,
    desktop,
    icon,
    input: {
      ...input,
      integration: [
        { target: desktop, content: 'next desktop', mode: 0o644 },
        { target: icon, content: 'next icon', mode: 0o644 }
      ]
    }
  }
}

describe('journaled desktop integration', () => {
  it.each(['integration-0-applied', 'integration-1-applied', 'program-linked'])(
    'restores the full pair after %s',
    (boundary) => {
      const { root, input, desktop, icon } = integratedFixture()
      const transaction = new MaintenanceCoordinator(
        root,
        interruptAt(boundary)
      )
      transaction.begin(input)
      expect(() => transaction.activate()).toThrow(Interrupted)
      const recovery = new MaintenanceCoordinator(root)
      recovery.rollback()
      recovery.rollback()
      expect(readFileSync(desktop, 'utf8')).toBe('previous desktop')
      expect(existsSync(icon)).toBe(false)
      expect(
        readFileSync(join(root, 'profile', 'campaign-data', 'state'), 'utf8')
      ).toBe('old campaign')
      expect(readlinkSync(join(root, 'current'))).toBe(
        join('deployments', 'previous')
      )
    }
  )

  it.each(['integration-0-restored', 'integration-1-restored'])(
    'resumes interrupted recovery at %s',
    (boundary) => {
      const { root, input, desktop, icon } = integratedFixture()
      const transaction = new MaintenanceCoordinator(root)
      transaction.begin(input)
      transaction.activate()
      expect(() =>
        new MaintenanceCoordinator(root, interruptAt(boundary)).rollback()
      ).toThrow(Interrupted)
      transaction.rollback()
      expect(readFileSync(desktop, 'utf8')).toBe('previous desktop')
      expect(existsSync(icon)).toBe(false)
      expect(transaction.read()?.phase).toBe('rolled-back')
    }
  )

  it.each(['desktop', 'icon'] as const)(
    'preserves outside changes to %s during rollback',
    (target) => {
      const fixture = integratedFixture()
      const transaction = new MaintenanceCoordinator(fixture.root)
      transaction.begin(fixture.input)
      transaction.activate()
      writeFileSync(fixture[target], 'outside change')
      expect(() => transaction.rollback()).toThrow('außerhalb der Wartung')
      expect(readFileSync(fixture[target], 'utf8')).toBe('outside change')
      expect(transaction.read()?.phase).toBe('rollback-program')
    }
  )

  it('does not accept a start with changed desktop integration', () => {
    const { root, input, desktop } = integratedFixture()
    const transaction = new MaintenanceCoordinator(root)
    transaction.begin(input)
    transaction.activate()
    writeFileSync(desktop, 'unexpected desktop')
    expect(() => transaction.commit(input.id)).toThrow('Desktop-Integration')
    expect(transaction.read()?.phase).toBe('awaiting-start')
  })

  it('retains later desktop and profile changes after acceptance', () => {
    const { root, input, desktop } = integratedFixture()
    const transaction = new MaintenanceCoordinator(root)
    transaction.begin(input)
    transaction.activate()
    transaction.commit(input.id)
    writeFileSync(desktop, 'later customization')
    const data = join(root, 'profile', 'campaign-data', 'state')
    writeFileSync(data, 'later play')
    transaction.rollback()
    expect(readFileSync(desktop, 'utf8')).toBe('later customization')
    expect(readFileSync(data, 'utf8')).toBe('later play')
  })
})
