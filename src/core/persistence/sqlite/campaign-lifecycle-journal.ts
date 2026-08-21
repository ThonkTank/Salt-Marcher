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
import {
  assertCurrentLocalPersistenceVersion,
  localPersistenceFormatVersions
} from '../../../shared/contracts/local-persistence-format-versions.js'

const safeCampaignId =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
      schemaVersion: localPersistenceFormatVersions.campaignLifecycleReceipt,
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
    return parseCampaignLifecycleReceipt(value)
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

export function parseCampaignLifecycleReceipt(
  value: unknown
): CampaignLifecycleReceipt {
  assertCurrentLocalPersistenceVersion(
    value,
    'campaignLifecycleReceipt',
    'schemaVersion'
  )
  return Object.freeze(campaignLifecycleReceiptSchema.parse(value))
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
