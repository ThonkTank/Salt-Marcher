import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import {
  CorruptDataError,
  currentSchemaVersion,
  IncompatibleDataError
} from '../../src/core/persistence/sqlite/database.js'
import { preflightPersistence } from '../../src/core/persistence/sqlite/persistence-preflight.js'
import {
  applySchemaMigrations,
  migrationRegistryVersion,
  resolveSchemaMigrationPath,
  type SchemaMigration
} from '../../src/core/persistence/sqlite/schema-migrations.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('persistence preflight', () => {
  it('classifies missing persistence without creating it', () => {
    const root = temporaryRoot()
    const dataRoot = join(root, 'campaign-data')

    expect(preflightPersistence(dataRoot)).toEqual({
      kind: 'fresh',
      databases: []
    })
    expect(existsSync(dataRoot)).toBe(false)
  })

  it('checks current databases recursively in read-only mode', () => {
    const root = temporaryRoot()
    const installation = createDatabase(
      join(root, 'installation.sqlite'),
      currentSchemaVersion
    )
    const campaign = createDatabase(
      join(root, 'campaigns', 'one', 'campaign.sqlite'),
      currentSchemaVersion
    )
    const before = [readFileSync(installation), readFileSync(campaign)]

    const result = preflightPersistence(root)

    expect(result.kind).toBe('ready')
    expect(result.databases.map((entry) => entry.path)).toEqual([
      campaign,
      installation
    ])
    expect(readFileSync(installation)).toEqual(before[0])
    expect(readFileSync(campaign)).toEqual(before[1])
    expect(existsSync(`${installation}-wal`)).toBe(false)
    expect(existsSync(`${campaign}-wal`)).toBe(false)
  })

  it('preserves main, WAL, SHM, and directory bytes during preflight', () => {
    const root = temporaryRoot()
    const installation = createDatabase(
      join(root, 'installation.sqlite'),
      currentSchemaVersion
    )
    const writer = new Database(installation)
    writer.pragma('journal_mode = WAL')
    writer.prepare('INSERT INTO valuable VALUES (?)').run('in wal')
    const before = snapshotTree(root)

    expect(preflightPersistence(root).kind).toBe('ready')

    expect(snapshotTree(root)).toEqual(before)
    writer.close()
  })

  it('rejects an unsupported version without changing a byte', () => {
    const root = temporaryRoot()
    const path = createDatabase(join(root, 'installation.sqlite'), 2)
    const before = readFileSync(path)

    expect(() => preflightPersistence(root)).toThrowError(IncompatibleDataError)
    expect(readFileSync(path)).toEqual(before)
    expect(existsSync(`${path}-wal`)).toBe(false)
  })

  it('distinguishes corrupt data from incompatible data', () => {
    const root = temporaryRoot()
    const path = join(root, 'installation.sqlite')
    mkdirSync(root, { recursive: true })
    writeFileSync(path, 'not sqlite')

    expect(() => preflightPersistence(root)).toThrowError(CorruptDataError)
  })

  it.runIf(process.platform !== 'win32')(
    'surfaces missing read permission without rewriting data',
    () => {
      const root = temporaryRoot()
      const path = createDatabase(
        join(root, 'installation.sqlite'),
        currentSchemaVersion
      )
      const before = readFileSync(path)
      chmodSync(path, 0o000)
      try {
        expect(() => preflightPersistence(root)).toThrowError(
          expect.objectContaining({ code: 'EACCES' })
        )
      } finally {
        chmodSync(path, 0o600)
      }
      expect(readFileSync(path)).toEqual(before)
    }
  )

  it('migrates both role Golden Masters and starts ready afterward', () => {
    const root = temporaryRoot()
    const installation = materializeGolden(
      join(root, 'installation.sqlite'),
      'schema-27-installation.sql'
    )
    const campaign = materializeGolden(
      join(root, 'campaigns', 'golden', 'campaign.sqlite'),
      'schema-27-campaign.sql'
    )
    const planned = preflightPersistence(root)

    expect(planned.kind).toBe('migration-required')
    expect(migrationRegistryVersion).toBe(1)
    for (const entry of planned.databases) {
      const database = new Database(entry.path)
      applySchemaMigrations(database, {
        path: entry.path,
        role: entry.role
      })
      database.close()
    }

    const restarted = preflightPersistence(root)
    expect(restarted.kind).toBe('ready')
    expect(restarted.databases).toMatchObject([
      { path: campaign, role: 'campaign', schemaVersion: 29 },
      { path: installation, role: 'installation', schemaVersion: 29 }
    ])
    const installationDatabase = new Database(installation)
    expect(
      installationDatabase
        .prepare('SELECT content FROM valuable_installation_data')
        .pluck()
        .get()
    ).toBe('preserve installation')
    expect(
      installationDatabase
        .prepare('SELECT COUNT(*) FROM installation_schema_migration')
        .pluck()
        .get()
    ).toBe(2)
    applySchemaMigrations(installationDatabase, {
      path: installation,
      role: 'installation'
    })
    expect(
      installationDatabase
        .prepare('SELECT COUNT(*) FROM installation_schema_migration')
        .pluck()
        .get()
    ).toBe(2)
    installationDatabase.close()
  })
})

