import { randomUUID } from 'node:crypto'
import {
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { dirname, join } from 'node:path'
import { z } from 'zod'

const replacementSchema = z
  .object({
    target: z.string().min(1),
    staged: z.string().min(1),
    rollback: z.string().min(1).nullable(),
    state: z.enum(['staged', 'previous-moved', 'promoted'])
  })
  .strict()

export const localInstallJournalSchema = z
  .object({
    formatVersion: z.literal(1),
    transactionId: z.uuid(),
    buildFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    phase: z.enum([
      'prepared',
      'backup-complete',
      'migration-staged',
      'data-rollback-created',
      'data-promoted',
      'deployment-staged',
      'files-staged',
      'files-promoting',
      'completed',
      'rolled-back'
    ]),
    backupPath: z.string().min(1).nullable(),
    deploymentPath: z.string().min(1).nullable(),
    migration: z
      .object({
        staging: z.string().min(1),
        rollback: z.string().min(1)
      })
      .strict()
      .nullable(),
    replacements: z.array(replacementSchema).readonly(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime()
  })
  .strict()

export type LocalInstallJournal = z.infer<typeof localInstallJournalSchema>
export type JournalReplacement = z.infer<typeof replacementSchema>

export function createInstallJournal(
  buildFingerprint: string,
  now: () => Date
): LocalInstallJournal {
  const timestamp = now().toISOString()
  return localInstallJournalSchema.parse({
    formatVersion: 1,
    transactionId: randomUUID(),
    buildFingerprint,
    phase: 'prepared',
    backupPath: null,
    deploymentPath: null,
    migration: null,
    replacements: [],
    createdAt: timestamp,
    updatedAt: timestamp
  })
}

export function readInstallJournal(path: string): LocalInstallJournal | null {
  if (!existsSync(path)) return null
  return localInstallJournalSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
}

export function writeInstallJournal(
  path: string,
  journal: LocalInstallJournal,
  now: () => Date
): LocalInstallJournal {
  const next = localInstallJournalSchema.parse({
    ...journal,
    updatedAt: now().toISOString()
  })
  const temporary = join(
    dirname(path),
    `.${path.split('/').at(-1) ?? 'install-journal'}.${randomUUID()}.tmp`
  )
  let descriptor: number | undefined
  try {
    descriptor = openSync(temporary, 'wx', 0o600)
    writeFileSync(descriptor, `${JSON.stringify(next, null, 2)}\n`)
    fsyncSync(descriptor)
    closeSync(descriptor)
    descriptor = undefined
    renameSync(temporary, path)
    syncDirectory(dirname(path))
    return next
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
    rmSync(temporary, { force: true })
  }
}

function syncDirectory(path: string): void {
  const descriptor = openSync(path, 'r')
  try {
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
}
