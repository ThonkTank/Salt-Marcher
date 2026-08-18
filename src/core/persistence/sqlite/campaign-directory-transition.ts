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
import { dirname, join } from 'node:path'
import { z } from 'zod'
import { uuidv7 } from '../../../shared/ids/uuidv7.js'

const safeCampaignId =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const campaignDirectoryTransitionPhaseSchema = z.enum([
  'staged',
  'original_moved',
  'replacement_promoted',
  'verified',
  'complete'
])

export type CampaignDirectoryTransitionPhase = z.infer<
  typeof campaignDirectoryTransitionPhaseSchema
>

export const campaignDirectoryTransitionReceiptSchema = z
  .object({
    schemaVersion: z.literal(1),
    transitionId: z.uuid(),
    campaignId: z.string().regex(safeCampaignId),
    previousName: z.string().min(1),
    replacementName: z.string().min(1),
    previousActiveId: z.string().regex(safeCampaignId).nullable(),
    phase: campaignDirectoryTransitionPhaseSchema,
    updatedAt: z.iso.datetime()
  })
  .strict()

export type CampaignDirectoryTransitionReceipt = Readonly<
  z.infer<typeof campaignDirectoryTransitionReceiptSchema>
>

interface BeginCampaignDirectoryTransition {
  campaignId: string
  previousName: string
  replacementName: string
  previousActiveId: string | null
}

/**
 * Owns only the durable file-system transition between a verified staging
 * campaign and the currently reachable campaign directory. Registry and
 * SQLite-handle decisions remain explicit callbacks of the owning facade.
 */
export class CampaignDirectoryTransition {
  constructor(
    private readonly dataRoot: string,
    private readonly isValidCampaignStore: (path: string) => boolean
  ) {}

  begin(
    input: BeginCampaignDirectoryTransition
  ): CampaignDirectoryTransitionReceipt {
    this.requireSafeCampaignId(input.campaignId)
    if (this.receipt(input.campaignId) !== null)
      throw new Error('Campaign directory transition already exists')
    if (
      !this.isValidCampaignStore(this.currentPath(input.campaignId)) ||
      !this.isValidCampaignStore(this.stagedPath(input.campaignId))
    )
      throw new Error('Campaign directory transition requires two valid copies')

    return this.persist({
      schemaVersion: 1,
      transitionId: uuidv7(),
      campaignId: input.campaignId,
      previousName: input.previousName,
      replacementName: input.replacementName,
      previousActiveId: input.previousActiveId,
      phase: 'staged',
      updatedAt: new Date().toISOString()
    })
  }

  moveOriginal(
    receipt: CampaignDirectoryTransitionReceipt
  ): CampaignDirectoryTransitionReceipt {
    this.expectPhase(receipt, 'staged')
    if (
      !existsSync(this.currentDirectory(receipt.campaignId)) ||
      existsSync(this.replacedDirectory(receipt.campaignId))
    )
      throw new Error('Original campaign directory role is inconsistent')
    mkdirSync(dirname(this.replacedDirectory(receipt.campaignId)), {
      recursive: true
    })
    renameSync(
      this.currentDirectory(receipt.campaignId),
      this.replacedDirectory(receipt.campaignId)
    )
    return this.advance(receipt, 'original_moved')
  }

  promoteReplacement(
    receipt: CampaignDirectoryTransitionReceipt
  ): CampaignDirectoryTransitionReceipt {
    this.expectPhase(receipt, 'original_moved')
    if (
      existsSync(this.currentDirectory(receipt.campaignId)) ||
      !existsSync(this.stagedDirectory(receipt.campaignId)) ||
      !this.isValidCampaignStore(this.replacedPath(receipt.campaignId))
    )
      throw new Error('Replacement campaign directory role is inconsistent')
    renameSync(
      this.stagedDirectory(receipt.campaignId),
      this.currentDirectory(receipt.campaignId)
    )
    return this.advance(receipt, 'replacement_promoted')
  }

  markVerified(
    receipt: CampaignDirectoryTransitionReceipt
  ): CampaignDirectoryTransitionReceipt {
    this.expectPhase(receipt, 'replacement_promoted')
    if (!this.isValidCampaignStore(this.currentPath(receipt.campaignId)))
      throw new Error('Promoted campaign failed durable verification')
    return this.advance(receipt, 'verified')
  }

  completeFilesystem(
    receipt: CampaignDirectoryTransitionReceipt
  ): CampaignDirectoryTransitionReceipt {
    if (receipt.phase !== 'verified' && receipt.phase !== 'complete')
      throw new Error(
        `Cannot complete campaign transition from ${receipt.phase}`
      )
    if (!this.isValidCampaignStore(this.currentPath(receipt.campaignId)))
      throw new Error('Cannot remove original before replacement verification')
    rmSync(this.replacedDirectory(receipt.campaignId), {
      recursive: true,
      force: true
    })
    rmSync(this.stagedDirectory(receipt.campaignId), {
      recursive: true,
      force: true
    })
    return receipt.phase === 'complete'
      ? receipt
      : this.advance(receipt, 'complete')
  }

