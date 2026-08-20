import { z } from 'zod'

const safeCampaignId =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const campaignLifecyclePhaseSchema = z.enum([
  'staged',
  'validated',
  'swapped',
  'reopened',
  'registered',
  'verified',
  'finalized'
])

export type CampaignLifecyclePhase = z.infer<
  typeof campaignLifecyclePhaseSchema
>

export const campaignLifecycleOperationSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('replacement') }).strict(),
  z
    .object({
      kind: z.literal('campaign-import'),
      importId: z.uuid()
    })
    .strict()
])

export type CampaignLifecycleOperation = z.infer<
  typeof campaignLifecycleOperationSchema
>

export const campaignLifecycleReceiptSchema = z
  .object({
    schemaVersion: z.literal(2),
    lifecycleId: z.uuid(),
    operation: campaignLifecycleOperationSchema,
    mode: z.enum(['create', 'replace']),
    campaignId: z.string().regex(safeCampaignId),
    previousName: z.string().min(1).nullable(),
    replacementName: z.string().min(1),
    previousActiveId: z.string().regex(safeCampaignId).nullable(),
    phase: campaignLifecyclePhaseSchema,
    validation: z.unknown().nullable(),
    updatedAt: z.iso.datetime()
  })
  .strict()
  .superRefine((receipt, context) => {
    if (receipt.mode === 'replace' && receipt.previousName === null)
      context.addIssue({
        code: 'custom',
        path: ['previousName'],
        message: 'Replacement lifecycle requires the prior campaign name'
      })
    if (receipt.mode === 'create' && receipt.previousName !== null)
      context.addIssue({
        code: 'custom',
        path: ['previousName'],
        message: 'Creation lifecycle cannot have a prior campaign name'
      })
  })

export type CampaignLifecycleReceipt = Readonly<
  z.infer<typeof campaignLifecycleReceiptSchema>
>

export type CampaignLifecycleBoundary =
  | 'before-stage-validation'
  | 'after-stage-validation'
  | 'before-original-move'
  | 'after-original-move'
  | 'before-replacement-promote'
  | 'after-replacement-promote'
  | 'before-reopen'
  | 'after-reopen'
  | 'before-registry-commit'
  | 'after-registry-commit'
  | 'before-registry-readback'
  | 'after-registry-readback'
  | 'before-cleanup'
  | 'after-cleanup'

export interface CampaignLifecycleJournal {
  begin(input: {
    operation: CampaignLifecycleOperation
    mode: 'create' | 'replace'
    campaignId: string
    previousName: string | null
    replacementName: string
    previousActiveId: string | null
  }): CampaignLifecycleReceipt
  advance(
    receipt: CampaignLifecycleReceipt,
    phase: CampaignLifecyclePhase,
    validation?: unknown
  ): CampaignLifecycleReceipt
  pending(): readonly CampaignLifecycleReceipt[]
  finish(receipt: CampaignLifecycleReceipt): void
  has(campaignId: string): boolean
}

export interface CampaignLifecycleStorage {
  swap(
    receipt: CampaignLifecycleReceipt,
    onBoundary: (boundary: CampaignLifecycleBoundary) => void
  ): void
  rollback(receipt: CampaignLifecycleReceipt): void
  isCurrentValid(receipt: CampaignLifecycleReceipt): boolean
  finalize(receipt: CampaignLifecycleReceipt): void
  recoverLegacyReplacement(campaignId: string): void
}

export interface CampaignLifecycleConnections {
  release(campaignId: string): void
  close(): void
  reopen(campaignId: string): void
}

export interface CampaignLifecycleRegistration {
  commit(receipt: CampaignLifecycleReceipt): void
  isCommitted(receipt: CampaignLifecycleReceipt): boolean
  verify(receipt: CampaignLifecycleReceipt): boolean
  rollback(receipt: CampaignLifecycleReceipt): void
  clear(receipt: CampaignLifecycleReceipt): void
}

export interface CampaignLifecycleCoordinatorOptions {
  readonly journal: CampaignLifecycleJournal
  readonly storage: CampaignLifecycleStorage
  readonly connections: CampaignLifecycleConnections
  readonly registration: CampaignLifecycleRegistration
}

export interface CampaignLifecycleExecutionOptions<Staged, Result> {
  readonly input: Parameters<CampaignLifecycleJournal['begin']>[0]
  readonly stage: () => Staged
  readonly validate: (staged: Staged) => unknown
  readonly result: (staged: Staged) => Result
  readonly verify: (staged: Staged) => boolean
  readonly onPhase?: (
    phase: CampaignLifecyclePhase,
    receipt: CampaignLifecycleReceipt
  ) => void
  readonly onBoundary?: (boundary: CampaignLifecycleBoundary) => void
}

