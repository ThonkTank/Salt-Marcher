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
const journalSchema = z
  .object({
    formatVersion: z.literal(1),
    id: z.uuid(),
    phase: z.enum([
      'prepared',
      'data-moving',
      'data-ready',
      'committed',
      'rolling-back',
      'rolled-back'
    ]),
    hadData: z.boolean()
  })
  .strict()
export type MaintenanceJournal = z.infer<typeof journalSchema>
export class ProfileTransaction {
  readonly data: string
  readonly journalPath: string
  constructor(
    readonly root: string,
    readonly version: string,
    private readonly boundary: (phase: string) => void = () => {}
  ) {
    this.data = join(root, 'profile', 'campaign-data')
    this.journalPath = join(root, 'maintenance-journal.json')
    mkdirSync(join(root, 'profile'), { recursive: true })
    mkdirSync(join(root, 'backups'), { recursive: true })
  }
  private journal(): MaintenanceJournal | null {
    return existsSync(this.journalPath)
      ? journalSchema.parse(JSON.parse(readFileSync(this.journalPath, 'utf8')))
      : null
  }
  private write(
    journal: MaintenanceJournal,
    phase: MaintenanceJournal['phase']
  ) {
    durableJson(this.journalPath, { ...journal, phase })
    this.boundary(phase)
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
  async prepare(source = this.data): Promise<void> {
    const previous = this.journal()
    if (previous && !['committed', 'rolled-back'].includes(previous.phase))
      throw new Error('Eine Wartung muss zuerst wiederhergestellt werden.')
    const id = randomUUID()
    const staged = join(this.root, `staged-${id}`)
    const bytes = existsSync(source)
      ? inventory(source).reduce((sum, file) => sum + file.bytes, 0)
      : 0
    const fs = statfsSync(this.root)
    if (fs.bavail * fs.bsize < bytes * 4 + 64 * 1024 * 1024)
      throw new Error(
        'Nicht genug freier Speicherplatz für Sicherung und Migration.'
      )
    const ownBackup = await this.backup(source !== this.data)
    if (existsSync(source)) {
      if (source === this.data && ownBackup)
        cpSync(this.backupSource(ownBackup), staged, {
          recursive: true,
          errorOnExist: true,
          force: false
        })
      else await snapshotProfile(source, staged)
    } else mkdirSync(staged)
    migrateProfile(staged)
    readbackProfile(staged)
    syncTree(staged)
    this.write(
      {
        formatVersion: 1,
        id,
        phase: 'prepared',
        hadData: existsSync(this.data)
      },
      'prepared'
    )
  }
  activate(): void {
    const journal = this.journal()
    if (!journal || journal.phase !== 'prepared')
      throw new Error('Keine geprüfte Migration vorhanden.')
    this.write(journal, 'data-moving')
    if (journal.hadData)
      renameSync(this.data, join(this.root, `previous-${journal.id}`))
    syncPath(join(this.root, 'profile'))
    syncPath(this.root)
    this.boundary('old-data-moved')
    renameSync(join(this.root, `staged-${journal.id}`), this.data)
    syncPath(join(this.root, 'profile'))
    syncPath(this.root)
    this.boundary('new-data-moved')
    this.write(journal, 'data-ready')
  }
  commit(): void {
    const journal = this.journal()
    if (!journal || journal.phase !== 'data-ready')
      throw new Error('Kein aktivierter Datenstand vorhanden.')
    validateProfile(this.data, true)
    this.write(journal, 'committed')
  }
  rollback(): void {
    const journal = this.journal()
    if (!journal || ['committed', 'rolled-back'].includes(journal.phase)) return
    const previous = join(this.root, `previous-${journal.id}`)
    this.write(journal, 'rolling-back')
    if (existsSync(previous)) {
      if (existsSync(this.data)) {
        const failed = join(this.root, `failed-${journal.id}`)
        if (!existsSync(failed)) renameSync(this.data, failed)
        else
          throw new Error(
            'Wiederherstellung benötigt eine Prüfung der erhaltenen Datenstände.'
          )
      }
      renameSync(previous, this.data)
    } else if (!journal.hadData && existsSync(this.data)) {
      renameSync(this.data, join(this.root, `failed-${journal.id}`))
    }
    syncPath(join(this.root, 'profile'))
    syncPath(this.root)
    this.write(journal, 'rolled-back')
  }
  discardStaging(): void {
    const journal = this.journal()
    if (journal?.phase === 'rolled-back')
      rmSync(join(this.root, `staged-${journal.id}`), {
        recursive: true,
        force: true
      })
  }
}
