import { spawnSync } from 'node:child_process'
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  readdirSync,
  writeFileSync
} from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import Database from 'better-sqlite3'
import { afterEach, expect, it } from 'vitest'
import { InstallationDatabaseOwner } from '../../src/core/persistence/sqlite/installation-database-owner.js'
import { preflightPersistence } from '../../src/core/persistence/sqlite/persistence-preflight.js'
import { IncompatibleDataError } from '../../src/core/persistence/sqlite/database.js'

const roots: string[] = []
function root() {
  const value = mkdtempSync(join(tmpdir(), 'salt-bootstrap-'))
  roots.push(value)
  return value
}
afterEach(() => {
  for (const value of roots.splice(0))
    rmSync(value, { recursive: true, force: true })
})
it('recovers a process killed after real registry DDL without retaining a partial schema', () => {
  const directory = root()
  const child = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      resolve('tests/fixtures/installation-bootstrap-interruption.ts'),
      directory
    ],
    { encoding: 'utf8', timeout: 20_000 }
  )
  expect(child.error).toBeUndefined()
  expect(child.status).toBeNull()
  expect(child.signal).toBe('SIGKILL')
  expect(child.stdout).toBe('REGISTRY_CREATED\n')
  expect(child.stderr).toBe('')
  const bytes = () =>
    readdirSync(directory)
      .sort()
      .map((name) => ({ name, bytes: readFileSync(join(directory, name)) }))
  const before = bytes()
  expect(preflightPersistence(directory)).toEqual({
    kind: 'fresh',
    databases: []
  })
  expect(bytes()).toEqual(before)
  const owner = new InstallationDatabaseOwner(directory)
  const settings = owner.readSettings()
  const updated = owner.updateSettings({ theme: 'dark' }, settings.revision)
  owner.close()
  expect(preflightPersistence(directory).kind).toBe('ready')
  const reopened = new InstallationDatabaseOwner(directory)
  expect(reopened.readSettings()).toEqual(updated)
  reopened.close()
}, 30_000)
it.each(['partial-schema', 'populated', 'foreign-file', 'newer-empty'])(
  'does not reset %s',
  (kind) => {
    const directory = root()
    const path = join(directory, 'installation.sqlite')
    const db = new Database(path)
    if (kind === 'partial-schema' || kind === 'populated')
      db.exec('CREATE TABLE valuable (value TEXT)')
    if (kind === 'populated') db.exec("INSERT INTO valuable VALUES ('keep me')")
    if (kind === 'newer-empty') db.pragma('user_version = 1000')
    db.close()
    if (kind === 'foreign-file')
      writeFileSync(join(directory, 'keep.txt'), 'valuable data')
    const before = readFileSync(path)
    expect(() => new InstallationDatabaseOwner(directory)).toThrow(
      IncompatibleDataError
    )
    expect(readFileSync(path)).toEqual(before)
    if (kind === 'foreign-file')
      expect(readFileSync(join(directory, 'keep.txt'), 'utf8')).toBe(
        'valuable data'
      )
  }
)
