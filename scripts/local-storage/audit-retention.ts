import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  rmSync
} from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import {
  handoffInvocationHistorySchema,
  parseHandoffInvocationHistory,
  type HandoffInvocationHistory
} from '../delivery-contract.js'
import {
  retainedTerminalAuditEntries,
  type AuditRetentionResult,
  type StorageFinding
} from './contract.js'
import { atomicWrite, syncDirectory } from './filesystem.js'

export interface ApplyAuditRetentionOptions {
  readonly receiptDirectory: string
  readonly removeFile?: (path: string) => void
}

const attemptReceiptStatusSchema = z
  .object({
    activeAttemptId: z.uuid(),
    status: z.enum(['running', 'complete', 'failed'])
  })
  .passthrough()

export function applyAuditRetention(
  options: ApplyAuditRetentionOptions
): AuditRetentionResult {
  const historyPath = join(options.receiptDirectory, 'invocations.json')
  if (!existsSync(historyPath))
    return {
      retainedInvocations: 0,
      removedInvocations: 0,
      removedAttemptFiles: [],
      findings: []
    }

  const history = parseHandoffInvocationHistory(
    JSON.parse(readFileSync(historyPath, 'utf8'))
  )
  const findings: StorageFinding[] = []
  const terminal = new Map<string, boolean>()
  for (const invocation of history.invocations) {
    try {
      const receipt = attemptReceiptStatusSchema.parse(
        JSON.parse(readFileSync(invocation.auditPath, 'utf8'))
      )
      if (receipt.activeAttemptId !== invocation.attemptId)
        throw new Error(
          'Attempt receipt identity does not match its invocation'
        )
      terminal.set(
        invocation.attemptId,
        receipt.status === 'complete' || receipt.status === 'failed'
      )
    } catch (error) {
      terminal.set(invocation.attemptId, false)
      findings.push({
        area: 'audit',
        name: invocation.attemptId,
        reason: errorMessage(error)
      })
    }
  }

  const retainedTerminalIds = new Set(
    history.invocations
      .filter(({ attemptId }) => terminal.get(attemptId) === true)
      .sort(newestInvocationFirst)
      .slice(0, retainedTerminalAuditEntries)
      .map(({ attemptId }) => attemptId)
  )
  const retainedInvocations = history.invocations.filter(
    ({ attemptId }) =>
      terminal.get(attemptId) !== true || retainedTerminalIds.has(attemptId)
  )
  const removedInvocations = history.invocations.filter(
    ({ attemptId }) =>
      terminal.get(attemptId) === true && !retainedTerminalIds.has(attemptId)
  )
  const retainedIds = new Set(
    retainedInvocations.map(({ attemptId }) => attemptId)
  )

  const next: HandoffInvocationHistory = handoffInvocationHistorySchema.parse({
    formatVersion: 2,
    invocations: retainedInvocations
  })
  if (removedInvocations.length > 0)
    atomicWrite(historyPath, `${JSON.stringify(next, null, 2)}\n`)

  const removeFile = options.removeFile ?? ((path: string) => rmSync(path))
  const removedAttemptFiles: string[] = []
  const attemptsDirectory = join(options.receiptDirectory, 'attempts')
  if (existsSync(attemptsDirectory)) {
    for (const name of readdirSync(attemptsDirectory).sort()) {
      if (removedAttemptFiles.includes(name)) continue
      const path = join(attemptsDirectory, name)
      if (!/^[0-9a-f-]{36}\.json$/.test(name)) {
        findings.push({
          area: 'audit',
          name,
          reason: 'Unknown attempt-detail entry was preserved'
        })
        continue
      }
      let receipt: z.infer<typeof attemptReceiptStatusSchema>
      try {
        const stats = lstatSync(path)
        if (!stats.isFile() || stats.isSymbolicLink())
          throw new Error('Attempt detail is not an owned regular file')
        receipt = attemptReceiptStatusSchema.parse(
          JSON.parse(readFileSync(path, 'utf8'))
        )
        if (`${receipt.activeAttemptId}.json` !== name)
          throw new Error('Attempt detail filename and identity differ')
      } catch (error) {
        findings.push({ area: 'audit', name, reason: errorMessage(error) })
        continue
      }
      if (
        !retainedIds.has(receipt.activeAttemptId) &&
        (receipt.status === 'complete' || receipt.status === 'failed')
      ) {
        removeFile(path)
        removedAttemptFiles.push(name)
      }
    }
  }
  if (removedAttemptFiles.length > 0) syncDirectory(attemptsDirectory)

  return {
    retainedInvocations: retainedInvocations.length,
    removedInvocations: removedInvocations.length,
    removedAttemptFiles,
    findings: findings.sort(findingOrder)
  }
}

function newestInvocationFirst(
  left: HandoffInvocationHistory['invocations'][number],
  right: HandoffInvocationHistory['invocations'][number]
): number {
  return right.createdAt === left.createdAt
    ? right.attemptId.localeCompare(left.attemptId, 'en')
    : right.createdAt.localeCompare(left.createdAt, 'en')
}

function findingOrder(left: StorageFinding, right: StorageFinding): number {
  return `${left.name}:${left.reason}`.localeCompare(
    `${right.name}:${right.reason}`,
    'en'
  )
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
