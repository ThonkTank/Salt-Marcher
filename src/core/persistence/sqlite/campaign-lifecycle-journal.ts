import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import {
  campaignLifecycleReceiptSchema,
  type CampaignLifecycleJournal,
  type CampaignLifecyclePhase,
  type CampaignLifecycleReceipt
} from '../../application/campaign-lifecycle-coordinator.js'
import { uuidv7 } from '../../../shared/ids/uuidv7.js'

const safeCampaignId =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const legacyReceiptSchema = z
  .object({
    schemaVersion: z.literal(1),
    transitionId: z.uuid(),
    campaignId: z.string().regex(safeCampaignId),
    previousName: z.string().min(1),
    replacementName: z.string().min(1),
    previousActiveId: z.string().regex(safeCampaignId).nullable(),
    phase: z.enum([
      'staged',
      'original_moved',
      'replacement_promoted',
      'verified',
      'complete'
    ]),
    updatedAt: z.iso.datetime()
  })
  .strict()

/** Persists lifecycle intent before any non-transactional directory move. */
export class FileCampaignLifecycleJournal implements CampaignLifecycleJournal {
  constructor(private readonly dataRoot: string) {}

  begin(
    input: Parameters<CampaignLifecycleJournal['begin']>[0]
  ): CampaignLifecycleReceipt {
    this.requireSafeCampaignId(input.campaignId)
    if (this.has(input.campaignId))
      throw new Error('Campaign lifecycle already exists')
    return this.persist({
      schemaVersion: 2,
      lifecycleId: uuidv7(),
      ...input,
      phase: 'staged',
      validation: null,
      updatedAt: new Date().toISOString()
    })
  }

  advance(
    receipt: CampaignLifecycleReceipt,
    phase: CampaignLifecyclePhase,
    validation: unknown = receipt.validation
  ): CampaignLifecycleReceipt {
    const current = this.receipt(receipt.campaignId)
    if (
      current === null ||
      current.lifecycleId !== receipt.lifecycleId ||
      current.phase !== receipt.phase
    )
      throw new Error('Campaign lifecycle journal changed concurrently')
    if (!isNextPhase(receipt.phase, phase))
      throw new Error(
        `Campaign lifecycle cannot advance from ${receipt.phase} to ${phase}`
      )
    return this.persist({
      ...receipt,
      phase,
      validation,
      updatedAt: new Date().toISOString()
    })
  }

  pending(): readonly CampaignLifecycleReceipt[] {
    if (!existsSync(this.directory())) return []
    return readdirSync(this.directory())
      .filter((name) => name.endsWith('.json'))
      .sort()
      .map((name) => this.parse(join(this.directory(), name)))
  }

  finish(receipt: CampaignLifecycleReceipt): void {
    const current = this.receipt(receipt.campaignId)
    if (current !== null && current.lifecycleId !== receipt.lifecycleId)
      throw new Error('Cannot finish another Campaign lifecycle')
    rmSync(this.path(receipt.campaignId), { force: true })
  }

  has(campaignId: string): boolean {
    this.requireSafeCampaignId(campaignId)
    return existsSync(this.path(campaignId))
  }

  private receipt(campaignId: string): CampaignLifecycleReceipt | null {
    const path = this.path(campaignId)
    return existsSync(path) ? this.parse(path) : null
  }

  private parse(path: string): CampaignLifecycleReceipt {
    const value = JSON.parse(readFileSync(path, 'utf8')) as unknown
    const current = campaignLifecycleReceiptSchema.safeParse(value)
    if (current.success) return Object.freeze(current.data)
    const legacy = legacyReceiptSchema.parse(value)
    return Object.freeze(
      campaignLifecycleReceiptSchema.parse({
        schemaVersion: 2,
        lifecycleId: legacy.transitionId,
        operation: { kind: 'replacement' },
        mode: 'replace',
        campaignId: legacy.campaignId,
        previousName: legacy.previousName,
        replacementName: legacy.replacementName,
        previousActiveId: legacy.previousActiveId,
        phase: migrateLegacyPhase(legacy.phase),
        validation: { migratedFromSchemaVersion: 1 },
        updatedAt: legacy.updatedAt
      })
    )
  }

  private persist(
    input: z.input<typeof campaignLifecycleReceiptSchema>
  ): CampaignLifecycleReceipt {
    const receipt = campaignLifecycleReceiptSchema.parse(input)
    mkdirSync(this.directory(), { recursive: true })
    const target = this.path(receipt.campaignId)
    const temporary = `${target}.${receipt.lifecycleId}.tmp`
    const descriptor = openSync(temporary, 'w')
    try {
      writeFileSync(descriptor, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8')
      fsyncSync(descriptor)
    } finally {
      closeSync(descriptor)
    }
    renameSync(temporary, target)
    return Object.freeze(receipt)
  }

  private directory(): string {
    return join(this.dataRoot, 'campaigns', '.transitions')
  }

  private path(campaignId: string): string {
    return join(this.directory(), `${campaignId}.json`)
  }

  private requireSafeCampaignId(campaignId: string): void {
    if (!safeCampaignId.test(campaignId))
      throw new Error('Unsafe Campaign lifecycle identifier')
  }
}

const phases: readonly CampaignLifecyclePhase[] = [
  'staged',
  'validated',
  'swapped',
  'reopened',
  'registered',
  'verified',
  'finalized'
]

function isNextPhase(
  current: CampaignLifecyclePhase,
  next: CampaignLifecyclePhase
): boolean {
  return phases.indexOf(next) === phases.indexOf(current) + 1
}

function migrateLegacyPhase(
  phase: z.infer<typeof legacyReceiptSchema>['phase']
): CampaignLifecyclePhase {
  if (phase === 'staged' || phase === 'original_moved') return 'validated'
  if (phase === 'replacement_promoted') return 'swapped'
  if (phase === 'verified') return 'registered'
  return 'finalized'
}
