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
import { join } from 'node:path'
import { z } from 'zod'
import {
  durableJson,
  inventory,
  syncPath,
  syncTree
} from '../../shared/maintenance/files.js'
import {
  backupSummarySchema,
  releaseVersionSchema
} from '../../shared/contracts/release.js'
import {
  migrateProfile,
  snapshotProfile,
  validateProfile
} from './profile-snapshot.js'

const backupSchema = z
  .object({
    formatVersion: z.literal(1),
    id: z.uuid(),
    createdAt: z.iso.datetime(),
    version: releaseVersionSchema,
    restorable: z.boolean().default(true),
    files: z.array(
      z
        .object({
          path: z.string(),
          bytes: z.number().nonnegative(),
          sha256: z.string()
        })
        .strict()
    )
  })
  .strict()
export class ProfileMaintenance {
  readonly data: string
  constructor(
    readonly root: string,
    readonly version: string
  ) {
    this.data = join(root, 'profile', 'campaign-data')
    mkdirSync(join(root, 'profile'), { recursive: true })
    mkdirSync(join(root, 'backups'), { recursive: true })
  }
  async backup(preserveInvalid = false): Promise<string | null> {
    if (!existsSync(this.data)) return null
    const id = randomUUID()
    const staged = join(this.root, 'backups', `.pending-${id}`)
    mkdirSync(staged)
    let restorable = true
    try {
      await snapshotProfile(this.data, join(staged, 'data'))
    } catch (error) {
      if (!preserveInvalid) throw error
      inventory(this.data)
      rmSync(join(staged, 'data'), { recursive: true, force: true })
      cpSync(this.data, join(staged, 'data'), {
        recursive: true,
        errorOnExist: true,
        force: false
      })
      syncTree(join(staged, 'data'))
      restorable = false
    }
    const manifest = backupSchema.parse({
      formatVersion: 1,
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
              JSON.stringify(inventory(join(this.root, 'backups', id, 'data')))
          return backupSummarySchema.parse({
            id,
            createdAt: manifest.createdAt,
            version: manifest.version,
            bytes: manifest.files.reduce((sum, file) => sum + file.bytes, 0),
            valid
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
  /** Produces a validated working copy; never activates or rolls back live data. */
  async prepare(
    id: string,
    source = this.data
  ): Promise<{ id: string; backup: string | null }> {
    z.uuid().parse(id)
    const staged = join(this.root, `staged-${id}`)
    if (existsSync(staged))
      throw new Error('Die Arbeitskopie existiert bereits.')
    const bytes = (path: string) =>
      existsSync(path)
        ? inventory(path).reduce((sum, file) => sum + file.bytes, 0)
        : 0
    const fs = statfsSync(this.root)
    if (
      fs.bavail * fs.bsize <
      2 * bytes(this.data) + 2 * bytes(source) + 64 * 1024 * 1024
    )
      throw new Error(
        'Nicht genug freier Speicherplatz für Sicherung und Migration.'
      )
    const backup = await this.backup(source !== this.data)
    if (existsSync(source)) {
      if (source === this.data && backup)
        cpSync(this.backupSource(backup), staged, {
          recursive: true,
          errorOnExist: true,
          force: false
        })
      else await snapshotProfile(source, staged)
    } else mkdirSync(staged)
    migrateProfile(staged)
    readbackProfile(staged)
    syncTree(staged)
    return { id, backup }
  }
  validate(): void {
    validateProfile(this.data, true)
    readbackProfile(this.data)
  }
}
