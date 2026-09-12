import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { sha256 } from '../../src/shared/maintenance/files.js'
import { maintenanceJournalSchema } from '../../src/shared/contracts/maintenance.js'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})
const worker = resolve('tests/fixtures/maintenance-process/worker.ts')
function run(root: string, action: string, boundary?: string) {
  const child = spawnSync(
    process.execPath,
    ['--import', 'tsx', worker, root, action, ...(boundary ? [boundary] : [])],
    {
      encoding: 'utf8',
      timeout: 10_000,
      killSignal: 'SIGKILL',
      maxBuffer: 64 * 1024
    }
  )
  expect(child.error).toBeUndefined()
  expect(child.stderr).toBe('')
  if (boundary) {
    expect(child.stdout).toBe(`BOUNDARY:${boundary}\n`)
    expect(child.status).toBeNull()
    expect(child.signal).toBe('SIGKILL')
  } else {
    expect(child.status).toBe(0)
    expect(child.signal).toBeNull()
  }
}
function tree(directory: string): unknown {
  return readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => ({
      name: entry.name,
      content: entry.isDirectory()
        ? tree(join(directory, entry.name))
        : readFileSync(join(directory, entry.name)).toString('hex')
    }))
}
function fixture(formatVersion: 2 | 3) {
  const root = mkdtempSync(join(tmpdir(), 'salt-process-interruption-'))
  roots.push(root)
  const program = (deployment: string) => {
    const directory = join(root, 'deployments', deployment)
    mkdirSync(directory, { recursive: true })
    const path = join(directory, 'SaltMarcher.AppImage')
    // Deliberately inert bytes: this suite tests publication, not artifact execution.
    writeFileSync(path, deployment)
    return {
      deployment,
      version: deployment === 'previous' ? '0.2.0' : '0.3.0',
      sha256: sha256(path)
    }
  }
  const id = randomUUID()
  const data = join(
    root,
    'profile',
    ...(formatVersion === 2 ? ['campaign-data'] : [])
  )
  const staged = join(root, `staged-${id}`)
  for (const [directory, value] of [
    [data, 'old'],
    [staged, 'migrated']
  ] as const) {
    mkdirSync(join(directory, 'own-assets', 'empty'), { recursive: true })
    writeFileSync(join(directory, 'settings.json'), JSON.stringify({ value }))
    writeFileSync(
      join(directory, 'own-assets', 'map'),
      Buffer.from([0, 255, value.length])
    )
    writeFileSync(join(directory, 'campaign-state'), value)
  }
  const input = {
    id,
    formatVersion,
    operation: 'update',
    phase: 'prepared',
    rollbackFrom: null,
    hadData: true,
    backup: randomUUID(),
    previous: program('previous'),
    next: program('next')
  }
  symlinkSync(join('deployments', 'previous'), join(root, 'current'))
  writeFileSync(join(root, 'input.json'), JSON.stringify(input))
  return { root, data, id, before: tree(data), migrated: tree(staged) }
}
function journal(root: string) {
  return maintenanceJournalSchema.parse(
    JSON.parse(readFileSync(join(root, 'maintenance-journal.json'), 'utf8'))
  )
}

describe.runIf(process.platform === 'linux').each([2, 3] as const)(
  'journal %s real process interruption',
  (formatVersion) => {
    it.each([
      'prepared',
      'data-moving',
      'old-data-moved',
      'new-data-moved',
      'data-ready',
      'program-moving',
      'program-linked',
      'awaiting-start'
    ])('recovers after SIGKILL at activation %s', (boundary) => {
      const f = fixture(formatVersion)
      run(f.root, 'activate', boundary)
      run(f.root, 'rollback')
      run(f.root, 'rollback')
      expect(tree(f.data)).toEqual(f.before)
      expect(readlinkSync(join(f.root, 'current'))).toBe(
        join('deployments', 'previous')
      )
      expect(journal(f.root).phase).toBe('rolled-back')
      expect(
        existsSync(join(f.root, 'deployments', 'next', 'SaltMarcher.AppImage'))
      ).toBe(true)
    })
    const recoveryBoundaries = [
      'rollback-started',
      'rollback-preserving',
      'failed-data-preserved',
      'rollback-restoring',
      'old-data-restored',
      'rollback-program',
      'program-linked',
      ...(formatVersion === 3 ? ['rollback-history-written'] : []),
      'rolled-back'
    ]
    it.each(recoveryBoundaries)(
      'resumes recovery after SIGKILL at %s',
      (boundary) => {
        const f = fixture(formatVersion)
        run(f.root, 'activate')
        run(f.root, 'rollback', boundary)
        run(f.root, 'rollback')
        run(f.root, 'rollback')
        expect(tree(f.data)).toEqual(f.before)
        expect(tree(join(f.root, `failed-${f.id}`))).toEqual(f.migrated)
        expect(readlinkSync(join(f.root, 'current'))).toBe(
          join('deployments', 'previous')
        )
        expect(journal(f.root).phase).toBe('rolled-back')
      }
    )
    it('preserves later writes after SIGKILL at durable commit', () => {
      const f = fixture(formatVersion)
      run(f.root, 'activate')
      run(f.root, 'commit', 'committed')
      writeFileSync(join(f.data, 'later-work'), 'must survive')
      const later = tree(f.data)
      run(f.root, 'rollback')
      run(f.root, 'rollback')
      expect(tree(f.data)).toEqual(later)
      expect(tree(join(f.root, `previous-${f.id}`))).toEqual(f.before)
      expect(readlinkSync(join(f.root, 'current'))).toBe(
        join('deployments', 'next')
      )
      expect(journal(f.root).phase).toBe('committed')
    })
  }
)
