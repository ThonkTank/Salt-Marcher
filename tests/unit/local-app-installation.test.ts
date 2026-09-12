import { installationPhaseEvidence } from '../../scripts/installation-phase-evidence.js'
import { defaultSessionLayoutPreference } from '../../src/shared/contracts/session-layout.js'
import { ProfileMaintenance } from '../../src/core/maintenance/profile-maintenance.js'
import { withLaunchReservation } from '../../src/main/local-profile/launch-reservation.js'
import { randomUUID } from 'node:crypto'
import { adoptLegacyLocalMaintenance } from '../../scripts/local-installation/legacy-maintenance.js'
import {
  readInstallJournal,
  writeInstallJournal
} from '../../scripts/local-install-journal.js'
import { desktopIntegration } from '../../scripts/local-installation/deployment.js'
import { MaintenanceCoordinator } from '../../src/shared/maintenance/coordinator.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { createHash } from 'node:crypto'
import {
  existsSync,
  cpSync,
  symlinkSync,
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
import { basename, dirname, join, relative } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import {
  advanceLocalAppInstallation,
  inspectLocalAppInstallation,
  installLocalApp as activateLocalApp,
  LocalInstallCrashForTest,
  localInstallationPaths,
  LocalInstallationError,
  type InstallLocalAppOptions
} from '../../scripts/local-app-installation.js'
import type { BuildInfo } from '../../src/shared/contracts/build-info.js'
import {
  campaignDataHash,
  backupPayload,
  completeBackupPayload
} from '../../scripts/local-installation/campaign-backup.js'
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

// Simulates successful target-runtime acceptance; runtime identity/readback
// barriers have their own tests. Subsequent writes represent normal app use.
function installAndAccept(options: InstallLocalAppOptions) {
  const result = activateLocalApp(options)
  const coordinator = new MaintenanceCoordinator(result.paths.root)
  const state = coordinator.read()
  if (state?.phase === 'awaiting-start') coordinator.commit(state.id)
  return result
}

describe('local AppImage installation', () => {
  it('keeps every installation phase proof stable after later steps and runtime acceptance', () => {
    const fixture = createFixture(build('a'))
    const targets = [
      'backup-created',
      'deployment-staged',
      'activated'
    ] as const
    const proofs = targets.map((target) =>
      installationPhaseEvidence(
        advanceLocalAppInstallation(fixture.options, target),
        target
      )
    )
    expect(proofs[0]!.deploymentManifestSha256).toBeNull()
    expect(proofs[0]!.installedSha256).toBeNull()
    expect(proofs[1]!.deploymentManifestSha256).not.toBeNull()
    expect(proofs[1]!.installedSha256).toBeNull()
    expect(proofs[2]!.installedSha256).not.toBeNull()
    const paths = localInstallationPaths(fixture.xdg)
    createDatabase(paths.campaignData, schemaVersion)
    const coordinator = new MaintenanceCoordinator(paths.root)
    coordinator.commit(coordinator.read()!.id)
    for (const [index, target] of targets.entries()) {
      const installed = inspectLocalAppInstallation(fixture.options, target)
      expect(installed).not.toBeNull()
      expect(installationPhaseEvidence(installed!, target)).toEqual(
        proofs[index]
      )
      expect(
        installationPhaseEvidence(
          { ...installed!, sourceDataHash: 'f'.repeat(64) },
          target
        )
      ).not.toEqual(proofs[index])
      expect(
        installationPhaseEvidence(
          { ...installed!, backupManifestSha256: 'f'.repeat(64) },
          target
        )
      ).not.toEqual(proofs[index])
      if (target !== 'backup-created')
        expect(
          installationPhaseEvidence(
            { ...installed!, deploymentManifestSha256: 'f'.repeat(64) },
            target
          )
        ).not.toEqual(proofs[index])
      if (target === 'activated')
        expect(
          installationPhaseEvidence(
            { ...installed!, installedSha256: 'f'.repeat(64) },
            target
          )
        ).not.toEqual(proofs[index])
    }
  })

  it('retains installation evidence after accepted first-start initialization and later work', () => {
    const fixture = createFixture(build('a'))
    const first = activateLocalApp(fixture.options)
    const coordinator = new MaintenanceCoordinator(first.paths.root)
    createDatabase(first.paths.campaignData, schemaVersion)
    writeFileSync(
      join(first.paths.profile, 'settings.json'),
      '{"theme":"dark"}'
    )
    expect(inspectLocalAppInstallation(fixture.options, 'activated')).toBeNull()
    coordinator.commit(coordinator.read()!.id)
    for (const target of [
      'backup-created',
      'deployment-staged',
      'activated'
    ] as const)
      expect(
        inspectLocalAppInstallation(fixture.options, target)?.sourceDataHash
      ).toBe(first.sourceDataHash)
    writeFileSync(join(first.paths.profile, 'later-work.txt'), 'keep this work')
    expect(
      inspectLocalAppInstallation(fixture.options, 'activated')
    ).not.toBeNull()
    expect(
      readFileSync(join(first.paths.profile, 'later-work.txt'), 'utf8')
    ).toBe('keep this work')
    const state = coordinator.read()!
    writeFileSync(
      coordinator.journalPath,
      JSON.stringify({
        ...state,
        next: { ...state.next, version: 'f'.repeat(40) }
      })
    )
    expect(inspectLocalAppInstallation(fixture.options, 'activated')).toBeNull()
  })

  it('rejects damaged retained backups even after accepted profile changes', () => {
    const fixture = createFixture(build('a'))
    const paths = localInstallationPaths(fixture.xdg)
    createDatabase(paths.campaignData, schemaVersion)
    const first = installAndAccept(fixture.options)
    writeFileSync(join(paths.profile, 'later-work.txt'), 'keep this work')
    expect(
      inspectLocalAppInstallation(fixture.options, 'activated')
    ).not.toBeNull()
    writeFileSync(
      join(backupPayload(first.backupPath!), 'installation.sqlite'),
      'damaged'
    )
    for (const target of [
      'backup-created',
      'deployment-staged',
      'activated'
    ] as const)
      expect(inspectLocalAppInstallation(fixture.options, target)).toBeNull()
    expect(readFileSync(join(paths.profile, 'later-work.txt'), 'utf8')).toBe(
      'keep this work'
    )
  })

  it('does not reuse activation evidence contradicted by the common journal', () => {
    const fixture = createFixture(build('a'))
    const first = installAndAccept(fixture.options)
    expect(
      inspectLocalAppInstallation(fixture.options, 'activated')
    ).not.toBeNull()
    const coordinator = new MaintenanceCoordinator(first.paths.root)
    const state = coordinator.read()!
    writeFileSync(
      coordinator.journalPath,
      JSON.stringify({
        ...state,
        phase: 'rolled-back',
        rollbackFrom: 'program-moving'
      })
    )
    expect(inspectLocalAppInstallation(fixture.options, 'activated')).toBeNull()
    writeFileSync(
      coordinator.journalPath,
      JSON.stringify({
        ...state,
        next: { ...state.next, sha256: 'f'.repeat(64) }
      })
    )
    expect(inspectLocalAppInstallation(fixture.options, 'activated')).toBeNull()
  })

  it('repairs a missing stable launcher instead of reusing a stale activation receipt', () => {
    const fixture = createFixture(build('a'))
    const first = installAndAccept(fixture.options)
    rmSync(join(first.paths.root, 'start'))
    expect(inspectLocalAppInstallation(fixture.options, 'activated')).toBeNull()
    installAndAccept(fixture.options)
    expect(
      inspectLocalAppInstallation(fixture.options, 'activated')
    ).not.toBeNull()
    expect(readFileSync(first.paths.desktopEntry, 'utf8')).toContain(
      join(first.paths.root, 'start')
    )
  })

  it('rejects installation during the handover from the desktop launcher to the app', () => {
    const fixture = createFixture(build('a'))
    const paths = localInstallationPaths(fixture.xdg)
    mkdirSync(paths.root, { recursive: true })
    withLaunchReservation(paths.root, () => {
      expectFailure(
        () => installAndAccept(fixture.options),
        'installation-locked'
      )
      expect(existsSync(paths.current)).toBe(false)
    })
    expect(installAndAccept(fixture.options).installedSha256).toBeDefined()
  })

  it('preserves external files and records later profile work in a new complete backup', () => {
    const fixture = createFixture(build('a'))
    const paths = localInstallationPaths(fixture.xdg)
    createDatabase(paths.campaignData, schemaVersion)
    const developmentPath = createDatabase(
      join(paths.profile, 'development-data'),
      schemaVersion
    )
    mkdirSync(join(paths.profile, 'own-assets', 'empty'), { recursive: true })
    writeFileSync(join(paths.profile, 'own-assets', 'map.svg'), 'first map')
    const first = installAndAccept(fixture.options)
    expect(new MaintenanceCoordinator(paths.root).read()?.formatVersion).toBe(3)
    expect(
      readFileSync(
        join(
          completeBackupPayload(first.backupPath!)!,
          'own-assets',
          'map.svg'
        ),
        'utf8'
      )
    ).toBe('first map')
    expect(existsSync(join(paths.profile, 'own-assets', 'empty'))).toBe(true)
    writeFileSync(join(paths.profile, 'own-assets', 'map.svg'), 'later map')
    const development = new Database(developmentPath)
    development
      .prepare('INSERT INTO valuable VALUES (?)')
      .run('later development work')
    development.close()
    const second = installAndAccept(fixture.options)
    expect(second.backupPath).not.toBe(first.backupPath)
    expect(
      readFileSync(
        join(
          completeBackupPayload(second.backupPath!)!,
          'own-assets',
          'map.svg'
        ),
        'utf8'
      )
    ).toBe('later map')
    const copied = new Database(
      join(
        completeBackupPayload(second.backupPath!)!,
        'development-data',
        'installation.sqlite'
      ),
      { readonly: true }
    )
    expect(
      copied.prepare('SELECT content FROM valuable').pluck().all()
    ).toContain('later development work')
    copied.close()
    expect(
      readFileSync(join(paths.profile, 'own-assets', 'map.svg'), 'utf8')
    ).toBe('later map')
  })

  it('upgrades a resumed campaign-only backup checkpoint without deleting its evidence', async () => {
    const fixture = createFixture(build('a'))
    const paths = localInstallationPaths(fixture.xdg)
    createDatabase(paths.campaignData, schemaVersion)
    writeFileSync(join(paths.profile, 'custom.txt'), 'outside campaign data')
    const initial = advanceLocalAppInstallation(
      fixture.options,
      'backup-created'
    )
    const legacyId = await new ProfileMaintenance(paths.root, 'legacy').backup()
    const legacyPath = join(paths.backups, legacyId!)
    const legacyProof = JSON.parse(
      readFileSync(join(initial.backupPath!, 'backup-manifest.json'), 'utf8')
    ) as Record<string, unknown>
    delete legacyProof['sourceProfile']
    writeFileSync(
      join(legacyPath, 'backup-manifest.json'),
      JSON.stringify(legacyProof)
    )
    const manifestBefore = readFileSync(join(legacyPath, 'manifest.json'))
    writeInstallJournal(
      paths.journal,
      {
        ...readInstallJournal(paths.journal)!,
        backupPath: legacyPath,
        backupManifestSha256: hash(
          readFileSync(join(legacyPath, 'backup-manifest.json'))
        )
      },
      () => new Date()
    )
    const installed = installAndAccept(fixture.options)
    expect(installed.backupPath).not.toBe(legacyPath)
    expect(completeBackupPayload(installed.backupPath!)).toBeDefined()
    expect(readFileSync(join(legacyPath, 'manifest.json'))).toEqual(
      manifestBefore
    )
    expect(readFileSync(join(paths.profile, 'custom.txt'), 'utf8')).toBe(
      'outside campaign data'
    )
    expect(
      readFileSync(
        join(completeBackupPayload(installed.backupPath!)!, 'custom.txt'),
        'utf8'
      )
    ).toBe('outside campaign data')
  })

  it('stores canonical profile data separately from the Local handoff proof', () => {
    const fixture = createFixture(build('a'))
    const paths = localInstallationPaths(fixture.xdg)
    createDatabase(paths.campaignData, schemaVersion)
    const backup = advanceLocalAppInstallation(
      fixture.options,
      'backup-created'
    )
    expect(backupPayload(backup.backupPath!)).toBe(
      join(backup.backupPath!, 'data', 'campaign-data')
    )
    const manifest = JSON.parse(
      readFileSync(join(backup.backupPath!, 'manifest.json'), 'utf8')
    ) as { version: string; files: Array<{ path: string }> }
    expect(manifest.version).toBe('Local unknown')
    expect(
      manifest.files.some(
        (file) => file.path === 'campaign-data/installation.sqlite'
      )
    ).toBe(true)
    expect(
      manifest.files.some((file) => file.path === 'backup-manifest.json')
    ).toBe(false)
    expect(existsSync(join(backup.backupPath!, 'backup-manifest.json'))).toBe(
      true
    )
  })

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
      backupPayload(backup.backupPath!),
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
        backupPayload(backup.backupPath!),
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
    writeFileSync(
      join(backupPayload(first.backupPath!), 'installation.sqlite'),
      'tampered'
    )

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
    const first = installAndAccept(fixture.options)
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

    expect(() => installAndAccept(fixture.options)).toThrow(
      'Unsupported localInstallJournal formatVersion 1; expected 2'
    )
    expect(readFileSync(paths.journal, 'utf8')).toBe(legacy)
  })

  it('installs a fresh build into an isolated profile', () => {
    const fixture = createFixture(build('a'))
    const result = activateLocalApp(fixture.options)

    expect(readFileSync(result.paths.appImage, 'utf8')).toBe('artifact-a')
    expect(readFileSync(result.paths.desktopEntry, 'utf8')).toContain(
      `--user-data-dir="${result.paths.profile}"`
    )
    expect(readFileSync(result.paths.desktopEntry, 'utf8')).toContain(
      `SaltMarcher Local (${'a'.repeat(12)})`
    )
    expect(result.paths.icon).toContain('/hicolor/256x256/apps/')
    expect(existsSync(result.paths.profile)).toBe(true)
    const initialized = new Database(
      join(result.paths.campaignData, 'installation.sqlite'),
      { readonly: true, fileMustExist: true }
    )
    try {
      expect(initialized.pragma('user_version', { simple: true })).toBe(
        schemaVersion
      )
      expect(
        initialized.prepare('SELECT COUNT(*) AS count FROM campaigns').get()
      ).toEqual({ count: 0 })
      expect(
        initialized
          .prepare(
            'SELECT revision FROM installation_settings WHERE singleton = 1'
          )
          .get()
      ).toEqual({ revision: 0 })
    } finally {
      initialized.close()
    }
    expect(new MaintenanceCoordinator(result.paths.root).read()?.phase).toBe(
      'awaiting-start'
    )
    expect(result.backupPath).toBeUndefined()
  })

  it('backs up and hashes valuable data on every update without deleting old backups', () => {
    const fixture = createFixture(build('a'))
    const first = installAndAccept(fixture.options)
    const databasePath = createDatabase(first.paths.campaignData, schemaVersion)
    writeFileSync(join(first.paths.campaignData, 'notes.txt'), 'valuable')

    fixture.useBuild(build('b'))
    const second = installAndAccept(fixture.options)
    expect(second.backupPath).toBeDefined()
    const backupDatabase = readFileSync(
      join(backupPayload(second.backupPath!), 'installation.sqlite')
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
    installAndAccept(fixture.options)
    expect(
      readdirSync(second.paths.backups).filter(
        (entry) => !entry.startsWith('.staging-')
      )
    ).toHaveLength(2)
    const database = new Database(databasePath, { readonly: true })
    expect(database.prepare('SELECT content FROM valuable').pluck().get()).toBe(
      'preserve me'
    )
    database.close()
    expect(
      readFileSync(join(first.paths.campaignData, 'notes.txt'), 'utf8')
    ).toBe('valuable')
  })

  it('rejects obsolete v1 installed-build provenance', () => {
    const fixture = createFixture(build('a'))
    const first = installAndAccept(fixture.options)
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

    expect(() => installAndAccept(fixture.options)).toThrow(
      'Unsupported localArtifactManifest formatVersion 1; expected 2'
    )
    expect(readFileSync(first.paths.installedManifest, 'utf8')).toBe(legacy)
    expect(readFileSync(first.paths.appImage, 'utf8')).toBe('artifact-a')
  })

  it('keeps immutable versioned deployments and switches one current link', () => {
    const fixture = createFixture(build('a'))
    const first = installAndAccept(fixture.options)
    fixture.useBuild(build('b'))
    const second = installAndAccept(fixture.options)

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

    expectFailure(() => installAndAccept(fixture.options), 'stale-build')
    expect(existsSync(localInstallationPaths(fixture.xdg).appImage)).toBe(false)
  })

  it('rejects installation while the installed AppImage is running', () => {
    const fixture = createFixture(build('a'))
    fixture.options = { ...fixture.options, isAppRunning: () => true }

    expectFailure(() => installAndAccept(fixture.options), 'app-running')
    expect(existsSync(localInstallationPaths(fixture.xdg).appImage)).toBe(false)
  })

  it('refuses concurrent installation while the exclusive lock is held', () => {
    const fixture = createFixture(build('a'))
    const paths = localInstallationPaths(fixture.xdg)
    mkdirSync(paths.root, { recursive: true })
    writeFileSync(paths.lock, 'held')

    expectFailure(
      () => installAndAccept(fixture.options),
      'installation-locked'
    )
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

    expectFailure(() => installAndAccept(fixture.options), 'data-corrupt')
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

    expectFailure(() => installAndAccept(fixture.options), 'migration-missing')
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

    const result = installAndAccept(fixture.options)

    expect(result.backupPath).toBeDefined()
    const repeated = installAndAccept(fixture.options)
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
      join(backupPayload(result.backupPath!), 'installation.sqlite'),
      { readonly: true }
    )
    expect(backupDatabase.pragma('user_version', { simple: true })).toBe(
      schemaVersion - 1
    )
    backupDatabase.close()
  })

  it('rolls back every installed file when an atomic promotion fails', () => {
    const fixture = createFixture(build('a'))
    const first = installAndAccept(fixture.options)
    const databasePath = createDatabase(first.paths.campaignData, schemaVersion)
    const beforeData = readFileSync(databasePath)
    const before = {
      app: readFileSync(first.paths.appImage),
      icon: readFileSync(first.paths.icon),
      desktop: readFileSync(first.paths.desktopEntry),
      manifest: readFileSync(first.paths.installedManifest)
    }
    fixture.useBuild(build('b'))
    fixture.options = {
      ...fixture.options,
      renameForInstall: (source, target) => {
        if (target === first.paths.desktopEntry)
          throw new Error('injected rename failure')
        renameSync(source, target)
      }
    }

    expectFailure(
      () => installAndAccept(fixture.options),
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
    ['prepared', 1],
    ['old-data-moved', 1],
    ['new-data-moved', 1],
    ['integration-0-applied', 1],
    ['integration-1-applied', 1],
    ['program-linked', 1],
    ['awaiting-start', 1]
  ] as const)(
    'recovers a simulated process crash at %s occurrence %i on the next run',
    (phase, occurrence) => {
      const fixture = createFixture(build('a'))
      const first = installAndAccept(fixture.options)
      const databasePath = createDatabase(
        first.paths.campaignData,
        schemaVersion
      )
      writeFileSync(
        join(first.paths.profile, 'own-profile-file.txt'),
        'retain across interruption'
      )
      fixture.useBuild(build('b'))
      let seen = 0
      const interrupt = (boundary: string) => {
        if (boundary !== phase) return
        seen += 1
        if (seen === occurrence) throw new LocalInstallCrashForTest('crash')
      }
      fixture.options = {
        ...fixture.options,
        afterJournalWriteForTest: (journal) => interrupt(journal.phase),
        afterMaintenanceBoundaryForTest: interrupt
      }

      expect(() => installAndAccept(fixture.options)).toThrowError(
        LocalInstallCrashForTest
      )
      const {
        afterJournalWriteForTest: _crashHook,
        afterMaintenanceBoundaryForTest: _maintenanceHook,
        ...withoutCrashHook
      } = fixture.options
      void _crashHook
      void _maintenanceHook
      fixture.options = withoutCrashHook
      const recovered = installAndAccept(fixture.options)
      expect(
        readFileSync(
          join(recovered.paths.profile, 'own-profile-file.txt'),
          'utf8'
        )
      ).toBe('retain across interruption')

      expect(readFileSync(recovered.paths.appImage, 'utf8')).toBe('artifact-b')
      const database = new Database(databasePath, { readonly: true })
      expect(
        database.prepare('SELECT content FROM valuable').pluck().get()
      ).toBe('preserve me')
      database.close()
      expect(
        JSON.parse(readFileSync(recovered.paths.journal, 'utf8'))
      ).toMatchObject({ phase: 'completed', buildFingerprint: 'b'.repeat(64) })
      expect(findTransactionDebris(fixture.xdg)).toEqual([])
    }
  )

  it.each(['prepared', 'old-data-moved', 'new-data-moved'] as const)(
    'recovers a simulated migration crash at %s without losing data',
    (phase) => {
      const fixture = createFixture(build('a'))
      const paths = localInstallationPaths(fixture.xdg)
      // Explicit pre-desktop-settings fault fixture, not current schema relabeled.
      const databasePath = createDatabase(paths.campaignData, 41)
      const legacy = new Database(databasePath)
      legacy
        .prepare(
          'UPDATE installation_settings SET preferences_json = ? WHERE singleton = 1'
        )
        .run(
          JSON.stringify({
            schemaVersion: 1,
            preferences: {
              theme: 'dark',
              sessionLayout: defaultSessionLayoutPreference
            }
          })
        )
      legacy.close()
      fixture.options = {
        ...fixture.options,
        afterMaintenanceBoundaryForTest: (boundary) => {
          if (boundary === phase) throw new LocalInstallCrashForTest('crash')
        }
      }

      expect(() => installAndAccept(fixture.options)).toThrowError(
        LocalInstallCrashForTest
      )
      const {
        afterJournalWriteForTest: _crashHook,
        afterMaintenanceBoundaryForTest: _maintenanceHook,
        ...withoutCrashHook
      } = fixture.options
      void _crashHook
      void _maintenanceHook
      fixture.options = withoutCrashHook
      const recovered = installAndAccept(fixture.options)

      const database = new Database(databasePath, { readonly: true })
      expect(database.pragma('user_version', { simple: true })).toBe(
        schemaVersion
      )
      expect(
        database.prepare('SELECT content FROM valuable').pluck().get()
      ).toBe('preserve me')
      database.close()
      const settings = new Database(databasePath, { readonly: true })
      expect(
        settings
          .prepare(
            "SELECT json_extract(preferences_json, '$.preferences.theme') FROM installation_settings"
          )
          .pluck()
          .get()
      ).toBe('dark')
      settings.close()
      expect(readFileSync(recovered.paths.appImage, 'utf8')).toBe('artifact-a')
      expect(findTransactionDebris(fixture.xdg)).toEqual([])
    }
  )
})

