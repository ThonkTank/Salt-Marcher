import { existsSync, readFileSync, renameSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import { maintenanceJournalSchema } from '../../shared/contracts/maintenance.js'
import { durableJson, syncPath } from '../../shared/maintenance/files.js'
import { currentProgram, deploymentProgram, setCurrent } from './deployment.js'

const legacyDataSchema = z
  .object({
    formatVersion: z.literal(1),
    id: z.uuid(),
    hadData: z.boolean(),
    phase: z.enum([
      'prepared',
      'data-moving',
      'data-ready',
      'committed',
      'rolling-back',
      'rolled-back'
    ])
  })
  .strict()
const legacyActivationSchema = z
  .object({
    formatVersion: z.literal(1),
    id: z.uuid(),
    previous: z.uuid().nullable(),
    next: z.uuid(),
    phase: z.enum(['pending', 'committed', 'rolled-back'])
  })
  .strict()

/** One-time admission of pre-baseline journals. Never creates legacy operations. */
export function adoptLegacyReleaseMaintenance(root: string): void {
  const journalPath = join(root, 'maintenance-journal.json')
  const activationPath = join(root, 'activation.json')
  const activation = existsSync(activationPath)
    ? legacyActivationSchema.parse(
        JSON.parse(readFileSync(activationPath, 'utf8'))
      )
    : null
  const archiveActivation = () => {
    if (activation)
      archive(
        activationPath,
        join(root, `legacy-activation-${activation.id}.json`)
      )
  }
  if (!existsSync(journalPath)) {
    if (activation?.phase === 'pending')
      throw new Error(
        'Das Datenjournal einer unterbrochenen Installation fehlt.'
      )
    archiveActivation()
    return
  }
  const raw: unknown = JSON.parse(readFileSync(journalPath, 'utf8'))
  if (maintenanceJournalSchema.safeParse(raw).success) {
    archiveActivation()
    return
  }
  const old = legacyDataSchema.parse(raw)
  if (old.phase === 'committed' || old.phase === 'rolled-back') {
    if (activation?.phase === 'pending') {
      if (old.phase === 'committed') setCurrent(root, activation.next)
      else if (activation.previous) setCurrent(root, activation.previous)
      else if (existsSync(join(root, 'current'))) {
        unlinkSync(join(root, 'current'))
        syncPath(root)
      }
    }
    archiveActivation()
    archive(journalPath, join(root, `legacy-data-${old.id}.json`))
    return
  }
  const pending = activation?.phase === 'pending' ? activation : null
  if (!pending && old.phase !== 'prepared')
    throw new Error(
      'Das Programmjournal einer unterbrochenen Datenaktivierung fehlt.'
    )
  const previous = pending
    ? pending.previous
      ? deploymentProgram(root, pending.previous)
      : null
    : currentProgram(root)
  const next = pending ? deploymentProgram(root, pending.next) : previous
  if (!next) {
    archiveActivation()
    archive(journalPath, join(root, `legacy-data-${old.id}.json`))
    return
  }
  let phase: z.infer<typeof maintenanceJournalSchema>['phase'] =
    old.phase === 'data-ready'
      ? 'program-moving'
      : old.phase === 'rolling-back'
        ? 'rollback-started'
        : old.phase
  if (
    old.phase === 'rolling-back' &&
    !existsSync(join(root, `previous-${old.id}`))
  ) {
    const dataExists = existsSync(join(root, 'profile', 'campaign-data'))
    if (
      old.hadData &&
      (!dataExists ||
        (!existsSync(join(root, `staged-${old.id}`)) &&
          !existsSync(join(root, `failed-${old.id}`))))
    )
      throw new Error(
        'Der vorherige Datenstand ist nicht eindeutig; Prüfung erforderlich.'
      )
    phase =
      !old.hadData && dataExists ? 'rollback-preserving' : 'rollback-program'
  }
  const adopted = maintenanceJournalSchema.parse({
    formatVersion: 2,
    id: old.id,
    operation: 'update',
    phase,
    rollbackFrom: old.phase === 'rolling-back' ? 'data-ready' : null,
    hadData: old.hadData,
    backup: null,
    previous,
    next
  })
  durableJson(join(root, `legacy-data-source-${old.id}.json`), old)
  durableJson(journalPath, adopted)
  archiveActivation()
}

function archive(source: string, destination: string): void {
  if (existsSync(destination)) {
    if (readFileSync(source, 'utf8') !== readFileSync(destination, 'utf8'))
      throw new Error(
        'Ein vorhandener Wartungsbeleg darf nicht überschrieben werden.'
      )
    unlinkSync(source)
  } else renameSync(source, destination)
  syncPath(dirname(source))
}
