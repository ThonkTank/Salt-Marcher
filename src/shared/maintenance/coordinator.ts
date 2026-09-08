import { randomUUID } from 'node:crypto'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  symlinkSync,
  unlinkSync
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import {
  maintenanceJournalSchema,
  type MaintenanceJournal,
  type MaintenanceProgram
} from '../contracts/maintenance.js'
import { durableJson, sha256, syncPath } from './files.js'

/** Caller holds the profile lock and has closed all data connections.
 * Data preparation/readback belongs to Utility; this owns publication only.
 */
export class MaintenanceCoordinator {
  readonly data: string
  readonly journalPath: string
  constructor(
    readonly root: string,
    private readonly boundary: (name: string) => void = () => {}
  ) {
    this.data = join(root, 'profile', 'campaign-data')
    this.journalPath = join(root, 'maintenance-journal.json')
  }

  read(): MaintenanceJournal | null {
    return existsSync(this.journalPath)
      ? maintenanceJournalSchema.parse(
          JSON.parse(readFileSync(this.journalPath, 'utf8'))
        )
      : null
  }

  begin(
    input: Pick<
      MaintenanceJournal,
      'id' | 'operation' | 'backup' | 'previous' | 'next'
    >
  ): MaintenanceJournal {
    const previous = this.read()
    if (previous && !['committed', 'rolled-back'].includes(previous.phase))
      throw new Error('Eine Wartung muss zuerst wiederhergestellt werden.')
    const state = maintenanceJournalSchema.parse({
      ...input,
      formatVersion: 2,
      phase: 'prepared',
      rollbackFrom: null,
      hadData: existsSync(this.data)
    })
    if (!existsSync(this.staged(state)))
      throw new Error('Die geprüfte Arbeitskopie fehlt.')
    if (existsSync(this.previousData(state)) || existsSync(this.failed(state)))
      throw new Error('Die Wartungskennung wurde bereits verwendet.')
    this.verifyProgram(state.next)
    if (state.previous) this.verifyProgram(state.previous)
    this.assertCurrent(state.previous)
    mkdirSync(dirname(this.data), { recursive: true })
    return this.write(state, 'prepared')
  }

  activate(): MaintenanceJournal {
    let state = this.require()
    if (state.phase === 'prepared') state = this.write(state, 'data-moving')
    if (state.phase === 'data-moving') {
      if (state.hadData && !existsSync(this.previousData(state))) {
        if (!existsSync(this.data) || !existsSync(this.staged(state)))
          throw new Error('Der bisherige Datenstand ist nicht eindeutig.')
        this.move(this.data, this.previousData(state), 'old-data-moved')
      }
      if (existsSync(this.staged(state))) {
        if (existsSync(this.data))
          throw new Error('Der Zieldatenordner ist bereits belegt.')
        this.move(this.staged(state), this.data, 'new-data-moved')
      } else if (!existsSync(this.data)) {
        throw new Error('Die vorbereiteten Daten fehlen.')
      }
      state = this.write(state, 'data-ready')
    }
    if (state.phase === 'data-ready')
      state = this.write(state, 'program-moving')
    if (state.phase === 'program-moving') {
      this.selectProgram(state.next)
      state = this.write(state, 'awaiting-start')
    }
    if (state.phase !== 'awaiting-start')
      throw new Error('Keine aktivierbare Wartung vorhanden.')
    return state
  }

  /** Call only after target-runtime data readback, before enabling user writes. */
  commit(id: string): void {
    const state = this.require()
    if (
      state.id !== id ||
      !['awaiting-start', 'committed'].includes(state.phase)
    )
      throw new Error('Die Startprüfung gehört nicht zur aktiven Wartung.')
    this.assertCurrent(state.next)
    this.verifyProgram(state.next)
    if (state.phase !== 'committed') this.write(state, 'committed')
  }

