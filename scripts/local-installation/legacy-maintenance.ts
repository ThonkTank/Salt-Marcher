import { randomUUID } from 'node:crypto'
import {
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  renameSync
} from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import {
  maintenanceJournalSchema,
  type MaintenanceJournal
} from '../../src/shared/contracts/maintenance.js'
import { MaintenanceCoordinator } from '../../src/shared/maintenance/coordinator.js'
import {
  currentLocalProgram,
  localProgram
} from '../../src/shared/maintenance/local-program.js'
import {
  durableJson,
  inventory,
  sha256,
  syncPath,
  syncTree
} from '../../src/shared/maintenance/files.js'
import type {
  JournalReplacement,
  LocalInstallJournal
} from '../local-install-journal.js'
import type { LocalInstallationPaths } from './contract.js'
import { backupPayload, validateBackupContents } from './campaign-backup.js'

/** Admission only. The shared coordinator performs all live rollback operations. */
export function adoptLegacyLocalMaintenance(
  paths: LocalInstallationPaths,
  journal: LocalInstallJournal
): void {
  if (new MaintenanceCoordinator(paths.root).read()) return
  const id = journal.transactionId
  const proof = join(paths.root, `legacy-local-source-${id}.json`)
  const serialized = JSON.stringify(journal)
  if (
    existsSync(proof) &&
    JSON.stringify(JSON.parse(readFileSync(proof, 'utf8'))) !== serialized
  )
    throw new Error('Der alte Wartungsbeleg wurde verändert.')

  if (['completed', 'rolled-back'].includes(journal.phase)) {
    if (!existsSync(proof)) durableJson(proof, journal)
    return
  }
  if (!journal.migration && journal.replacements.length === 0) return

  if (
    journal.deploymentPath !== join(paths.deployments, journal.buildFingerprint)
  )
    throw new Error('Der alte Programmstand liegt außerhalb der Installation.')
  const next = localProgram(paths.root, journal.buildFingerprint)
  if (
    next.sha256 !== journal.artifactSha256 ||
    sha256(join(journal.deploymentPath, 'SaltMarcher.AppImage')) !== next.sha256
  )
    throw new Error('Der alte Zielprogramm-Nachweis stimmt nicht überein.')
  const entries = journal.replacements.map((entry) =>
    validatedReplacement(paths, entry)
  )
  if (new Set(entries.map(({ target }) => target)).size !== entries.length)
    throw new Error('Doppelte Ziele im alten Wartungsbeleg.')
  if (entries.length && entries.length !== 3)
    throw new Error('Der alte Desktop-Wartungsbeleg ist unvollständig.')
  const pointer = entries.find(({ target }) => target === paths.current)
  const oldPointer = pointer ? previousPath(pointer) : paths.current
  const previous = oldPointer ? programAtPointer(paths, oldPointer) : null
  if (
    previous &&
    sha256(
      join(paths.deployments, previous.deployment, 'SaltMarcher.AppImage')
    ) !== previous.sha256
  )
    throw new Error('Das vorherige Programm wurde verändert.')

  let previousSource: string | null = null
  if (journal.migration) {
    const migration = journal.migration
    if (
      migration.staging !== join(paths.profile, '.campaign-data.migration') ||
      migration.rollback !== join(paths.profile, '.campaign-data.rollback')
    )
      throw new Error('Ungültige alte Migrationspfade.')
    if (existsSync(migration.rollback)) previousSource = migration.rollback
    else if (
      journal.phase === 'migration-staged' &&
      existsSync(migration.staging) &&
      existsSync(paths.campaignData)
    ) {
      // Data promotion has not happened; current still is the original tree.
    } else {
      if (!journal.backupPath || dirname(journal.backupPath) !== paths.backups)
        throw new Error('Die Sicherung für den alten Datenrückweg fehlt.')
      validateBackupContents(paths, journal)
      previousSource = backupPayload(journal.backupPath)
    }
  }

  const integration: MaintenanceJournal['integration'] = entries
    .filter(({ target }) => target !== paths.current)
    .map((entry, index) => {
      const old = previousPath(entry)
      const previous: MaintenanceJournal['integration'][number]['previous'] =
        old ? previousFile(old) : { kind: 'missing' }
      const nextPath = existsSync(entry.staged) ? entry.staged : entry.target
      const stat = lstatSync(nextPath, { throwIfNoEntry: false })
      if (!stat?.isFile()) throw new Error('Der alte Desktop-Zielstand fehlt.')
      const folder = join(paths.root, `integration-${id}`)
      mkdirSync(folder, { recursive: true })
      retainFile(nextPath, join(folder, `${index}.next`))
      if (old && previous.kind === 'file')
        retainFile(old, join(folder, `${index}.previous`))
      syncPath(folder)
      return {
        target: entry.target,
        sha256: sha256(nextPath),
        mode: stat.mode & 0o777,
        previous
      }
    })
  if (previousSource)
    retainTree(
      previousSource,
      join(paths.root, `previous-${id}`),
      journal.backupPath === previousSource
    )
  const adopted = maintenanceJournalSchema.parse({
    formatVersion: 2,
    id,
    operation: 'update',
    phase: previousSource ? 'rollback-started' : 'rollback-program',
    rollbackFrom: 'program-moving',
    hadData: previousSource !== null || existsSync(paths.campaignData),
    backup: journal.backupPath ? basename(journal.backupPath) : null,
    previous,
    next,
    integration
  })
  if (!existsSync(proof)) durableJson(proof, journal)
  syncPath(paths.root)
  durableJson(join(paths.root, 'maintenance-journal.json'), adopted)
}

