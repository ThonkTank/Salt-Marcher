import {
  cpSync,
  existsSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync
} from 'node:fs'
import { basename, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { parseCampaignLifecycleReceipt } from '../../src/core/persistence/sqlite/campaign-lifecycle-journal.js'
import {
  handoffInvocationHistorySchema,
  parseHandoffInvocationHistory
} from '../delivery-contract.js'
import {
  readInstallJournal,
  writeInstallJournal
} from '../local-install-journal.js'
import { hashTree } from '../local-installation/campaign-file-inventory.js'
import type { LocalInstallationPaths } from '../local-installation/contract.js'
import { atomicWrite, syncDirectory } from './filesystem.js'
import { inspectLocalStorage, validateBackupDirectory } from './inspection.js'

export interface EvacuateCompatibilityOptions {
  readonly paths: LocalInstallationPaths
  readonly iconSourcePath: string
  readonly receiptDirectory: string
  readonly now?: () => Date
}

export function evacuateCompatibility(
  options: EvacuateCompatibilityOptions
): void {
  const before = inspectLocalStorage(options)
  const legacy = before.compatibility.artifacts.filter(
    ({ status }) => status === 'legacy-reader-required'
  )
  if (legacy.length === 0) return
  requireVerifiedHandoffBackup(options.paths)

  rewriteLegacyJson(
    options.paths.journal,
    'formatVersion',
    () => readInstallJournalFromValue(options.paths.journal),
    (value) =>
      writeInstallJournal(
        options.paths.journal,
        value,
        options.now ?? (() => new Date())
      )
  )
  rewriteHandoffHistory(options.receiptDirectory)
  rewriteLifecycleDirectory(
    join(options.paths.campaignData, 'campaigns', '.transitions')
  )

  for (const backup of before.backups)
    if (backupHasLegacyLifecycle(backup.path))
      createBackupSuccessor(backup.path, backup.manifestSha256, options)
}

function rewriteHandoffHistory(receiptDirectory: string): void {
  const path = join(receiptDirectory, 'invocations.json')
  if (!existsSync(path)) return
  const history = parseHandoffInvocationHistory(
    JSON.parse(readFileSync(path, 'utf8'))
  )
  let changed = false
  const invocations = history.invocations.map((invocation) => {
    const target = join(
      receiptDirectory,
      'attempts',
      `${invocation.attemptId}.json`
    )
    if (invocation.auditPath === target) return invocation
    if (!existsSync(invocation.auditPath))
      throw new Error(
        `Legacy Handoff attempt detail is missing: ${invocation.attemptId}`
      )
    atomicWrite(target, readFileSync(invocation.auditPath, 'utf8'))
    changed = true
    return { ...invocation, auditPath: target }
  })
  if (
    changed ||
    (JSON.parse(readFileSync(path, 'utf8')) as { formatVersion?: unknown })
      .formatVersion !== 2
  )
    atomicWrite(
      path,
      `${JSON.stringify(
        handoffInvocationHistorySchema.parse({
          formatVersion: 2,
          invocations
        }),
        null,
        2
      )}\n`
    )
}

function requireVerifiedHandoffBackup(paths: LocalInstallationPaths): void {
  const journal = readInstallJournal(paths.journal)
  if (
    journal === null ||
    journal.phase !== 'completed' ||
    journal.backupPath === null ||
    journal.backupManifestSha256 === null
  )
    throw new Error(
      'Compatibility evacuation requires a completed installation journal with verified backup evidence'
    )
  const verified = validateBackupDirectory(
    journal.backupPath,
    basename(journal.backupPath)
  )
  if (verified.manifestSha256 !== journal.backupManifestSha256)
    throw new Error('Compatibility evacuation backup evidence changed')
}

function readInstallJournalFromValue(
  path: string
): NonNullable<ReturnType<typeof readInstallJournal>> {
  const journal = readInstallJournal(path)
  if (journal === null) throw new Error('Install journal disappeared')
  return journal
}

function rewriteLegacyJson<T>(
  path: string,
  versionField: string,
  parse: (value: unknown) => T,
  write: (value: T) => unknown
): void {
  if (!existsSync(path)) return
  const value = JSON.parse(readFileSync(path, 'utf8')) as Record<
    string,
    unknown
  >
  if (value[versionField] !== 1) return
  write(parse(value))
}

function rewriteLifecycleDirectory(directory: string): void {
  if (!existsSync(directory)) return
  for (const name of readdirSync(directory).sort()) {
    const path = join(directory, name)
    const value = JSON.parse(readFileSync(path, 'utf8')) as Record<
      string,
      unknown
    >
    if (value['schemaVersion'] !== 1) continue
    const migrated = parseCampaignLifecycleReceipt(value)
    atomicWrite(path, `${JSON.stringify(migrated, null, 2)}\n`)
  }
}

function backupHasLegacyLifecycle(path: string): boolean {
  const directory = join(path, 'campaigns', '.transitions')
  if (!existsSync(directory)) return false
  return readdirSync(directory).some((name) => {
    const value = JSON.parse(
      readFileSync(join(directory, name), 'utf8')
    ) as Record<string, unknown>
    return value['schemaVersion'] === 1
  })
}

function createBackupSuccessor(
  source: string,
  sourceManifestSha256: string,
  options: EvacuateCompatibilityOptions
): void {
  const name = `${basename(source)}-compat-v2-${sourceManifestSha256.slice(0, 8)}`
  const target = join(options.paths.backups, name)
  if (existsSync(target)) {
    validateBackupDirectory(target, name)
    return
  }
  const staging = join(options.paths.backups, `.compat-${randomUUID()}`)
  try {
    cpSync(source, staging, { recursive: true, errorOnExist: true })
    rewriteLifecycleDirectory(join(staging, 'campaigns', '.transitions'))
    const manifestPath = join(staging, 'backup-manifest.json')
    const previous = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<
      string,
      unknown
    >
    atomicWrite(
      manifestPath,
      `${JSON.stringify(
        {
          ...previous,
          createdAt: (options.now ?? (() => new Date()))().toISOString(),
          compatibilitySuccessorOf: {
            name: basename(source),
            manifestSha256: sourceManifestSha256
          },
          files: hashTree(staging).filter(
            ({ path }) => path !== 'backup-manifest.json'
          )
        },
        null,
        2
      )}\n`
    )
    validateBackupDirectory(staging, name)
    renameSync(staging, target)
    syncDirectory(options.paths.backups)
  } finally {
    rmSync(staging, { recursive: true, force: true })
  }
}
