import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'

export const followupLedgerPath =
  'docs/project/quality-reset/followup-requirements-ledger.json'

const requirementRanges = Object.freeze({
  PRES: 6,
  SAFE: 5,
  STORE: 6,
  IMPORT: 7,
  REG: 5,
  ARCH: 4,
  PERSIST: 6,
  UI: 6,
  E2E: 4,
  DEL: 10,
  DOC: 5
} as const)

export const expectedFollowupRequirementIds = Object.freeze(
  Object.entries(requirementRanges).flatMap(([prefix, count]) =>
    Array.from(
      { length: count },
      (_, index) => `${prefix}-${String(index + 1).padStart(3, '0')}`
    )
  )
)

export const ledgerStatusSchema = z.enum([
  'verified',
  'not_applicable',
  'open',
  'in_progress',
  'blocked'
])

const ledgerEntrySchema = z
  .object({
    id: z.string().regex(/^[A-Z0-9]+-[0-9]{3}$/),
    status: ledgerStatusSchema,
    evidence: z.array(z.string().min(1)),
    decision: z.string().min(1).nullable()
  })
  .strict()
  .superRefine((entry, context) => {
    if (entry.status === 'verified' && entry.evidence.length === 0)
      context.addIssue({
        code: 'custom',
        message: 'Verified requirements need concrete evidence',
        path: ['evidence']
      })
    if (entry.status === 'not_applicable' && entry.decision === null)
      context.addIssue({
        code: 'custom',
        message: 'Not-applicable requirements need a decision',
        path: ['decision']
      })
  })

export const followupLedgerSchema = z
  .object({
    schemaVersion: z.literal(1),
    source: z.literal('salt-marcher-nacharbeit-handoff'),
    requirements: z.array(ledgerEntrySchema)
  })
  .strict()
  .superRefine((ledger, context) => {
    const actual = ledger.requirements.map(({ id }) => id)
    const duplicates = actual.filter(
      (id, index) => actual.indexOf(id) !== index
    )
    if (duplicates.length > 0)
      context.addIssue({
        code: 'custom',
        message: `Duplicate requirement ids: ${[...new Set(duplicates)].join(', ')}`,
        path: ['requirements']
      })
    const expected = new Set(expectedFollowupRequirementIds)
    const missing = expectedFollowupRequirementIds.filter(
      (id) => !actual.includes(id)
    )
    const unexpected = actual.filter((id) => !expected.has(id))
    if (missing.length > 0 || unexpected.length > 0)
      context.addIssue({
        code: 'custom',
        message: `Requirement identity drift; missing: ${missing.join(', ') || 'none'}; unexpected: ${unexpected.join(', ') || 'none'}`,
        path: ['requirements']
      })
  })

export type FollowupLedger = z.infer<typeof followupLedgerSchema>
export type FollowupLedgerEntry = FollowupLedger['requirements'][number]

export interface LedgerCounts {
  readonly total: number
  readonly verified: number
  readonly notApplicable: number
  readonly open: number
  readonly inProgress: number
  readonly blocked: number
}

export function readFollowupLedger(
  workspaceRoot = process.cwd()
): FollowupLedger {
  return followupLedgerSchema.parse(
    JSON.parse(readFileSync(resolve(workspaceRoot, followupLedgerPath), 'utf8'))
  )
}

export function summarizeLedger(
  entries: readonly FollowupLedgerEntry[]
): LedgerCounts {
  const count = (status: FollowupLedgerEntry['status']): number =>
    entries.filter((entry) => entry.status === status).length
  return Object.freeze({
    total: entries.length,
    verified: count('verified'),
    notApplicable: count('not_applicable'),
    open: count('open'),
    inProgress: count('in_progress'),
    blocked: count('blocked')
  })
}

export function summarizeLedgerPrefix(
  ledger: FollowupLedger,
  prefixes: readonly string[]
): LedgerCounts {
  return summarizeLedger(
    ledger.requirements.filter(({ id }) =>
      prefixes.some((prefix) => id.startsWith(`${prefix}-`))
    )
  )
}

export function ledgerSha256(workspaceRoot = process.cwd()): string {
  return createHash('sha256')
    .update(readFileSync(resolve(workspaceRoot, followupLedgerPath)))
    .digest('hex')
}