function validatedReplacement(
  paths: LocalInstallationPaths,
  entry: JournalReplacement
): JournalReplacement {
  if (![paths.current, paths.icon, paths.desktopEntry].includes(entry.target))
    throw new Error('Ungültiges Ziel im alten Wartungsbeleg.')
  const prefix = join(
    dirname(entry.target),
    `.${basename(entry.target)}.install-`
  )
  const token = entry.staged.slice(prefix.length)
  if (!entry.staged.startsWith(prefix) || !/^[a-f0-9-]{36}$/.test(token))
    throw new Error('Ungültiger alter Stagingpfad.')
  const rollback = join(
    dirname(entry.target),
    `.${basename(entry.target)}.rollback-${token}`
  )
  if (entry.rollback !== null && entry.rollback !== rollback)
    throw new Error('Ungültiger alter Rückweg.')
  return {
    ...entry,
    rollback:
      entry.rollback ??
      (lstatSync(rollback, { throwIfNoEntry: false }) ? rollback : null)
  }
}
function previousPath(entry: JournalReplacement): string | null {
  if (entry.rollback) {
    if (!lstatSync(entry.rollback, { throwIfNoEntry: false }))
      throw new Error('Der alte Programm- oder Desktop-Rückweg fehlt.')
    return entry.rollback
  }
  if (lstatSync(entry.staged, { throwIfNoEntry: false }))
    return lstatSync(entry.target, { throwIfNoEntry: false })
      ? entry.target
      : null
  return null
}
function programAtPointer(paths: LocalInstallationPaths, pointer: string) {
  if (pointer === paths.current) return currentLocalProgram(paths.root)
  if (!lstatSync(pointer).isSymbolicLink())
    throw new Error('Ungültiger alter Programmzeiger.')
  const target = resolve(dirname(pointer), readlinkSync(pointer))
  if (target !== join(paths.deployments, basename(target)))
    throw new Error('Der alte Programmzeiger verlässt die Installation.')
  return localProgram(paths.root, basename(target))
}
function previousFile(
  path: string
): MaintenanceJournal['integration'][number]['previous'] {
  const stat = lstatSync(path)
  if (stat.isSymbolicLink()) return { kind: 'link', target: readlinkSync(path) }
  if (!stat.isFile()) throw new Error('Ungültiger alter Desktop-Rückweg.')
  return { kind: 'file', sha256: sha256(path), mode: stat.mode & 0o777 }
}
function retainFile(source: string, target: string): void {
  if (existsSync(target)) {
    if (sha256(source) !== sha256(target))
      throw new Error('Ein kopierter alter Wartungsstand wurde verändert.')
    return
  }
  const temporary = `${target}.${randomUUID()}.tmp`
  copyFileSync(source, temporary)
  syncPath(temporary)
  renameSync(temporary, target)
  syncPath(dirname(target))
}
function retainTree(
  source: string,
  target: string,
  legacyBackup: boolean
): void {
  const expected = inventory(source).filter(
    ({ path }) => !legacyBackup || path !== 'backup-manifest.json'
  )
  if (existsSync(target)) {
    if (JSON.stringify(inventory(target)) !== JSON.stringify(expected))
      throw new Error('Der kopierte Datenrückweg wurde verändert.')
    return
  }
  const temporary = `${target}.${randomUUID()}.tmp`
  cpSync(source, temporary, {
    recursive: true,
    errorOnExist: true,
    force: false,
    filter: (path) =>
      !legacyBackup || path !== join(source, 'backup-manifest.json')
  })
  syncTree(temporary)
  renameSync(temporary, target)
  syncPath(dirname(target))
}