/** Tests use this error to model process death without in-process recovery. */
export class CampaignLifecycleInterruption extends Error {
  constructor(readonly phase: CampaignLifecyclePhase) {
    super(`Campaign lifecycle interrupted after ${phase}`)
    this.name = 'CampaignLifecycleInterruption'
  }
}

/**
 * The single owner of the cross-resource Campaign publish invariant. Domain
 * staging remains caller-specific; every publish, recovery, registry decision,
 * verification and cleanup follows this persisted state machine.
 */
export class CampaignLifecycleCoordinator {
  private readonly journal: CampaignLifecycleJournal
  private readonly storage: CampaignLifecycleStorage
  private readonly connections: CampaignLifecycleConnections
  private readonly registration: CampaignLifecycleRegistration

  constructor(options: CampaignLifecycleCoordinatorOptions) {
    this.journal = options.journal
    this.storage = options.storage
    this.connections = options.connections
    this.registration = options.registration
  }

  execute<Staged, Result>(
    options: CampaignLifecycleExecutionOptions<Staged, Result>
  ): Readonly<{ receipt: CampaignLifecycleReceipt; result: Result }> {
    let receipt = this.journal.begin(options.input)
    const boundary = (value: CampaignLifecycleBoundary) => {
      options.onBoundary?.(value)
    }
    try {
      const staged = options.stage()
      const result = options.result(staged)
      options.onPhase?.('staged', receipt)
      boundary('before-stage-validation')
      const validation = options.validate(staged)
      boundary('after-stage-validation')
      receipt = this.journal.advance(receipt, 'validated', validation)
      options.onPhase?.('validated', receipt)

      this.connections.release(receipt.campaignId)
      this.storage.swap(receipt, boundary)
      receipt = this.journal.advance(receipt, 'swapped')
      options.onPhase?.('swapped', receipt)

      boundary('before-reopen')
      this.connections.reopen(receipt.campaignId)
      boundary('after-reopen')
      receipt = this.journal.advance(receipt, 'reopened')
      options.onPhase?.('reopened', receipt)

      boundary('before-registry-commit')
      this.registration.commit(receipt)
      boundary('after-registry-commit')
      receipt = this.journal.advance(receipt, 'registered')
      options.onPhase?.('registered', receipt)

      boundary('before-registry-readback')
      if (!this.registration.verify(receipt) || !options.verify(staged))
        throw new Error('Published campaign failed lifecycle verification')
      boundary('after-registry-readback')
      receipt = this.journal.advance(receipt, 'verified')
      options.onPhase?.('verified', receipt)

      boundary('before-cleanup')
      this.storage.finalize(receipt)
      boundary('after-cleanup')
      receipt = this.journal.advance(receipt, 'finalized')
      options.onPhase?.('finalized', receipt)
      this.registration.clear(receipt)
      this.journal.finish(receipt)
      return { receipt, result }
    } catch (error) {
      if (error instanceof CampaignLifecycleInterruption) throw error
      this.recover(receipt, true)
      throw error
    }
  }

  recoverPending(reopen: boolean): void {
    for (const receipt of this.journal.pending()) this.recover(receipt, reopen)
  }

  hasPending(campaignId: string): boolean {
    return this.journal.has(campaignId)
  }

  recoverLegacyReplacement(campaignId: string): void {
    this.storage.recoverLegacyReplacement(campaignId)
  }

  private recover(receipt: CampaignLifecycleReceipt, reopen: boolean): void {
    this.connections.close()
    const committed =
      phaseAtLeastRegistered(receipt.phase) ||
      this.registration.isCommitted(receipt)
    if (!committed) {
      this.storage.rollback(receipt)
      this.registration.rollback(receipt)
      this.journal.finish(receipt)
      if (reopen && receipt.previousActiveId !== null)
        this.connections.reopen(receipt.previousActiveId)
      return
    }

    if (!this.storage.isCurrentValid(receipt))
      throw new Error('Committed Campaign lifecycle has no valid current store')
    if (!this.registration.verify(receipt))
      throw new Error('Committed campaign lifecycle failed registry readback')
    this.storage.finalize(receipt)
    if (reopen) this.connections.reopen(receipt.campaignId)
    this.registration.clear(receipt)
    this.journal.finish(receipt)
  }
}

function phaseAtLeastRegistered(phase: CampaignLifecyclePhase): boolean {
  return phase === 'registered' || phase === 'verified' || phase === 'finalized'
}
