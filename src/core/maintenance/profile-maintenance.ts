import { snapshotCompleteProfile } from './complete-profile-snapshot.js'
import { profileBackupSchema as backupSchema } from '../../shared/contracts/profile-backup.js'
import { readVerifiedBackup } from './verified-backup.js'
import { readbackProfile } from '../persistence/sqlite/profile-readback.js'
import { randomUUID } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statfsSync
} from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { z } from 'zod'
import {
  durableJson,
  inventory,
  directoryInventory,
  syncPath,
  syncTree
} from '../../shared/maintenance/files.js'
import { backupSummarySchema } from '../../shared/contracts/release.js'
import {
  migrateProfile,
  snapshotProfile,
  validateProfile
} from './profile-snapshot.js'

export class ProfileMaintenance {
  readonly data: string
  constructor(
    readonly root: string,
    readonly version: string,
    readonly payload: 'campaign-data' | 'profile' = 'campaign-data'
  ) {
    this.data = join(root, 'profile', 'campaign-data')
  }
  get payloadRoot(): string {
    return this.payload === 'profile' ? join(this.root, 'profile') : this.data
  }
  private snapshot(source: string, target: string): Promise<void> {
    return this.payload === 'profile'
      ? snapshotCompleteProfile(source, target)
      : snapshotProfile(source, target)
  }
  async backup(preserveInvalid = false): Promise<string | null> {
    if (!existsSync(this.payloadRoot)) return null
    const required =
      inventory(this.payloadRoot).reduce((sum, file) => sum + file.bytes, 0) *
        2 +
      64 * 1024 * 1024
    const available = statfsSync(this.root)
    if (available.bavail * available.bsize < required)
      throw new Error(
        'Nicht genug freier Speicherplatz für eine vollständige Sicherung.'
      )
    const id = randomUUID()
    mkdirSync(join(this.root, 'backups'), { recursive: true })
    const staged = join(this.root, 'backups', `.pending-${id}`)
    mkdirSync(staged)
    let restorable = true
    try {
      await this.snapshot(this.payloadRoot, join(staged, 'data'))
    } catch (error) {
      if (!preserveInvalid) throw error
      inventory(this.payloadRoot)
      rmSync(join(staged, 'data'), { recursive: true, force: true })
      cpSync(this.payloadRoot, join(staged, 'data'), {
        recursive: true,
        errorOnExist: true,
        force: false
      })
      syncTree(join(staged, 'data'))
      restorable = false
    }
    const manifest = backupSchema.parse({
      formatVersion: this.payload === 'profile' ? 2 : 1,
      ...(this.payload === 'profile'
        ? { directories: directoryInventory(join(staged, 'data')) }
        : {}),
      id,
      createdAt: new Date().toISOString(),
      version: this.version,
      restorable,
      files: inventory(join(staged, 'data'))
    })
    durableJson(join(staged, 'manifest.json'), manifest)
    renameSync(staged, join(this.root, 'backups', id))
    syncPath(join(this.root, 'backups'))
    return id
  }
  backups() {
    if (!existsSync(join(this.root, 'backups'))) return []
    return readdirSync(join(this.root, 'backups'))
      .filter((id) => z.uuid().safeParse(id).success)
      .map((id) => {
        try {
          const manifest = backupSchema.parse(
            JSON.parse(
              readFileSync(
                join(this.root, 'backups', id, 'manifest.json'),
                'utf8'
              )
            )
          )
          const valid =
            manifest.restorable &&
            manifest.id === id &&
            JSON.stringify(manifest.files) ===
              JSON.stringify(
                inventory(join(this.root, 'backups', id, 'data'))
              ) &&
            (manifest.formatVersion === 1 ||
              JSON.stringify(manifest.directories) ===
                JSON.stringify(
                  directoryInventory(join(this.root, 'backups', id, 'data'))
                ))
          return backupSummarySchema.parse({
            id,
            createdAt: manifest.createdAt,
            version: manifest.version,
            bytes: manifest.files.reduce((sum, file) => sum + file.bytes, 0),
            valid,
            scope: manifest.formatVersion === 2 ? 'profile' : 'campaign-data'
          })
        } catch {
          return {
            id,
            createdAt: new Date(0).toISOString(),
            version: '0.0.0',
            bytes: 0,
            valid: false
          }
        }
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
  backupSource(id: string): string {
    z.uuid().parse(id)
    if (!this.backups().some((backup) => backup.id === id && backup.valid))
      throw new Error('Sicherung fehlt oder wurde verändert.')
    return join(this.root, 'backups', id, 'data')
  }
  async importBackup(
    id: string,
    directory: string,
    expectedManifestSha256?: string
  ): Promise<{ id: string; backup: string | null; journalVersion?: 3 }> {
    const source = readVerifiedBackup(directory)
    if (
      expectedManifestSha256 &&
      source.manifestSha256 !== expectedManifestSha256
    )
      throw new Error(
        'Die ausgewählte Sicherung wurde seit der Bestätigung verändert. Bitte erneut auswählen und prüfen.'
      )
    const prepared = await this.prepare(id, source.data)
    if (
      JSON.stringify(readVerifiedBackup(directory).manifest) !==
      JSON.stringify(source.manifest)
    )
      throw new Error('Die Sicherung wurde während der Übernahme verändert.')
    return prepared
  }
  /** Produces a validated working copy; never activates or rolls back live data. */
  async prepare(
    id: string,
    source = this.payloadRoot
  ): Promise<{ id: string; backup: string | null; journalVersion?: 3 }> {
    z.uuid().parse(id)
    const staged = join(this.root, `staged-${id}`)
    if (existsSync(staged))
      throw new Error('Die Arbeitskopie existiert bereits.')
    const bytes = (path: string) =>
      existsSync(path)
        ? inventory(path).reduce((sum, file) => sum + file.bytes, 0)
        : 0
    mkdirSync(this.root, { recursive: true })
    const fs = statfsSync(this.root)
    if (
      fs.bavail * fs.bsize <
      2 * bytes(this.payloadRoot) + 2 * bytes(source) + 64 * 1024 * 1024
    )
      throw new Error(
        'Nicht genug freier Speicherplatz für Sicherung und Migration.'
      )
    const backup = await this.backup(source !== this.payloadRoot)
    if (existsSync(source)) {
      if (source === this.payloadRoot && backup)
        cpSync(this.backupSource(backup), staged, {
          recursive: true,
          errorOnExist: true,
          force: false
        })
      else if (this.payload === 'profile') {
        const descriptor =
          basename(source) === 'data' &&
          existsSync(join(dirname(source), 'manifest.json'))
            ? readVerifiedBackup(dirname(source))
            : undefined
        if (descriptor?.manifest.formatVersion === 2)
          await snapshotCompleteProfile(source, staged)
        else {
          mkdirSync(staged)
          await snapshotProfile(source, join(staged, 'campaign-data'))
        }
      } else {
        const descriptor =
          basename(source) === 'data' &&
          existsSync(join(dirname(source), 'manifest.json'))
            ? readVerifiedBackup(dirname(source))
            : undefined
        if (descriptor?.manifest.formatVersion === 2)
          throw new Error(
            'Diese Sicherung benötigt eine Version mit vollständiger Profilwiederherstellung.'
          )
        await snapshotProfile(source, staged)
      }
    } else mkdirSync(staged)
    if (this.payload === 'profile') {
      migratePreparedCompleteProfile(staged)
      return { id, backup, journalVersion: 3 }
    }
    migratePreparedProfile(staged)
    return { id, backup }
  }
  validate(): void {
    validateProfile(this.data, true)
    readbackProfile(this.data)
    const development = join(this.root, 'profile', 'development-data')
    if (this.payload === 'profile' && existsSync(development)) {
      validateProfile(development, true)
      readbackProfile(development)
    }
  }
}

/** Shared final preparation gate; aggregate owners retain migration SQL. */
export function migratePreparedProfile(
  staged: string,
  migrations?: readonly import('../persistence/sqlite/schema-migrations.js').SchemaMigration[]
): void {
  migrateProfile(staged, migrations)
  readbackProfile(staged)
  syncTree(staged)
}

/** One durable full-profile preparation gate shared by both installation adapters. */
export function migratePreparedCompleteProfile(
  staged: string,
  migrations?: readonly import('../persistence/sqlite/schema-migrations.js').SchemaMigration[]
): void {
  mkdirSync(join(staged, 'campaign-data'), { recursive: true })
  for (const name of ['campaign-data', 'development-data'])
    if (existsSync(join(staged, name)))
      migratePreparedProfile(join(staged, name), migrations)
  syncTree(staged)
}
