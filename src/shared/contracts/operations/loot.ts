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
  'loot.acceptGenerated': write(
    'loot:accept-generated',
    acceptGeneratedTreasureInputSchema,
    treasureSchema
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
  'loot.correctLedger': write(
    'loot:correct-ledger',
    correctCharacterLootInputSchema,
    characterLootLedgerSchema
  )
})