  rollbackFilesystem(receipt: CampaignDirectoryTransitionReceipt): void {
    const current = this.currentDirectory(receipt.campaignId)
    const staged = this.stagedDirectory(receipt.campaignId)
    const replaced = this.replacedDirectory(receipt.campaignId)

    if (existsSync(replaced)) {
      if (!this.isValidCampaignStore(this.replacedPath(receipt.campaignId)))
        throw new Error('Recorded original campaign is not valid')
      if (existsSync(current)) {
        if (existsSync(staged))
          throw new Error('Campaign transition contains three ambiguous copies')
        renameSync(current, staged)
      }
      renameSync(replaced, current)
    }
    if (!this.isValidCampaignStore(this.currentPath(receipt.campaignId)))
      throw new Error('Campaign transition cannot restore a valid original')

    // The original is now durably reachable; only now may the uncommitted
    // replacement be discarded.
    rmSync(staged, { recursive: true, force: true })
  }

  rollForwardFilesystem(receipt: CampaignDirectoryTransitionReceipt): void {
    if (!this.isValidCampaignStore(this.currentPath(receipt.campaignId)))
      throw new Error('Committed campaign replacement is not valid')
    this.completeFilesystem(
      receipt.phase === 'verified' || receipt.phase === 'complete'
        ? receipt
        : this.advance(receipt, 'verified')
    )
  }

  finish(receipt: CampaignDirectoryTransitionReceipt): void {
    rmSync(this.receiptPath(receipt.campaignId), { force: true })
  }

  receipt(campaignId: string): CampaignDirectoryTransitionReceipt | null {
    const path = this.receiptPath(campaignId)
    if (!existsSync(path)) return null
    return campaignDirectoryTransitionReceiptSchema.parse(
      JSON.parse(readFileSync(path, 'utf8'))
    )
  }

  receipts(): readonly CampaignDirectoryTransitionReceipt[] {
    if (!existsSync(this.receiptDirectory())) return []
    return readdirSync(this.receiptDirectory())
      .filter((name) => name.endsWith('.json'))
      .sort()
      .map((name) =>
        campaignDirectoryTransitionReceiptSchema.parse(
          JSON.parse(readFileSync(join(this.receiptDirectory(), name), 'utf8'))
        )
      )
  }

  recoverLegacy(campaignId: string): void {
    this.requireSafeCampaignId(campaignId)
    const current = this.currentDirectory(campaignId)
    const staged = this.stagedDirectory(campaignId)
    const replaced = this.replacedDirectory(campaignId)
    if (!existsSync(replaced)) return

    if (!existsSync(current)) {
      if (!this.isValidCampaignStore(this.replacedPath(campaignId)))
        throw new Error('Legacy campaign replacement lost its valid original')
      renameSync(replaced, current)
    } else if (!this.isValidCampaignStore(this.currentPath(campaignId))) {
      if (!this.isValidCampaignStore(this.replacedPath(campaignId)))
        throw new Error('Legacy campaign replacement has no valid copy')
      if (existsSync(staged))
        throw new Error('Legacy campaign replacement roles are ambiguous')
      renameSync(current, staged)
      renameSync(replaced, current)
    }

    if (!this.isValidCampaignStore(this.currentPath(campaignId)))
      throw new Error('Legacy campaign replacement recovery failed')
    rmSync(replaced, { recursive: true, force: true })
    rmSync(staged, { recursive: true, force: true })
  }

  private advance(
    receipt: CampaignDirectoryTransitionReceipt,
    phase: CampaignDirectoryTransitionPhase
  ): CampaignDirectoryTransitionReceipt {
    return this.persist({
      ...receipt,
      phase,
      updatedAt: new Date().toISOString()
    })
  }

  private persist(
    input: z.input<typeof campaignDirectoryTransitionReceiptSchema>
  ): CampaignDirectoryTransitionReceipt {
    const receipt = campaignDirectoryTransitionReceiptSchema.parse(input)
    mkdirSync(this.receiptDirectory(), { recursive: true })
    const target = this.receiptPath(receipt.campaignId)
    const temporary = `${target}.${receipt.transitionId}.tmp`
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

  private expectPhase(
    receipt: CampaignDirectoryTransitionReceipt,
    expected: CampaignDirectoryTransitionPhase
  ): void {
    if (receipt.phase !== expected)
      throw new Error(
        `Expected campaign transition phase ${expected}, got ${receipt.phase}`
      )
  }

  private requireSafeCampaignId(id: string): void {
    if (!safeCampaignId.test(id))
      throw new Error('Unsafe campaign directory transition identifier')
  }

  private receiptDirectory(): string {
    return join(this.dataRoot, 'campaigns', '.transitions')
  }

  private receiptPath(id: string): string {
    return join(this.receiptDirectory(), `${id}.json`)
  }

  private currentDirectory(id: string): string {
    return join(this.dataRoot, 'campaigns', id)
  }

  private stagedDirectory(id: string): string {
    return join(this.dataRoot, 'campaigns', '.creating', id)
  }

  private replacedDirectory(id: string): string {
    return join(this.dataRoot, 'campaigns', '.replacing', id)
  }

  private currentPath(id: string): string {
    return join(this.currentDirectory(id), 'campaign.sqlite')
  }

  private stagedPath(id: string): string {
    return join(this.stagedDirectory(id), 'campaign.sqlite')
  }

  private replacedPath(id: string): string {
    return join(this.replacedDirectory(id), 'campaign.sqlite')
  }
}
