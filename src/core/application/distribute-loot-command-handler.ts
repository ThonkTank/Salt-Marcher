import {
  lootDistributionResultSchema,
  type CharacterLootEntry,
  type CompleteLootDistributionInput,
  type LootDistributionResult,
  type Treasure
} from '../../shared/contracts/loot.js'
import type { PartySnapshot } from '../../shared/contracts/party.js'
import type { GeneratedRun } from '../../shared/contracts/session-generation.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { uuidv7 } from '../../shared/ids/uuidv7.js'
import { fingerprintExcluding } from '../fingerprint.js'

type AwardDraft = Readonly<{
  id: string
  commandId: string
  characterId: string
  treasureId: string
  treasureItemId: string
  itemReference: CharacterLootEntry['itemReference']
  quantity: number
  provenance: CharacterLootEntry['provenance']
  rewardProvenance: CharacterLootEntry['rewardProvenance']
  receivedAt: string
}>

export type DistributeLootContext = Readonly<{
  treasures: Readonly<{
    require(id: string): Treasure
    addAllocation(input: {
      id: string
      commandId: string
      treasureId: string
      itemId: string
      characterId: string
      quantity: number
      createdAt: string
    }): void
    completeDistribution(treasureId: string, now: string): void
  }>
  characterLoot: Readonly<{
    addAward(draft: AwardDraft): CharacterLootEntry
    bumpRevisions(characterIds: ReadonlySet<string>): void
    entriesForCommand(commandId: string): readonly CharacterLootEntry[]
  }>
  party: Readonly<{ read(): PartySnapshot }>
  generatedRuns: Readonly<{ read(runId: string): GeneratedRun | null }>
  journal: Readonly<{
    read(input: {
      commandId: string
      operationType: 'distribute'
      requestFingerprint: string
      schema: typeof lootDistributionResultSchema
    }): Readonly<{ targetId: string; result: LootDistributionResult }> | null
    record(input: {
      commandId: string
      operationType: 'distribute'
      requestFingerprint: string
      targetId: string
      schema: typeof lootDistributionResultSchema
      result: LootDistributionResult
    }): void
  }>
  projections: Readonly<{ bumpRevision(): void }>
  now(): string
}>

export class DistributeLootCommandHandler {
  constructor(
    private readonly context: () => DistributeLootContext,
    private readonly transact: <T>(work: () => T) => T
  ) {}

  distribute(input: CompleteLootDistributionInput): LootDistributionResult {
    return this.transact(() => this.execute(input))
  }

  private execute(
    input: CompleteLootDistributionInput
  ): LootDistributionResult {
    const context = this.context()
    const requestFingerprint = fingerprintExcluding(input, ['commandId'])
    const receipt = context.journal.read({
      commandId: input.commandId,
      operationType: 'distribute',
      requestFingerprint,
      schema: lootDistributionResultSchema
    })
    if (receipt) return receipt.result

    const treasure = context.treasures.require(input.treasureId)
    if (treasure.revision !== input.expectedTreasureRevision)
      throw new CapabilityError('stale', true)
    const party = context.party.read()
    if (party.revision !== input.expectedPartyRevision)
      throw new CapabilityError('stale', true)
    const activeRecipients = new Map(
      party.members
        .filter((member) => member.active)
        .map((member) => [member.id, member] as const)
    )
    const itemIds = new Set<string>()
    const awardedCharacterIds = new Set<string>()
    const now = context.now()
    const generatedSource =
      treasure.source.kind === 'generated' ? treasure.source : null
    const generated = generatedSource
      ? context.generatedRuns
          .read(generatedSource.runId)
          ?.treasures.find(
            (candidate) => candidate.id === generatedSource.generatedTreasureId
          )
      : null
    const rewardProvenance =
      generatedSource && generated
        ? {
            runId: generatedSource.runId,
            generatedTreasureId: generatedSource.generatedTreasureId,
            rewardChannel: generated.rewardChannel
          }
        : null

    for (const distribution of input.items) {
      if (itemIds.has(distribution.itemId)) invalid()
      itemIds.add(distribution.itemId)
      const item = treasure.items.find(
        (candidate) => candidate.id === distribution.itemId
      )
      if (!item) throw new CapabilityError('not_found', false)
      const recipientIds = new Set<string>()
      let allocated = 0
      for (const share of distribution.shares) {
        const recipient = activeRecipients.get(share.characterId)
        if (!recipient || recipientIds.has(share.characterId)) invalid()
        recipientIds.add(share.characterId)
        allocated += share.quantity
      }
      if (allocated > item.quantity - item.allocatedQuantity) invalid()
      if (
        !item.definition.stackable &&
        allocated !== item.quantity - item.allocatedQuantity
      )
        invalid()

      for (const share of distribution.shares) {
        const recipient = activeRecipients.get(share.characterId)!
        awardedCharacterIds.add(share.characterId)
        context.treasures.addAllocation({
          id: uuidv7(),
          commandId: input.commandId,
          treasureId: treasure.id,
          itemId: item.id,
          characterId: share.characterId,
          quantity: share.quantity,
          createdAt: now
        })
        context.characterLoot.addAward({
          id: uuidv7(),
          commandId: input.commandId,
          characterId: share.characterId,
          treasureId: treasure.id,
          treasureItemId: item.id,
          itemReference: item.itemReference,
          quantity: share.quantity,
          provenance: {
            kind: 'treasure_distribution',
            treasureLabel: treasure.label,
            recipientName: recipient.name
          },
          rewardProvenance,
          receivedAt: now
        })
      }
    }
    context.characterLoot.bumpRevisions(awardedCharacterIds)
    context.treasures.completeDistribution(treasure.id, now)
    context.projections.bumpRevision()
    const result = lootDistributionResultSchema.parse({
      treasure: context.treasures.require(treasure.id),
      createdEntries: context.characterLoot.entriesForCommand(input.commandId)
    })
    context.journal.record({
      commandId: input.commandId,
      operationType: 'distribute',
      requestFingerprint,
      targetId: treasure.id,
      schema: lootDistributionResultSchema,
      result
    })
    return result
  }
}

function invalid(): never {
  throw new CapabilityError('validation_failed', false)
}