describe('schema migration contract', () => {
  const migrations: readonly SchemaMigration[] = [
    {
      id: 'campaign-25-to-26',
      role: 'campaign',
      fromVersion: 25,
      toVersion: 26,
      migrate(database) {
        database.exec('CREATE TABLE migrated_26 (id INTEGER PRIMARY KEY)')
      }
    },
    {
      id: 'campaign-26-to-current',
      role: 'campaign',
      fromVersion: 26,
      toVersion: currentSchemaVersion,
      migrate(database) {
        database.exec('CREATE TABLE migrated_current (id INTEGER PRIMARY KEY)')
      }
    }
  ]

  it('requires one unambiguous forward chain', () => {
    expect(
      resolveSchemaMigrationPath(
        'campaign',
        25,
        currentSchemaVersion,
        migrations
      )
    ).toEqual(migrations)
    expect(
      resolveSchemaMigrationPath(
        'campaign',
        24,
        currentSchemaVersion,
        migrations
      )
    ).toBeNull()
    expect(() =>
      resolveSchemaMigrationPath('campaign', 25, currentSchemaVersion, [
        ...migrations,
        migrations[0]!
      ])
    ).toThrow(/ambiguous/)
  })

  it('applies the complete chain in one SQLite transaction', () => {
    const root = temporaryRoot()
    const path = createDatabase(join(root, 'migration.sqlite'), 25)
    const database = new Database(path)
    applySchemaMigrations(database, { path, role: 'campaign' }, migrations)

    expect(database.pragma('user_version', { simple: true })).toBe(
      currentSchemaVersion
    )
    expect(
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'migrated_%' ORDER BY name"
        )
        .pluck()
        .all()
    ).toEqual(['migrated_26', 'migrated_current'])
    database.close()
  })

  it('rolls back every step when a later migration fails', () => {
    const root = temporaryRoot()
    const path = createDatabase(join(root, 'failed.sqlite'), 26)
    const database = new Database(path)
    const failing: readonly SchemaMigration[] = [
      {
        id: 'installation-26-to-27-test',
        role: 'installation',
        fromVersion: 26,
        toVersion: 27,
        migrate(target) {
          target.exec('CREATE TABLE should_rollback (id INTEGER PRIMARY KEY)')
        }
      },
      {
        id: 'installation-27-to-28-failure',
        role: 'installation',
        fromVersion: 27,
        toVersion: currentSchemaVersion,
        migrate() {
          throw new Error('injected migration failure')
        }
      }
    ]

    expect(() =>
      applySchemaMigrations(database, { path, role: 'installation' }, failing)
    ).toThrow(/injected/)
    expect(database.pragma('user_version', { simple: true })).toBe(26)
    expect(
      database
        .prepare(
          "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'should_rollback'"
        )
        .get()
    ).toBeUndefined()
    database.close()
  })
})

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-preflight-'))
  roots.push(root)
  return root
}

function createDatabase(path: string, version: number): string {
  mkdirSync(dirname(path), { recursive: true })
  const database = new Database(path)
  database.exec('CREATE TABLE valuable (content TEXT NOT NULL)')
  database.prepare('INSERT INTO valuable VALUES (?)').run('preserve me')
  database.pragma(`user_version = ${version}`)
  database.close()
  return path
}

function materializeGolden(path: string, file: string): string {
  mkdirSync(dirname(path), { recursive: true })
  const database = new Database(path)
  database.exec(
    readFileSync(join('tests', 'golden', 'persistence', file), 'utf8')
  )
  database.close()
  return path
}

function snapshotTree(root: string): Readonly<Record<string, string>> {
  const result: Record<string, string> = {}
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) visit(path)
      else
        result[path.slice(root.length + 1)] =
          readFileSync(path).toString('base64')
    }
  }
  visit(root)
  return result
}
