import { randomUUID } from 'node:crypto'
import {
  existsSync,
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
