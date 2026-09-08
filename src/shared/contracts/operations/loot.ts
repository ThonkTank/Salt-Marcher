import { z } from 'zod'
import {
  acceptGeneratedTreasureInputSchema,
  characterLootInputSchema,
  characterLootLedgerSchema,
  commitGroupRewardInputSchema,
  commitGroupRewardResultSchema,
  completeLootDistributionInputSchema,
  correctCharacterLootInputSchema,
  createTreasureInputSchema,
  generateGroupDraftLootInputSchema,
  generateGroupDraftLootResultSchema,
  lootCatalogPageSchema,
  lootCatalogQuerySchema,
  lootDistributionResultSchema,
  lootInboxInputSchema,
  lootInboxPageSchema,
  lootSceneProjectionSchema,
  moveTreasureInputSchema,
  sceneLootInputSchema,
  treasureIdInputSchema,
  treasureSchema,
  treasureEditorCommandSchema,
  treasureEditorStatusSchema,
  updateTreasureInputSchema
} from '../loot.js'
import { read, utilityOperationFragment, write } from './registry.js'

export const lootOperationDefinitions = utilityOperationFragment({
  'loot.read': read('loot:read', treasureIdInputSchema, treasureSchema),
  'loot.catalog': read(
    'loot:catalog',
    lootCatalogQuerySchema,
    lootCatalogPageSchema
  ),
  'loot.generateForGroupDraft': write(
    'loot:generate-for-group-draft',
    generateGroupDraftLootInputSchema,
    generateGroupDraftLootResultSchema
  ),
  'loot.groupRewardReceipt': read(
    'loot:group-reward-receipt',
    commitGroupRewardInputSchema.extend({ campaignId: z.uuid() }),
    commitGroupRewardResultSchema.nullable()
  ),
  'loot.commitGroupReward': write(
    'loot:commit-group-reward',
    commitGroupRewardInputSchema,
    commitGroupRewardResultSchema
  ),
  'loot.scene': read(
    'loot:scene',
    sceneLootInputSchema,
    lootSceneProjectionSchema
  ),
  'loot.inbox': read('loot:inbox', lootInboxInputSchema, lootInboxPageSchema),
  'loot.editorStatus': read(
    'loot:editor-status',
    z
      .object({ campaignId: z.uuid(), command: treasureEditorCommandSchema })
      .strict(),
    treasureEditorStatusSchema
  ),
  'loot.createForCampaign': write(
    'loot:create-for-campaign',
    createTreasureInputSchema.extend({ campaignId: z.uuid() }),
    treasureSchema
  ),
  'loot.updateForCampaign': write(
    'loot:update-for-campaign',
    updateTreasureInputSchema.extend({ campaignId: z.uuid() }),
    treasureSchema
  ),
  'loot.create': write(
    'loot:create',
    createTreasureInputSchema,
    treasureSchema
  ),
  'loot.update': write(
    'loot:update',
    updateTreasureInputSchema,
    treasureSchema
  ),
  'loot.move': write('loot:move', moveTreasureInputSchema, treasureSchema),
  'loot.acceptGeneratedForCampaign': write(
    'loot:accept-generated-for-campaign',
    acceptGeneratedTreasureInputSchema.extend({ campaignId: z.uuid() }),
    treasureSchema
  ),
  'loot.generatedAcceptanceStatus': read(
    'loot:generated-acceptance-status',
    acceptGeneratedTreasureInputSchema.extend({ campaignId: z.uuid() }),
    z
      .object({
        receipt: treasureSchema.nullable(),
        treasure: treasureSchema.nullable()
      })
      .strict()
  ),
  'loot.acceptGenerated': write(
    'loot:accept-generated',
    acceptGeneratedTreasureInputSchema,
    treasureSchema
  ),
  'loot.distributionStatus': read(
    'loot:distribution-status',
    completeLootDistributionInputSchema.extend({ campaignId: z.uuid() }),
    z
      .object({
        receipt: lootDistributionResultSchema.nullable(),
        treasure: treasureSchema,
        partyRevision: z.number().int().nonnegative()
      })
      .strict()
  ),
  'loot.distributeForCampaign': write(
    'loot:distribute-for-campaign',
    completeLootDistributionInputSchema.extend({ campaignId: z.uuid() }),
    lootDistributionResultSchema
  ),
  'loot.distribute': write(
    'loot:distribute',
    completeLootDistributionInputSchema,
    lootDistributionResultSchema
  ),
  'loot.ledger': read(
    'loot:ledger',
    characterLootInputSchema,
    characterLootLedgerSchema
  ),
  'loot.ledgerForCampaign': read(
    'loot:ledger-for-campaign',
    characterLootInputSchema.extend({ campaignId: z.uuid() }),
    characterLootLedgerSchema
  ),
  'loot.ledgerCorrectionStatus': read(
    'loot:ledger-correction-status',
    correctCharacterLootInputSchema.extend({ campaignId: z.uuid() }),
    z
      .object({
        receipt: characterLootLedgerSchema.nullable(),
        ledger: characterLootLedgerSchema
      })
      .strict()
  ),
  'loot.correctLedgerForCampaign': write(
    'loot:correct-ledger-for-campaign',
    correctCharacterLootInputSchema.extend({ campaignId: z.uuid() }),
    characterLootLedgerSchema
  ),
  'loot.correctLedger': write(
    'loot:correct-ledger',
    correctCharacterLootInputSchema,
    characterLootLedgerSchema
  )
})