describe('legacy Local maintenance admission', () => {
  it.each([
    'files-staged',
    'old-0',
    'old-1',
    'old-2',
    'new-0',
    'new-1',
    'new-2'
  ])('recovers the old program, data and desktop after %s', (boundary) => {
    const legacy = createLegacyInterruption(boundary)
    adoptLegacyLocalMaintenance(legacy.paths, legacy.journal)
    const coordinator = new MaintenanceCoordinator(legacy.paths.root)
    expect(coordinator.read()?.phase).toBe('rollback-started')
    expect(readFileSync(legacy.database)).not.toEqual(legacy.original)
    coordinator.rollback()
    coordinator.rollback()
    expect(readFileSync(legacy.database)).toEqual(legacy.original)
    expect(readFileSync(legacy.paths.appImage, 'utf8')).toBe('artifact-a')
    expect(readFileSync(legacy.paths.desktopEntry, 'utf8')).toContain(
      'a'.repeat(12)
    )
    expect(existsSync(legacy.journal.migration.rollback)).toBe(true)
    expect(
      existsSync(
        join(legacy.paths.root, `failed-${legacy.journal.transactionId}`)
      )
    ).toBe(true)
  })
  it('resumes common rollback after interruption without reinterpreting the legacy journal', () => {
    const legacy = createLegacyInterruption('new-2')
    adoptLegacyLocalMaintenance(legacy.paths, legacy.journal)
    expect(() =>
      new MaintenanceCoordinator(legacy.paths.root, (boundary) => {
        if (boundary === 'old-data-restored') throw new Error('power loss')
      }).rollback()
    ).toThrow('power loss')
    adoptLegacyLocalMaintenance(legacy.paths, legacy.journal)
    new MaintenanceCoordinator(legacy.paths.root).rollback()
    expect(readFileSync(legacy.database)).toEqual(legacy.original)
    expect(readFileSync(legacy.paths.appImage, 'utf8')).toBe('artifact-a')
  })
  it('continues the installer after adopting an interrupted legacy update', () => {
    const legacy = createLegacyInterruption('old-2')
    const completed = installAndAccept(legacy.fixture.options)
    expect(readFileSync(completed.paths.appImage, 'utf8')).toBe('artifact-b')
    const database = new Database(legacy.database, { readonly: true })
    expect(database.prepare('SELECT content FROM valuable').pluck().get()).toBe(
      'preserve me'
    )
    database.close()
    expect(new MaintenanceCoordinator(legacy.paths.root).read()?.phase).toBe(
      'committed'
    )
    expect(
      existsSync(
        join(
          legacy.paths.root,
          `legacy-local-source-${legacy.journal.transactionId}.json`
        )
      )
    ).toBe(true)
  })
  it('does not guess the old program when its rollback pointer is gone', () => {
    const legacy = createLegacyInterruption('new-2')
    rmSync(legacy.journal.replacements[2]!.rollback!)
    const before = readFileSync(legacy.database)
    expect(() =>
      adoptLegacyLocalMaintenance(legacy.paths, legacy.journal)
    ).toThrow('Rückweg fehlt')
    expect(readFileSync(legacy.database)).toEqual(before)
    expect(new MaintenanceCoordinator(legacy.paths.root).read()).toBeNull()
  })
  it('uses the validated backup when the old installer already removed its data rollback', () => {
    const legacy = createLegacyInterruption('files-staged')
    rmSync(legacy.journal.migration.rollback, { recursive: true })
    adoptLegacyLocalMaintenance(legacy.paths, legacy.journal)
    new MaintenanceCoordinator(legacy.paths.root).rollback()
    const database = new Database(legacy.database, { readonly: true })
    expect(database.prepare('SELECT content FROM valuable').pluck().get()).toBe(
      'preserve me'
    )
    database.close()
    expect(existsSync(legacy.journal.backupPath!)).toBe(true)
  })
  it('does not replace later accepted work from a completed legacy transaction', () => {
    const legacy = createLegacyInterruption('files-staged')
    adoptLegacyLocalMaintenance(legacy.paths, {
      ...legacy.journal,
      phase: 'completed'
    })
    expect(new MaintenanceCoordinator(legacy.paths.root).read()).toBeNull()
    expect(readFileSync(legacy.database)).not.toEqual(legacy.original)
    expect(existsSync(legacy.journal.migration.rollback)).toBe(true)
  })
  it('rejects an escaped legacy path before changing current data', () => {
    const legacy = createLegacyInterruption('files-staged')
    const before = readFileSync(legacy.database)
    expect(() =>
      adoptLegacyLocalMaintenance(legacy.paths, {
        ...legacy.journal,
        migration: {
          ...legacy.journal.migration,
          rollback: join(legacy.paths.root, 'outside')
        }
      })
    ).toThrow('Migrationspfade')
    expect(readFileSync(legacy.database)).toEqual(before)
    expect(new MaintenanceCoordinator(legacy.paths.root).read()).toBeNull()
  })
  it('fails closed when both retained data and the verified backup are missing', () => {
    const legacy = createLegacyInterruption('files-staged')
    const before = readFileSync(legacy.database)
    rmSync(legacy.journal.migration.rollback, { recursive: true })
    expect(() =>
      adoptLegacyLocalMaintenance(legacy.paths, {
        ...legacy.journal,
        backupPath: null
      })
    ).toThrow('Sicherung')
    expect(readFileSync(legacy.database)).toEqual(before)
  })
})

