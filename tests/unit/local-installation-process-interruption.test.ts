import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { localInstallationPaths } from '../../scripts/local-installation/contract.js'
import { maintenanceJournalSchema } from '../../src/shared/contracts/maintenance.js'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})
function run(root: string, action: string, boundary?: string) {
  const child = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      resolve('tests/fixtures/local-installation-process/worker.ts'),
      root,
      action,
      ...(boundary ? [boundary] : [])
    ],
    {
      encoding: 'utf8',
      timeout: 20_000,
      killSignal: 'SIGKILL',
      maxBuffer: 128 * 1024
    }
  )
  expect(child.error, child.stderr).toBeUndefined()
  expect(child.stderr).toBe('')
  if (boundary) {
    expect(child.stdout).toBe(`BOUNDARY:${boundary}\n`)
    expect(child.status).toBeNull()
    expect(child.signal).toBe('SIGKILL')
  } else {
    expect(child.status, child.stdout).toBe(0)
    expect(child.signal).toBeNull()
  }
}
function tree(directory: string, logical = false): unknown {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => !logical || !/-(wal|shm)$/.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const path = join(directory, entry.name)
      let content: unknown
      if (entry.isDirectory()) content = tree(path, logical)
      else if (logical && entry.name.endsWith('.sqlite')) {
        const db = new Database(path, { readonly: true, fileMustExist: true })
        try {
          const tables = db
            .prepare(
              "SELECT name, sql FROM sqlite_master WHERE type = 'table' ORDER BY name"
            )
            .all() as { name: string; sql: string }[]
          content = {
            version: db.pragma('user_version', { simple: true }),
            tables: tables.map((table) => ({
              ...table,
              rows: db
                .prepare(
                  'SELECT * FROM "' + table.name.replaceAll('"', '""') + '"'
                )
                .all()
                .map((row) => JSON.stringify(row))
                .sort()
            }))
          }
        } finally {
          db.close()
        }
      } else
        content = createHash('sha256').update(readFileSync(path)).digest('hex')
      return { name: entry.name, content }
    })
}
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'salt-local-process-'))
  roots.push(root)
  run(root, 'init')
  const paths = localInstallationPaths(join(root, 'xdg'))
  return {
    root,
    paths,
    before: tree(paths.profile, true),
    logical: tree(paths.profile, true),
    program: readlinkSync(paths.current),
    desktop: readFileSync(paths.desktopEntry),
    icon: readFileSync(paths.icon)
  }
}
function journal(root: string) {
  return maintenanceJournalSchema.parse(
    JSON.parse(
      readFileSync(
        join(
          localInstallationPaths(join(root, 'xdg')).root,
          'maintenance-journal.json'
        ),
        'utf8'
      )
    )
  )
}
function expectRecovered(f: ReturnType<typeof fixture>) {
  expect(tree(f.paths.profile, true)).toEqual(f.before)
  expect(readlinkSync(f.paths.current)).toBe(f.program)
  expect(readFileSync(f.paths.desktopEntry)).toEqual(f.desktop)
  expect(readFileSync(f.paths.icon)).toEqual(f.icon)
  expect(journal(f.root).phase).toBe('rolled-back')
}
function retry(f: ReturnType<typeof fixture>) {
  run(f.root, 'accept')
  expect(journal(f.root).phase).toBe('committed')
  expect(readlinkSync(f.paths.current)).not.toBe(f.program)
  expect(readFileSync(f.paths.icon, 'utf8')).toBe('icon-b')
  expect(tree(f.paths.profile, true)).toEqual(f.logical)
}

describe.runIf(process.platform === 'linux')(
  'Local installer real process interruption (inert artifacts)',
  () => {
    it.each([
      'prepared',
      'data-moving',
      'old-data-moved',
      'new-data-moved',
      'data-ready',
      'program-moving',
      'program-linked',
      'awaiting-start'
    ])(
      'recovers activation SIGKILL at %s through the installer',
      (boundary) => {
        const f = fixture()
        run(f.root, 'update', boundary)
        run(f.root, 'recover')
        expectRecovered(f)
        run(f.root, 'recover')
        expectRecovered(f)
        retry(f)
      }
    )
    it.each([
      'rollback-started',
      'rollback-preserving',
      'failed-data-preserved',
      'rollback-restoring',
      'old-data-restored',
      'rollback-program',
      'program-linked',
      'rollback-history-written',
      'rolled-back'
    ])('resumes installer recovery after SIGKILL at %s', (boundary) => {
      const f = fixture()
      run(f.root, 'update', 'awaiting-start')
      run(f.root, 'recover', boundary)
      run(f.root, 'recover')
      expectRecovered(f)
      run(f.root, 'recover')
      expectRecovered(f)
      retry(f)
    })
    it('preserves accepted later profile changes after durable commit SIGKILL', () => {
      const f = fixture()
      run(f.root, 'update')
      run(f.root, 'commit', 'committed')
      const committed = journal(f.root)
      mkdirSync(join(f.paths.profile, 'later'), { recursive: true })
      writeFileSync(
        join(f.paths.profile, 'later', 'session.txt'),
        'Work saved after acceptance'
      )
      const later = tree(f.paths.profile, true)
      // Re-enter the original installer for the accepted build; it must not rollback.
      run(f.root, 'update')
      run(f.root, 'update')
      expect(journal(f.root).next).toEqual(committed.next)
      expect(journal(f.root).previous).toEqual(committed.next)
      expect(tree(f.paths.profile, true)).toEqual(later)
      expect(tree(f.paths.profile, true)).not.toEqual(f.logical)
    })
  }
)
