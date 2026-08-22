import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import {
  advanceLocalAppInstallation,
  installLocalApp,
  LocalInstallCrashForTest,
  localInstallationPaths,
  LocalInstallationError,
  type InstallLocalAppOptions
} from '../../scripts/local-app-installation.js'
import type { BuildInfo } from '../../src/shared/contracts/build-info.js'
import { campaignDataHash } from '../../scripts/local-installation/campaign-backup.js'
import {
  schemaMigrations,
  type SchemaMigration
} from '../../src/core/persistence/sqlite/schema-migrations.js'
import { databaseSchemaVersions } from '../../src/core/persistence/sqlite/database.js'

const roots: string[] = []
const schemaVersion = databaseSchemaVersions.installation

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('local AppImage installation', () => {
  it('advances backup, deployment and activation idempotently', () => {
    const fixture = createFixture(build('a'))
    const paths = localInstallationPaths(fixture.xdg)
    createDatabase(paths.campaignData, schemaVersion)

    const backup = advanceLocalAppInstallation(
      fixture.options,
      'backup-created'
    )
    expect(backup.backupManifestSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(existsSync(paths.appImage)).toBe(false)
    const backupCount = readdirSync(paths.backups).length

    const repeated = advanceLocalAppInstallation(
      fixture.options,
      'backup-created'
    )
    expect(repeated.backupPath).toBe(backup.backupPath)
    expect(readdirSync(paths.backups)).toHaveLength(backupCount)

    const staged = advanceLocalAppInstallation(
      fixture.options,
      'deployment-staged'
    )
    expect(staged.deploymentManifestSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(existsSync(paths.appImage)).toBe(false)

    const activated = advanceLocalAppInstallation(fixture.options, 'activated')
    expect(activated.installedSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(readFileSync(paths.appImage, 'utf8')).toBe('artifact-a')
  })

  it('does not retain sidecars created while validating a WAL campaign backup', () => {
    const fixture = createFixture(build('a'))
    const paths = localInstallationPaths(fixture.xdg)
    createDatabase(paths.campaignData, schemaVersion)
    const campaignDirectory = join(
      paths.campaignData,
      'campaigns',
      '00000000-0000-4000-8000-000000000001'
    )
    const campaignPath = createDatabase(
      campaignDirectory,
      databaseSchemaVersions.campaign,
      true,
      'campaign.sqlite'
    )
    expect(existsSync(`${campaignPath}-shm`)).toBe(false)
    expect(existsSync(`${campaignPath}-wal`)).toBe(false)

    const backup = advanceLocalAppInstallation(
      fixture.options,
      'backup-created'
    )
    const backupCampaign = join(
      backup.backupPath!,
      relative(paths.campaignData, campaignPath)
    )
    expect(existsSync(`${backupCampaign}-shm`)).toBe(false)
    expect(existsSync(`${backupCampaign}-wal`)).toBe(false)

    const repeated = advanceLocalAppInstallation(
      fixture.options,
      'backup-created'
    )
    expect(repeated.backupPath).toBe(backup.backupPath)
  })

  it('does not treat disposable SQLite sidecars as campaign data changes', () => {
    const fixture = createFixture(build('a'))
    const paths = localInstallationPaths(fixture.xdg)
    const databasePath = createDatabase(paths.campaignData, schemaVersion, true)
    const before = campaignDataHash(paths)

    const database = new Database(databasePath, {
      readonly: true,
      fileMustExist: true
    })
    try {
      expect(database.pragma('quick_check')).toEqual([{ quick_check: 'ok' }])
    } finally {
      database.close()
    }

    expect(existsSync(`${databasePath}-shm`)).toBe(true)
    expect(existsSync(`${databasePath}-wal`)).toBe(true)
    expect(readFileSync(`${databasePath}-wal`)).toHaveLength(0)
    expect(campaignDataHash(paths)).toBe(before)
  })

  it('captures committed WAL data in one standalone SQLite snapshot', () => {
    const fixture = createFixture(build('a'))
    const paths = localInstallationPaths(fixture.xdg)
    createDatabase(paths.campaignData, schemaVersion)
    const campaignDirectory = join(
      paths.campaignData,
      'campaigns',
      '00000000-0000-4000-8000-000000000001'
    )
    const campaignPath = createDatabase(
      campaignDirectory,
      databaseSchemaVersions.campaign,
      true,
      'campaign.sqlite'
    )
    const writer = new Database(campaignPath)
    try {
      writer.pragma('wal_autocheckpoint = 0')
      writer.prepare('INSERT INTO valuable VALUES (?)').run('still in WAL')
      expect(existsSync(`${campaignPath}-shm`)).toBe(true)
      expect(existsSync(`${campaignPath}-wal`)).toBe(true)

      const backup = advanceLocalAppInstallation(
        fixture.options,
        'backup-created'
      )
      const backupCampaign = join(
        backup.backupPath!,
        relative(paths.campaignData, campaignPath)
      )
      expect(existsSync(`${backupCampaign}-shm`)).toBe(false)
      expect(existsSync(`${backupCampaign}-wal`)).toBe(false)
      const snapshot = new Database(backupCampaign, {
        readonly: true,
        fileMustExist: true
      })
      try {
        expect(
          snapshot.prepare('SELECT content FROM valuable').pluck().all()
        ).toContain('still in WAL')
      } finally {
        snapshot.close()
      }

      const repeated = advanceLocalAppInstallation(
        fixture.options,
        'backup-created'
      )
      expect(repeated.backupPath).toBe(backup.backupPath)
    } finally {
      writer.close()
    }
  })

  it('invalidates a backup checkpoint when campaign data changes', () => {
    const fixture = createFixture(build('a'))
    const paths = localInstallationPaths(fixture.xdg)
    createDatabase(paths.campaignData, schemaVersion)
    const first = advanceLocalAppInstallation(fixture.options, 'backup-created')
    writeFileSync(join(paths.campaignData, 'after-backup.txt'), 'changed')

    const second = advanceLocalAppInstallation(
      fixture.options,
      'deployment-staged'
    )
    expect(second.sourceDataHash).not.toBe(first.sourceDataHash)
    expect(second.backupPath).not.toBe(first.backupPath)
    expect(readdirSync(paths.backups)).toHaveLength(2)
  })

  it('invalidates a backup checkpoint when verified backup bytes change', () => {
    const fixture = createFixture(build('a'))
    const paths = localInstallationPaths(fixture.xdg)
    createDatabase(paths.campaignData, schemaVersion)
    const first = advanceLocalAppInstallation(fixture.options, 'backup-created')
    writeFileSync(join(first.backupPath!, 'installation.sqlite'), 'tampered')

    const second = advanceLocalAppInstallation(
      fixture.options,
      'deployment-staged'
    )
    expect(second.backupPath).not.toBe(first.backupPath)
    expect(readdirSync(paths.backups)).toHaveLength(2)
  })

  it('repairs changed activation metadata without repeating the backup', () => {
    const fixture = createFixture(build('a'))
    createDatabase(
      localInstallationPaths(fixture.xdg).campaignData,
      schemaVersion
    )
    const first = installLocalApp(fixture.options)
    const backupCount = readdirSync(first.paths.backups).length
    writeFileSync(first.paths.desktopEntry, 'tampered')

    const repaired = advanceLocalAppInstallation(fixture.options, 'activated')

    expect(readFileSync(repaired.paths.desktopEntry, 'utf8')).toContain(
      `SaltMarcher Local (${'a'.repeat(12)})`
    )
    expect(readFileSync(repaired.paths.appImage, 'utf8')).toBe('artifact-a')
    expect(repaired.backupPath).toBe(first.backupPath)
    expect(readdirSync(first.paths.backups)).toHaveLength(backupCount)
  })

  it('rejects an obsolete v1 install journal without rewriting it', () => {
    const fixture = createFixture(build('a'))
    const paths = localInstallationPaths(fixture.xdg)
    mkdirSync(paths.root, { recursive: true })
    const legacy = JSON.stringify({
      formatVersion: 1,
      transactionId: '00000000-0000-4000-8000-000000000001',
      buildFingerprint: '9'.repeat(64),
      phase: 'completed',
      backupPath: null,
      deploymentPath: null,
      migration: null,
      replacements: [],
      createdAt: '2026-08-15T11:00:00.000Z',
      updatedAt: '2026-08-15T11:00:00.000Z'
    })
    writeFileSync(paths.journal, legacy)

    expect(() => installLocalApp(fixture.options)).toThrow(
      'Unsupported localInstallJournal formatVersion 1; expected 2'
    )
    expect(readFileSync(paths.journal, 'utf8')).toBe(legacy)
  })

  it('installs a fresh build into an isolated profile', () => {
    const fixture = createFixture(build('a'))
    const result = installLocalApp(fixture.options)

    expect(readFileSync(result.paths.appImage, 'utf8')).toBe('artifact-a')
    expect(readFileSync(result.paths.desktopEntry, 'utf8')).toContain(
      `--user-data-dir="${result.paths.profile}"`
    )
    expect(readFileSync(result.paths.desktopEntry, 'utf8')).toContain(
      `SaltMarcher Local (${'a'.repeat(12)})`
    )
    expect(result.paths.icon).toContain('/hicolor/256x256/apps/')
    expect(existsSync(result.paths.profile)).toBe(true)
    expect(existsSync(result.paths.campaignData)).toBe(false)
    expect(result.backupPath).toBeUndefined()
  })

  it('backs up and hashes valuable data on every update without deleting old backups', () => {
    const fixture = createFixture(build('a'))
    const first = installLocalApp(fixture.options)
    const databasePath = createDatabase(first.paths.campaignData, schemaVersion)
    writeFileSync(join(first.paths.campaignData, 'notes.txt'), 'valuable')
    const originalDatabase = readFileSync(databasePath)

    fixture.useBuild(build('b'))
    const second = installLocalApp(fixture.options)
    expect(second.backupPath).toBeDefined()
    const backupDatabase = readFileSync(
      join(second.backupPath!, 'installation.sqlite')
    )
    expect(backupDatabase).not.toHaveLength(0)
    const backupManifest = JSON.parse(
      readFileSync(join(second.backupPath!, 'backup-manifest.json'), 'utf8')
    ) as {
      formatVersion: number
      snapshotMethod: string
      files: Array<{ path: string; bytes: number; sha256: string }>
    }
    expect(backupManifest).toMatchObject({
      formatVersion: 2,
      snapshotMethod: 'sqlite-online-backup'
    })
    expect(backupManifest.files).toContainEqual({
      path: 'installation.sqlite',
      bytes: backupDatabase.length,
      sha256: hash(backupDatabase)
    })
    expect(backupManifest.files).toContainEqual({
      path: 'notes.txt',
      bytes: 8,
      sha256: hash(Buffer.from('valuable'))
    })

    fixture.useBuild(build('c'))
    installLocalApp(fixture.options)
    expect(
      readdirSync(second.paths.backups).filter(
        (entry) => !entry.startsWith('.staging-')
      )
    ).toHaveLength(2)
    expect(readFileSync(databasePath)).toEqual(originalDatabase)
  })

  it('rejects obsolete v1 installed-build provenance', () => {
    const fixture = createFixture(build('a'))
    const first = installLocalApp(fixture.options)
    createDatabase(first.paths.campaignData, schemaVersion)
    const legacy = JSON.stringify({
      formatVersion: 1,
      artifactFile: 'SaltMarcher-Local-0.1.0.AppImage',
      artifactSha256: 'e'.repeat(64),
      build: {
        channel: 'local',
        commit: 'a'.repeat(40),
        sourceFingerprint: 'a'.repeat(64),
        dirty: true,
        builtAt: '2026-08-14T12:00:00.000Z',
        schemaVersion: 27
      }
    })
    writeFileSync(first.paths.installedManifest, legacy)
    fixture.useBuild(build('b'))

    expect(() => installLocalApp(fixture.options)).toThrow(
      'Unsupported localArtifactManifest formatVersion 1; expected 2'
    )
    expect(readFileSync(first.paths.installedManifest, 'utf8')).toBe(legacy)
    expect(readFileSync(first.paths.appImage, 'utf8')).toBe('artifact-a')
  })

  it('keeps immutable versioned deployments and switches one current link', () => {
    const fixture = createFixture(build('a'))
    const first = installLocalApp(fixture.options)
    fixture.useBuild(build('b'))
    const second = installLocalApp(fixture.options)

    expect(
      readdirSync(second.paths.deployments).filter(
        (entry) => !entry.startsWith('.staging-')
      )
    ).toEqual(['a'.repeat(64), 'b'.repeat(64)])
    expect(readlinkSync(second.paths.current)).toBe(
      join('deployments', 'b'.repeat(64))
    )
    expect(readFileSync(first.paths.appImage, 'utf8')).toBe('artifact-b')
  })

  it('rejects a stale artifact before creating an installation', () => {
    const fixture = createFixture(build('a'))
    fixture.options = {
      ...fixture.options,
      readWorkspaceIdentity: () => identity(build('b'))
    }

    expectFailure(() => installLocalApp(fixture.options), 'stale-build')
    expect(existsSync(localInstallationPaths(fixture.xdg).appImage)).toBe(false)
  })

  it('rejects installation while the installed AppImage is running', () => {
    const fixture = createFixture(build('a'))
    fixture.options = { ...fixture.options, isAppRunning: () => true }

    expectFailure(() => installLocalApp(fixture.options), 'app-running')
    expect(existsSync(localInstallationPaths(fixture.xdg).appImage)).toBe(false)
  })

  it('refuses concurrent installation while the exclusive lock is held', () => {
    const fixture = createFixture(build('a'))
    const paths = localInstallationPaths(fixture.xdg)
    mkdirSync(paths.root, { recursive: true })
    writeFileSync(paths.lock, 'held')

    expectFailure(() => installLocalApp(fixture.options), 'installation-locked')
    expect(readFileSync(paths.lock, 'utf8')).toBe('held')
    expect(existsSync(paths.appImage)).toBe(false)
  })

  it('rejects a corrupt SQLite database without changing data or the app', () => {
    const fixture = createFixture(build('a'))
    const paths = localInstallationPaths(fixture.xdg)
    mkdirSync(paths.campaignData, { recursive: true })
    const databasePath = join(paths.campaignData, 'campaign.sqlite')
    writeFileSync(databasePath, 'not sqlite')
    mkdirSync(paths.current, { recursive: true })
    writeFileSync(paths.appImage, 'existing-app')

    expectFailure(() => installLocalApp(fixture.options), 'data-corrupt')
    expect(readFileSync(databasePath, 'utf8')).toBe('not sqlite')
    expect(readFileSync(paths.appImage, 'utf8')).toBe('existing-app')
  })

  it('refuses a schema change when no tested migration exists', () => {
    const fixture = createFixture(build('a'))
    const paths = localInstallationPaths(fixture.xdg)
    const earliestInstallationSchema = Math.min(
      ...schemaMigrations
        .filter((migration) => migration.role === 'installation')
        .map((migration) => migration.fromVersion)
    )
    const databasePath = createDatabase(
      paths.campaignData,
      earliestInstallationSchema - 1
    )
    const before = readFileSync(databasePath)

    expectFailure(() => installLocalApp(fixture.options), 'migration-missing')
    expect(readFileSync(databasePath)).toEqual(before)
    expect(existsSync(paths.appImage)).toBe(false)
  })

  it('migrates a staged copy and preserves a permanent pre-migration backup', () => {
    const fixture = createFixture(build('a'))
    const paths = localInstallationPaths(fixture.xdg)
    const databasePath = createDatabase(paths.campaignData, schemaVersion - 1)
    const migration: SchemaMigration = {
      id: 'installation-test-migration',
      role: 'installation',
      fromVersion: schemaVersion - 1,
      toVersion: schemaVersion,
      migrate(database) {
        database.exec('CREATE TABLE migrated (value TEXT NOT NULL)')
      }
    }
    fixture.options = {
      ...fixture.options,
      schemaMigrations: [migration]
    }

    const result = installLocalApp(fixture.options)

    expect(result.backupPath).toBeDefined()
    const repeated = installLocalApp(fixture.options)
    expect(repeated.backupPath).toBe(result.backupPath)
    expect(readdirSync(paths.backups)).toHaveLength(1)
    const database = new Database(databasePath, { readonly: true })
    expect(database.pragma('user_version', { simple: true })).toBe(
      schemaVersion
    )
    expect(
      database
        .prepare("SELECT name FROM sqlite_master WHERE name = 'migrated'")
        .pluck()
        .get()
    ).toBe('migrated')
    expect(database.prepare('SELECT content FROM valuable').pluck().get()).toBe(
      'preserve me'
    )
    database.close()
    const backupDatabase = new Database(
      join(result.backupPath!, 'installation.sqlite'),
      { readonly: true }
    )
    expect(backupDatabase.pragma('user_version', { simple: true })).toBe(
      schemaVersion - 1
    )
    backupDatabase.close()
  })

  it('rolls back every installed file when an atomic promotion fails', () => {
    const fixture = createFixture(build('a'))
    const first = installLocalApp(fixture.options)
    const databasePath = createDatabase(first.paths.campaignData, schemaVersion)
    const beforeData = readFileSync(databasePath)
    const before = {
      app: readFileSync(first.paths.appImage),
      icon: readFileSync(first.paths.icon),
      desktop: readFileSync(first.paths.desktopEntry),
      manifest: readFileSync(first.paths.installedManifest)
    }
    fixture.useBuild(build('b'))
    let renames = 0
    fixture.options = {
      ...fixture.options,
      renameForInstall: (source, target) => {
        renames += 1
        if (renames === 6) throw new Error('injected rename failure')
        renameSync(source, target)
      }
    }

    expectFailure(
      () => installLocalApp(fixture.options),
      'atomic-replace-failed'
    )
    expect(readFileSync(first.paths.appImage)).toEqual(before.app)
    expect(readFileSync(first.paths.icon)).toEqual(before.icon)
    expect(readFileSync(first.paths.desktopEntry)).toEqual(before.desktop)
    expect(readFileSync(first.paths.installedManifest)).toEqual(before.manifest)
    expect(readFileSync(databasePath)).toEqual(beforeData)
    expect(
      readdirSync(first.paths.root).some((entry) =>
        entry.includes('.rollback-')
      )
    ).toBe(false)
  })

  it.each([
    ['backup-complete', 1],
    ['deployment-staged', 1],
    ['files-staged', 1],
    ['files-promoting', 1],
    ['files-promoting', 2],
    ['files-promoting', 3],
    ['files-promoting', 4],
    ['files-promoting', 5],
    ['files-promoting', 6]
  ] as const)(
    'recovers a simulated process crash at %s occurrence %i on the next run',
    (phase, occurrence) => {
      const fixture = createFixture(build('a'))
      const first = installLocalApp(fixture.options)
      const databasePath = createDatabase(
        first.paths.campaignData,
        schemaVersion
      )
      const databaseBefore = readFileSync(databasePath)
      fixture.useBuild(build('b'))
      let seen = 0
      fixture.options = {
        ...fixture.options,
        afterJournalWriteForTest: (journal) => {
          if (journal.phase !== phase) return
          seen += 1
          if (seen === occurrence) throw new LocalInstallCrashForTest('crash')
        }
      }

      expect(() => installLocalApp(fixture.options)).toThrowError(
        LocalInstallCrashForTest
      )
      const { afterJournalWriteForTest: _crashHook, ...withoutCrashHook } =
        fixture.options
      void _crashHook
      fixture.options = withoutCrashHook
      const recovered = installLocalApp(fixture.options)

      expect(readFileSync(recovered.paths.appImage, 'utf8')).toBe('artifact-b')
      expect(readFileSync(databasePath)).toEqual(databaseBefore)
      expect(
        JSON.parse(readFileSync(recovered.paths.journal, 'utf8'))
      ).toMatchObject({ phase: 'completed', buildFingerprint: 'b'.repeat(64) })
      expect(findTransactionDebris(fixture.xdg)).toEqual([])
    }
  )

  it.each([
    'migration-staged',
    'data-rollback-created',
    'data-promoted'
  ] as const)(
    'recovers a simulated migration crash at %s without losing data',
    (phase) => {
      const fixture = createFixture(build('a'))
      const paths = localInstallationPaths(fixture.xdg)
      const databasePath = createDatabase(paths.campaignData, schemaVersion - 1)
      fixture.options = {
        ...fixture.options,
        afterJournalWriteForTest: (journal) => {
          if (journal.phase === phase)
            throw new LocalInstallCrashForTest('crash')
        }
      }

      expect(() => installLocalApp(fixture.options)).toThrowError(
        LocalInstallCrashForTest
      )
      const { afterJournalWriteForTest: _crashHook, ...withoutCrashHook } =
        fixture.options
      void _crashHook
      fixture.options = withoutCrashHook
      const recovered = installLocalApp(fixture.options)

      const database = new Database(databasePath, { readonly: true })
      expect(database.pragma('user_version', { simple: true })).toBe(
        schemaVersion
      )
      expect(
        database.prepare('SELECT content FROM valuable').pluck().get()
      ).toBe('preserve me')
      database.close()
      expect(readFileSync(recovered.paths.appImage, 'utf8')).toBe('artifact-a')
      expect(findTransactionDebris(fixture.xdg)).toEqual([])
    }
  )
})

function createFixture(initialBuild: BuildInfo): {
  readonly xdg: string
  options: InstallLocalAppOptions
  useBuild: (next: BuildInfo) => void
} {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-installer-'))
  roots.push(root)
  const workspaceRoot = join(root, 'workspace')
  const xdg = join(root, 'xdg')
  const release = join(workspaceRoot, 'release')
  const resources = join(workspaceRoot, 'resources')
  mkdirSync(release, { recursive: true })
  mkdirSync(resources, { recursive: true })
  const artifactPath = join(release, 'SaltMarcher-Local-0.1.0.AppImage')
  const artifactManifestPath = `${artifactPath}.manifest.json`
  const iconSourcePath = join(resources, 'icon.png')
  writeFileSync(iconSourcePath, 'icon-a')
  let currentBuild = initialBuild
  const fixture = {
    xdg,
    options: {} as InstallLocalAppOptions,
    useBuild(next: BuildInfo) {
      currentBuild = next
      writeArtifact(artifactPath, artifactManifestPath, next)
      writeFileSync(iconSourcePath, `icon-${next.workspaceFingerprint[0]}`)
      fixture.options = {
        ...fixture.options,
        readWorkspaceIdentity: () => identity(currentBuild)
      }
    }
  }
  fixture.options = {
    workspaceRoot,
    xdgDataHome: xdg,
    artifactPath,
    artifactManifestPath,
    iconSourcePath,
    readWorkspaceIdentity: () => identity(currentBuild),
    isAppRunning: () => false,
    now: () => new Date('2026-08-15T12:00:00.000Z')
  }
  fixture.useBuild(initialBuild)
  return fixture
}

function writeArtifact(
  artifactPath: string,
  manifestPath: string,
  buildInfo: BuildInfo
): void {
  const content = `artifact-${buildInfo.workspaceFingerprint[0]}`
  const receipt = {
    formatVersion: 2 as const,
    build: buildInfo,
    outputHash: 'f'.repeat(64),
    files: []
  }
  writeFileSync(artifactPath, content)
  writeFileSync(
    manifestPath,
    JSON.stringify({
      formatVersion: 2,
      artifactFile: 'SaltMarcher-Local-0.1.0.AppImage',
      artifactSha256: hash(Buffer.from(content)),
      receiptSha256: createHash('sha256')
        .update(JSON.stringify(receipt))
        .digest('hex'),
      receipt
    })
  )
}

function build(character: string): BuildInfo {
  return {
    channel: 'local',
    commit: character.repeat(40),
    dirty: true,
    workspaceFingerprint: character.repeat(64),
    appBuildInputFingerprint: character.repeat(64),
    builtAt: '2026-08-15T12:00:00.000Z',
    schemaVersions: databaseSchemaVersions,
    migrationRegistryVersion: 1,
    toolchain: {
      node: 'v22.19.0',
      pnpm: '10.15.1',
      electron: '43.2.0',
      electronVite: '5.0.0',
      electronBuilder: '26.15.3',
      platform: 'linux',
      arch: 'x64'
    }
  }
}

function identity(buildInfo: BuildInfo) {
  return {
    commit: buildInfo.commit,
    dirty: buildInfo.dirty,
    workspaceFingerprint: buildInfo.workspaceFingerprint,
    appBuildInputFingerprint: buildInfo.appBuildInputFingerprint
  }
}

function createDatabase(
  root: string,
  version: number,
  writeAheadLog = false,
  filename = 'installation.sqlite'
): string {
  mkdirSync(root, { recursive: true })
  const path = join(root, filename)
  const database = new Database(path)
  database.exec('CREATE TABLE valuable (content TEXT NOT NULL)')
  database.prepare('INSERT INTO valuable VALUES (?)').run('preserve me')
  database.pragma(`user_version = ${version}`)
  if (writeAheadLog) database.pragma('journal_mode = WAL')
  database.close()
  return path
}

function hash(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex')
}

function findTransactionDebris(root: string): string[] {
  if (!existsSync(root)) return []
  const debris: string[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) debris.push(...findTransactionDebris(path))
    if (
      entry.name.includes('.install-') ||
      entry.name.includes('.rollback-') ||
      entry.name.startsWith('.staging-') ||
      entry.name === '.campaign-data.migration' ||
      entry.name === '.campaign-data.rollback'
    )
      debris.push(path)
  }
  return debris.sort()
}

function expectFailure(
  operation: () => unknown,
  code: LocalInstallationError['code']
): void {
  try {
    operation()
  } catch (error) {
    expect(error).toBeInstanceOf(LocalInstallationError)
    expect((error as LocalInstallationError).code).toBe(code)
    return
  }
  throw new Error(`Expected installation failure ${code}`)
}