/** Reenacts the old producer's rename-before-journal gaps with real Local fixtures. */
function createLegacyInterruption(boundary: string) {
  const fixture = createFixture(build('a'))
  const first = installAndAccept(fixture.options)
  const paths = first.paths
  const database = createDatabase(paths.campaignData, schemaVersion)
  const original = readFileSync(database)
  fixture.useBuild(build('b'))
  const staged = advanceLocalAppInstallation(
    fixture.options,
    'deployment-staged'
  )
  rmSync(new MaintenanceCoordinator(paths.root).journalPath)
  const sourceJournal = readInstallJournal(paths.journal)!
  const migration = {
    staging: join(paths.profile, '.campaign-data.migration'),
    rollback: join(paths.profile, '.campaign-data.rollback')
  }
  cpSync(paths.campaignData, migration.staging, { recursive: true })
  const nextDatabase = new Database(
    join(migration.staging, 'installation.sqlite')
  )
  nextDatabase
    .prepare('UPDATE valuable SET content = ?')
    .run('changed by legacy migration')
  nextDatabase.close()
  renameSync(paths.campaignData, migration.rollback)
  renameSync(migration.staging, paths.campaignData)
  const token = randomUUID()
  const files = desktopIntegration(
    paths,
    join(staged.deploymentPath!, 'icon.png'),
    build('b')
  )
  let journal = {
    ...sourceJournal,
    migration,
    phase: 'files-staged' as const,
    replacements: [
      ...files.map((file) => {
        const staged = join(
          dirname(file.target),
          `.${basename(file.target)}.install-${token}`
        )
        if (file.source) cpSync(file.source, staged)
        else writeFileSync(staged, file.content!)
        return {
          target: file.target,
          staged,
          rollback: null as string | null,
          state: 'staged' as const
        }
      }),
      {
        target: paths.current,
        staged: join(paths.root, `.current.install-${token}`),
        rollback: null as string | null,
        state: 'staged' as const
      }
    ]
  } satisfies import('../../scripts/local-install-journal.js').LocalInstallJournal
  symlinkSync(
    relative(paths.root, staged.deploymentPath!),
    journal.replacements[2]!.staged
  )
  const persist = () =>
    writeInstallJournal(paths.journal, journal, () => new Date())
  persist()
  if (boundary !== 'files-staged') {
    for (let index = 0; index < journal.replacements.length; index++) {
      const entry = journal.replacements[index]!
      const rollback = join(
        dirname(entry.target),
        `.${basename(entry.target)}.rollback-${token}`
      )
      renameSync(entry.target, rollback)
      if (boundary === `old-${index}`) break
      entry.rollback = rollback
      persist()
    }
    if (boundary.startsWith('new-'))
      for (let index = 0; index < journal.replacements.length; index++) {
        const entry = journal.replacements[index]!
        renameSync(entry.staged, entry.target)
        if (boundary === `new-${index}`) break
        persist()
      }
  }
  journal = readInstallJournal(paths.journal)! as typeof journal
  return { paths, journal, database, original, fixture }
}

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
    readLauncherForTest: () => Buffer.from('// synthetic fixture helper'),
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
  if (filename === 'installation.sqlite' && !existsSync(path)) {
    // Real registry/settings plus a sentinel. Version overrides below are fault
    // fixtures, not proof of historical schema compatibility.
    const installation = new CampaignStore(root)
    installation.close()
  }
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