  rollback(): void {
    let state = this.read()
    if (!state || ['committed', 'rolled-back'].includes(state.phase)) return
    if (state.rollbackFrom === null) {
      state = maintenanceJournalSchema.parse({
        ...state,
        rollbackFrom: state.phase,
        phase: 'rollback-started'
      })
      state = this.write(state, 'rollback-started')
    }
    if (state.phase === 'rollback-started') {
      if (existsSync(this.previousData(state))) {
        state = this.write(
          state,
          existsSync(this.data) ? 'rollback-preserving' : 'rollback-restoring'
        )
      } else if (state.hadData) {
        if (
          !['prepared', 'data-moving'].includes(state.rollbackFrom!) ||
          !existsSync(this.staged(state)) ||
          !existsSync(this.data)
        )
          throw new Error(
            'Der vorherige Datenstand fehlt; Prüfung erforderlich.'
          )
        state = this.write(state, 'rollback-program')
      } else {
        state = this.write(
          state,
          existsSync(this.data) ? 'rollback-preserving' : 'rollback-program'
        )
      }
    }
    if (state.phase === 'rollback-preserving') {
      if (existsSync(this.data)) {
        if (existsSync(this.failed(state)))
          throw new Error(
            'Mehrere erhaltene Datenstände benötigen eine Prüfung.'
          )
        this.move(this.data, this.failed(state), 'failed-data-preserved')
      } else if (!existsSync(this.failed(state))) {
        throw new Error('Der zu erhaltende Datenstand fehlt.')
      }
      state = this.write(
        state,
        state.hadData ? 'rollback-restoring' : 'rollback-program'
      )
    }
    if (state.phase === 'rollback-restoring') {
      if (existsSync(this.previousData(state))) {
        if (existsSync(this.data))
          throw new Error('Der Wiederherstellungsordner ist belegt.')
        this.move(this.previousData(state), this.data, 'old-data-restored')
      } else if (!existsSync(this.data)) {
        throw new Error('Der wiederherzustellende Datenstand fehlt.')
      }
      state = this.write(state, 'rollback-program')
    }
    if (state.phase === 'rollback-program') {
      if (state.previous) this.selectProgram(state.previous)
      else {
        const current = join(this.root, 'current')
        if (lstatSync(current, { throwIfNoEntry: false })) {
          this.assertCurrent(state.next)
          unlinkSync(current)
          syncPath(this.root)
          this.boundary('program-unlinked')
        }
      }
      this.write(state, 'rolled-back')
    }
  }

  private require(): MaintenanceJournal {
    const state = this.read()
    if (!state) throw new Error('Kein Wartungsjournal vorhanden.')
    return state
  }
  private staged(state: MaintenanceJournal) {
    return join(this.root, `staged-${state.id}`)
  }
  private previousData(state: MaintenanceJournal) {
    return join(this.root, `previous-${state.id}`)
  }
  private failed(state: MaintenanceJournal) {
    return join(this.root, `failed-${state.id}`)
  }
  private write(state: MaintenanceJournal, phase: MaintenanceJournal['phase']) {
    const next = maintenanceJournalSchema.parse({ ...state, phase })
    durableJson(this.journalPath, next)
    this.boundary(phase)
    return next
  }
  private move(source: string, target: string, boundary: string) {
    renameSync(source, target)
    syncPath(dirname(source))
    if (dirname(source) !== dirname(target)) syncPath(dirname(target))
    this.boundary(boundary)
  }
  private verifyProgram(program: MaintenanceProgram) {
    const path = join(
      this.root,
      'deployments',
      program.deployment,
      'SaltMarcher.AppImage'
    )
    if (!existsSync(path) || sha256(path) !== program.sha256)
      throw new Error(
        'Die geprüfte Programmversion fehlt oder wurde verändert.'
      )
  }
  private assertCurrent(program: MaintenanceProgram | null) {
    const current = join(this.root, 'current')
    const stat = lstatSync(current, { throwIfNoEntry: false })
    if (!program && !stat) return
    if (
      !program ||
      !stat?.isSymbolicLink() ||
      resolve(this.root, readlinkSync(current)) !==
        resolve(this.root, 'deployments', program.deployment)
    )
      throw new Error(
        'Die aktive Programmversion stimmt nicht mit der Wartung überein.'
      )
  }
  private selectProgram(program: MaintenanceProgram) {
    this.verifyProgram(program)
    const temporary = join(this.root, `.current-${randomUUID()}`)
    symlinkSync(join('deployments', program.deployment), temporary)
    renameSync(temporary, join(this.root, 'current'))
    syncPath(this.root)
    this.boundary('program-linked')
  }
}
