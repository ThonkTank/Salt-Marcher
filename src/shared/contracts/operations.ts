import { z } from 'zod'
import {
  activateCampaignInputSchema,
  campaignIdInputSchema,
  campaignSnapshotSchema,
  createCampaignInputSchema,
  permanentlyDeleteCampaignInputSchema,
  renameCampaignInputSchema
} from './campaign.js'
import {
  campaignImportApplyInputSchema,
  campaignImportApplyResultSchema,
  campaignImportReportSchema,
  campaignImportValidateInputSchema
} from './campaign-import.js'
import {
  creatureCatalogPageSchema,
  creatureCatalogQuerySchema,
  creatureFilterOptionsSchema,
  creatureSchema
} from './encounter.js'
import {
  adjustInitiativeInputSchema,
  awardCombatXpInputSchema,
  changeHpInputSchema,
  combatCommandResultSchema,
  combatRevisionInputSchema,
  confirmInitiativeInputSchema,
  joinCombatGroupInputSchema,
  hexTravelContextResultSchema,
  liveSessionSnapshotSchema,
  moveCombatPhaseInputSchema,
  partySnapshotSchema,
  prepareCombatInputSchema,
  sceneGroupCommandResultSchema,
  setConcentrationInputSchema,
  setExhaustionInputSchema,
  toggleConditionInputSchema,
  updateResolutionInputSchema
} from './live-session.js'
import {
  adjustPartyXpInputSchema,
  adventuringDayCalculationSchema,
  adventuringDayInputSchema,
  createPartyCharacterInputSchema,
  deletePartyCharacterInputSchema,
  restPartyInputSchema,
  setMembershipInputSchema,
  updatePartyCharacterInputSchema
} from './party.js'
import {
  assignScenePartyInputSchema,
  deleteSceneGroupInputSchema,
  encounterSelectionEvaluationSchema,
  evaluateEncounterSelectionInputSchema,
  evaluateSceneGroupDraftInputSchema,
  focusSceneInputSchema,
  saveSceneGroupInputSchema,
  sceneGroupDraftEvaluationSchema,
  sceneGroupDraftGenerationRequestSchema,
  sceneGroupDraftGenerationSchema,
  setSceneGroupArchivedInputSchema,
  setSceneLocationInputSchema
} from './scene.js'
import {
  deleteWorldLocationInputSchema,
  saveWorldLocationInputSchema,
  worldLocationPlacementCommandSchema,
  worldLocationPlacementCommitResultSchema,
  updateWorldLocationMapPresentationInputSchema,
  worldLocationMapPresentationSchema,
  worldLocationDeleteReceiptSchema,
  worldLocationSaveReceiptInputSchema,
  worldLocationSaveReceiptSchema,
  worldLocationSnapshotSchema,
  worldLocationTagSearchInputSchema,
  worldLocationTagSuggestionsSchema
} from './world-location.js'
import {
  createLocationSymbolInputSchema,
  deleteLocationSymbolInputSchema,
  importLocationSymbolInputSchema,
  importLocationSymbolResultSchema,
  locationSymbolMutationReceiptSchema,
  locationSymbolDeleteImpactSchema,
  locationSymbolDeleteResultSchema,
  locationSymbolDetailInputSchema,
  locationSymbolPageSchema,
  locationSymbolSchema,
  locationSymbolSearchInputSchema,
  locationSymbolSnapshotSchema,
  updateLocationSymbolInputSchema,
  svgSymbolFileResultSchema
} from './location-symbol.js'
import {
  biomeCatalogMutationResultSchema,
  biomeDeleteImpactSchema,
  biomeDetailInputSchema,
  biomeDefinitionSchema,
  biomePageSchema,
  biomeSearchInputSchema,
  createBiomeInputSchema,
  deleteBiomeInputSchema,
  updateBiomeInputSchema
} from './biome.js'
import {
  createEncounterTableInputSchema,
  createWorldFactionInputSchema,
  deleteEncounterTableInputSchema,
  deleteWorldFactionInputSchema,
  encounterTableCommandReceiptInputSchema,
  encounterTableCommandReceiptSchema,
  encounterTableDeleteReceiptSchema,
  encounterTableMutationReceiptSchema,
  encounterTableSnapshotSchema,
  updateEncounterTableInputSchema,
  updateWorldFactionInputSchema,
  worldFactionCommandReceiptInputSchema,
  worldFactionCommandReceiptSchema,
  worldFactionDeleteReceiptSchema,
  worldFactionMutationReceiptSchema,
  worldFactionSnapshotSchema
} from './encounter-source.js'
import {
  applyHexBrushStrokeInputSchema,
  createHexMapInputSchema,
  evaluateHexRouteInputSchema,
  hexChunkReadResultSchema,
  hexBrushStrokeResultSchema,
  hexLocationPlacementReferenceSchema,
  hexMapCatalogSnapshotSchema,
  hexRouteEvaluationSchema,
  hexBiomeCatalogSchema,
  hexHistoryStateSchema,
  hexCommandIdInputSchema,
  hexEditorBootstrapSchema,
  hexMapIdInputSchema,
  hexRuntimeOverlayProjectionSchema,
  mutateHexHistoryInputSchema,
  mutateHexTravelInputSchema,
  positionHexPartyInputSchema,
  readHexChunksInputSchema,
  replaceMapBiomePlaceholderInputSchema,
  replaceMapBiomePlaceholderResultSchema,
  setHexTravelMultiplierInputSchema,
  startHexTravelInputSchema,
  updateHexMapInputSchema
} from './hex.js'
import {
  installationSettingsSchema,
  updateInstallationSettingsInputSchema
} from './settings.js'
import {
  campaignRulesCommandReceiptInputSchema,
  campaignRulesSchema,
  updateCampaignRulesInputSchema
} from './campaign-rules.js'
import { passiveProjectionSchema } from './passive-display.js'
import { coreProcessStatusSchema, rendererIncidentSchema } from './runtime.js'
import { runtimeGpuObservationSchema } from '../qualification/runtime-observation.js'
import {
  referenceCampaignIndexInputSchema,
  referenceDocumentSchema,
  referenceIndexSchema,
  referenceTargetSchema
} from './reference.js'
import {
  generatedEncounterPlanSummaryBatchQuerySchema,
  generatedEncounterPlanSummaryBatchResultSchema,
  savedEncounterPlanSearchResultSchema,
  searchSavedEncounterPlansQuerySchema
} from './encounter-plans.js'
import {
  cancelSessionPreparationResultSchema,
  createSessionPlanInputSchema,
  deleteSessionPlanInputSchema,
  openSessionPlanInputSchema,
  renameSessionPlanInputSchema,
  saveSessionPlanInputSchema,
  sessionPreparationReceiptInputSchema,
  sessionPreparationReceiptResultSchema,
  sessionPlannerWorkspaceSchema,
  startSessionPreparationInputSchema,
  startSessionPreparationResultSchema,
  switchSessionPlanInputSchema
} from './session-planner.js'
import { sessionGenerationCatalogReferenceSchema } from './session-generation.js'
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
} from './loot.js'
import {
  assignGeneratorPresetReceiptSchema,
  createGeneratorPresetReceiptSchema,
  deleteGeneratorPresetReceiptSchema,
  generatorPresetAssignInputSchema,
  generatorPresetCommandReceiptInputSchema,
  generatorPresetCommandReceiptSchema,
  generatorPresetCreateInputSchema,
  generatorPresetDeleteInputSchema,
  generatorPresetEditorSnapshotSchema,
  generatorPresetReadEditorInputSchema,
  generatorPresetUpdateInputSchema,
  updateGeneratorPresetReceiptSchema
} from './generator-presets.js'
import {
  createWorldNpcInputSchema,
  deleteWorldNpcInputSchema,
  updateWorldNpcInputSchema,
  worldNpcCommandReceiptInputSchema,
  worldNpcCommandReceiptSchema,
  worldNpcDeleteReceiptSchema,
  worldNpcDetailInputSchema,
  worldNpcDetailProjectionSchema,
  worldNpcMutationReceiptSchema,
  worldNpcPageSchema,
  worldNpcSearchInputSchema
} from './world-npc.js'

export type OperationMode = 'read' | 'write'
export type WindowRole = 'gm' | 'passive' | 'qualification'

export interface OperationDefinition<
  Input extends z.ZodType = z.ZodType,
  Output extends z.ZodType = z.ZodType
> {
  readonly channel: string | null
  readonly input: Input
  readonly output: Output
  readonly mode: OperationMode
  readonly roles: readonly WindowRole[]
  readonly deadlineMs: number
  readonly namespace?: string
  readonly method?: string
}

const read = <Input extends z.ZodType, Output extends z.ZodType>(
  channel: string | null,
  input: Input,
  output: Output,
  roles: readonly WindowRole[] = ['gm']
): OperationDefinition<Input, Output> => ({
  channel,
  input,
  output,
  mode: 'read',
  roles,
  deadlineMs: 10_000
})

const write = <Input extends z.ZodType, Output extends z.ZodType>(
  channel: string | null,
  input: Input,
  output: Output,
  roles: readonly WindowRole[] = ['gm']
): OperationDefinition<Input, Output> => ({
  channel,
  input,
  output,
  mode: 'write',
  roles,
  deadlineMs: 10_000
})

const none = z.undefined()
const sceneId = z.object({ sceneId: z.uuid() }).strict()
const creatureId = z.object({ id: z.string().min(1) }).strict()
const locationId = z.object({ locationId: z.uuid() }).strict()

/**
 * The one authoritative description of every renderer-to-core operation.
 * Main, preload and the utility dispatcher consume this table directly.
 */
const coreOperationDefinitions = {
  'campaign.list': read('campaign:list', none, campaignSnapshotSchema),
  'campaign.create': write(
    'campaign:create',
    createCampaignInputSchema,
    campaignSnapshotSchema
  ),
  'campaign.activate': write(
    'campaign:activate',
    activateCampaignInputSchema,
    campaignSnapshotSchema
  ),
  'campaign.rename': write(
    'campaign:rename',
    renameCampaignInputSchema,
    campaignSnapshotSchema
  ),
  'campaign.trash': write(
    'campaign:trash',
    campaignIdInputSchema,
    campaignSnapshotSchema
  ),
  'campaign.restore': write(
    'campaign:restore',
    campaignIdInputSchema,
    campaignSnapshotSchema
  ),
  'campaign.deleteForever': write(
    'campaign:deleteForever',
    permanentlyDeleteCampaignInputSchema,
    campaignSnapshotSchema
  ),
  'campaignImport.validate': read(
    'campaign-import:validate',
    campaignImportValidateInputSchema,
    campaignImportReportSchema
  ),
  'campaignImport.preview': read(
    'campaign-import:preview',
    campaignImportValidateInputSchema,
    campaignImportReportSchema
  ),
  'campaignImport.apply': write(
    'campaign-import:apply',
    campaignImportApplyInputSchema,
    campaignImportApplyResultSchema
  ),
  'settings.read': read('settings:read', none, installationSettingsSchema),
  'settings.update': write(
    'settings:update',
    updateInstallationSettingsInputSchema,
    installationSettingsSchema
  ),
  'campaignRules.read': read('campaign-rules:read', none, campaignRulesSchema),
  'campaignRules.update': write(
    'campaign-rules:update',
    updateCampaignRulesInputSchema,
    campaignRulesSchema
  ),
  'campaignRules.commandReceipt': read(
    'campaign-rules:command-receipt',
    campaignRulesCommandReceiptInputSchema,
    campaignRulesSchema.nullable()
  ),
  'generatorPresets.readEditor': read(
    'generator-presets:read-editor',
    generatorPresetReadEditorInputSchema,
    generatorPresetEditorSnapshotSchema
  ),
  'generatorPresets.create': write(
    'generator-presets:create',
    generatorPresetCreateInputSchema,
    createGeneratorPresetReceiptSchema
  ),
  'generatorPresets.update': write(
    'generator-presets:update',
    generatorPresetUpdateInputSchema,
    updateGeneratorPresetReceiptSchema
  ),
  'generatorPresets.delete': write(
    'generator-presets:delete',
    generatorPresetDeleteInputSchema,
    deleteGeneratorPresetReceiptSchema
  ),
  'generatorPresets.assign': write(
    'generator-presets:assign',
    generatorPresetAssignInputSchema,
    assignGeneratorPresetReceiptSchema
  ),
  'generatorPresets.commandReceipt': read(
    'generator-presets:command-receipt',
    generatorPresetCommandReceiptInputSchema,
    generatorPresetCommandReceiptSchema.nullable()
  ),
  'projection.read': read('projection:read', none, passiveProjectionSchema, [
    'passive'
  ]),
  'party.read': read('party:read', none, partySnapshotSchema),
  'party.setMembership': write(
    'party:setMembership',
    setMembershipInputSchema,
    partySnapshotSchema
  ),
  'party.create': write(
    'party:create',
    createPartyCharacterInputSchema,
    partySnapshotSchema
  ),
  'party.update': write(
    'party:update',
    updatePartyCharacterInputSchema,
    partySnapshotSchema
  ),
  'party.delete': write(
    'party:delete',
    deletePartyCharacterInputSchema,
    partySnapshotSchema
  ),
  'party.adjustXp': write(
    'party:adjustXp',
    adjustPartyXpInputSchema,
    partySnapshotSchema
  ),
  'party.rest': write('party:rest', restPartyInputSchema, partySnapshotSchema),
  'party.calculateAdventuringDay': read(
    'party:calculateAdventuringDay',
    adventuringDayInputSchema,
    adventuringDayCalculationSchema
  ),
  'creatures.search': read(
    'creatures:search',
    creatureCatalogQuerySchema,
    creatureCatalogPageSchema
  ),
  'creatures.filterOptions': read(
    'creatures:filterOptions',
    none,
    creatureFilterOptionsSchema
  ),
  'creatures.detail': read('creatures:detail', creatureId, creatureSchema),
  'references.staticIndex': read(
    'references:static-index',
    none,
    referenceIndexSchema
  ),
  'references.campaignIndex': read(
    'references:campaign-index',
    referenceCampaignIndexInputSchema,
    referenceIndexSchema
  ),
  'references.detail': read(
    'references:detail',
    referenceTargetSchema,
    referenceDocumentSchema
  ),
  'locations.read': read('locations:read', none, worldLocationSnapshotSchema),
  'locations.suggestTags': read(
    'locations:suggest-tags',
    worldLocationTagSearchInputSchema,
    worldLocationTagSuggestionsSchema
  ),
  'locations.save': write(
    'locations:save',
    saveWorldLocationInputSchema,
    worldLocationSaveReceiptSchema
  ),
  'locations.saveReceipt': read(
    'locations:save-receipt',
    worldLocationSaveReceiptInputSchema,
    worldLocationSaveReceiptSchema.nullable()
  ),
  'locations.commitPlacement': write(
    'locations:commit-placement',
    worldLocationPlacementCommandSchema,
    worldLocationPlacementCommitResultSchema
  ),
  'locations.updateMapPresentation': write(
    'locations:update-map-presentation',
    updateWorldLocationMapPresentationInputSchema,
    worldLocationMapPresentationSchema
  ),
  'locations.delete': write(
    'locations:delete',
    deleteWorldLocationInputSchema,
    worldLocationDeleteReceiptSchema
  ),
  'locationSymbols.create': write(
    'location-symbols:create',
    createLocationSymbolInputSchema,
    locationSymbolMutationReceiptSchema
  ),
  'locationSymbols.search': read(
    'location-symbols:search',
    locationSymbolSearchInputSchema,
    locationSymbolPageSchema
  ),
  'locationSymbols.detail': read(
    'location-symbols:detail',
    locationSymbolDetailInputSchema,
    locationSymbolSchema
  ),
  'locationSymbols.update': write(
    'location-symbols:update',
    updateLocationSymbolInputSchema,
    locationSymbolSnapshotSchema
  ),
  'locationSymbols.deleteImpact': read(
    'location-symbols:delete-impact',
    z.object({ id: z.uuid() }).strict(),
    locationSymbolDeleteImpactSchema
  ),
  'locationSymbols.delete': write(
    'location-symbols:delete',
    deleteLocationSymbolInputSchema,
    locationSymbolDeleteResultSchema
  ),
  'locationSymbols.importAndAssign': write(
    'location-symbols:import-and-assign',
    importLocationSymbolInputSchema,
    importLocationSymbolResultSchema
  ),
  'biomes.search': read(
    'biomes:search',
    biomeSearchInputSchema,
    biomePageSchema
  ),
  'biomes.detail': read(
    'biomes:detail',
    biomeDetailInputSchema,
    biomeDefinitionSchema
  ),
  'biomes.create': write(
    'biomes:create',
    createBiomeInputSchema,
    biomeCatalogMutationResultSchema
  ),
  'biomes.update': write(
    'biomes:update',
    updateBiomeInputSchema,
    biomeCatalogMutationResultSchema
  ),
  'biomes.deleteImpact': read(
    'biomes:delete-impact',
    biomeDetailInputSchema,
    biomeDeleteImpactSchema
  ),
  'biomes.delete': write(
    'biomes:delete',
    deleteBiomeInputSchema,
    biomeCatalogMutationResultSchema
  ),
  'encounterTables.read': read(
    'encounter-tables:read',
    none,
    encounterTableSnapshotSchema
  ),
  'encounterTables.commandReceipt': read(
    'encounter-tables:command-receipt',
    encounterTableCommandReceiptInputSchema,
    encounterTableCommandReceiptSchema.nullable()
  ),
  'encounterTables.create': write(
    'encounter-tables:create',
    createEncounterTableInputSchema,
    encounterTableMutationReceiptSchema
  ),
  'encounterTables.update': write(
    'encounter-tables:update',
    updateEncounterTableInputSchema,
    encounterTableMutationReceiptSchema
  ),
  'encounterTables.delete': write(
    'encounter-tables:delete',
    deleteEncounterTableInputSchema,
    encounterTableDeleteReceiptSchema
  ),
  'factions.read': read('factions:read', none, worldFactionSnapshotSchema),
  'factions.commandReceipt': read(
    'factions:command-receipt',
    worldFactionCommandReceiptInputSchema,
    worldFactionCommandReceiptSchema.nullable()
  ),
  'factions.create': write(
    'factions:create',
    createWorldFactionInputSchema,
    worldFactionMutationReceiptSchema
  ),
  'factions.update': write(
    'factions:update',
    updateWorldFactionInputSchema,
    worldFactionMutationReceiptSchema
  ),
  'factions.delete': write(
    'factions:delete',
    deleteWorldFactionInputSchema,
    worldFactionDeleteReceiptSchema
  ),
  'npcs.search': read(
    'npcs:search',
    worldNpcSearchInputSchema,
    worldNpcPageSchema
  ),
  'npcs.detail': read(
    'npcs:detail',
    worldNpcDetailInputSchema,
    worldNpcDetailProjectionSchema
  ),
  'npcs.commandReceipt': read(
    'npcs:command-receipt',
    worldNpcCommandReceiptInputSchema,
    worldNpcCommandReceiptSchema.nullable()
  ),
  'npcs.create': write(
    'npcs:create',
    createWorldNpcInputSchema,
    worldNpcMutationReceiptSchema
  ),
  'npcs.update': write(
    'npcs:update',
    updateWorldNpcInputSchema,
    worldNpcMutationReceiptSchema
  ),
  'npcs.delete': write(
    'npcs:delete',
    deleteWorldNpcInputSchema,
    worldNpcDeleteReceiptSchema
  ),
  'session.read': read('session:read', none, liveSessionSnapshotSchema),
  'encounterPlans.summaries': read(
    'encounter-plans:summaries',
    generatedEncounterPlanSummaryBatchQuerySchema,
    generatedEncounterPlanSummaryBatchResultSchema
  ),
  'encounterPlans.search': read(
    'encounter-plans:search',
    searchSavedEncounterPlansQuerySchema,
    savedEncounterPlanSearchResultSchema
  ),
  'sessionPlanner.read': read(
    'session-planner:read',
    none,
    sessionPlannerWorkspaceSchema
  ),
  'sessionPlanner.create': write(
    'session-planner:create',
    createSessionPlanInputSchema,
    sessionPlannerWorkspaceSchema
  ),
  'sessionPlanner.open': write(
    'session-planner:open',
    openSessionPlanInputSchema,
    sessionPlannerWorkspaceSchema
  ),
  'sessionPlanner.switch': write(
    'session-planner:switch',
    switchSessionPlanInputSchema,
    sessionPlannerWorkspaceSchema
  ),
  'sessionPlanner.rename': write(
    'session-planner:rename',
    renameSessionPlanInputSchema,
    sessionPlannerWorkspaceSchema
  ),
  'sessionPlanner.save': write(
    'session-planner:save',
    saveSessionPlanInputSchema,
    sessionPlannerWorkspaceSchema
  ),
  'sessionPlanner.delete': write(
    'session-planner:delete',
    deleteSessionPlanInputSchema,
    sessionPlannerWorkspaceSchema
  ),
  'sessionPlanner.startPreparation': write(
    'session-planner:start-preparation',
    startSessionPreparationInputSchema,
    startSessionPreparationResultSchema
  ),
  'sessionPlanner.preparationReceipt': read(
    'session-planner:preparation-receipt',
    sessionPreparationReceiptInputSchema,
    sessionPreparationReceiptResultSchema
  ),
  'sessionPlanner.cancelPreparation': write(
    'session-planner:cancel-preparation',
    sessionPreparationReceiptInputSchema,
    cancelSessionPreparationResultSchema
  ),
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
  ),
  'scene.focus': write(
    'scene:focus',
    focusSceneInputSchema,
    liveSessionSnapshotSchema
  ),
  'scene.setLocation': write(
    'scene:setLocation',
    setSceneLocationInputSchema,
    liveSessionSnapshotSchema
  ),
  'scene.saveGroup': write(
    'scene:saveGroup',
    saveSceneGroupInputSchema,
    sceneGroupCommandResultSchema
  ),
  'scene.deleteGroup': write(
    'scene:deleteGroup',
    deleteSceneGroupInputSchema,
    sceneGroupCommandResultSchema
  ),
  'scene.setGroupArchived': write(
    'scene:setGroupArchived',
    setSceneGroupArchivedInputSchema,
    sceneGroupCommandResultSchema
  ),
  'scene.assignPartyMember': write(
    'scene:assignPartyMember',
    assignScenePartyInputSchema,
    liveSessionSnapshotSchema
  ),
  'scene.evaluateGroupDraft': read(
    'scene:evaluateGroupDraft',
    evaluateSceneGroupDraftInputSchema,
    sceneGroupDraftEvaluationSchema
  ),
  'scene.generateGroupDraft': read(
    'scene:generateGroupDraft',
    sceneGroupDraftGenerationRequestSchema,
    sceneGroupDraftGenerationSchema
  ),
  'encounter.evaluate': read(
    'encounter:evaluate',
    evaluateEncounterSelectionInputSchema,
    encounterSelectionEvaluationSchema
  ),
  'combat.prepare': write(
    'combat:prepare',
    prepareCombatInputSchema,
    combatCommandResultSchema
  ),
  'combat.joinGroup': write(
    'combat:joinGroup',
    joinCombatGroupInputSchema,
    combatCommandResultSchema
  ),
  'combat.rollInitiative': write(
    'combat:rollInitiative',
    combatRevisionInputSchema,
    combatCommandResultSchema
  ),
  'combat.confirmInitiative': write(
    'combat:confirmInitiative',
    confirmInitiativeInputSchema,
    combatCommandResultSchema
  ),
  'combat.advanceTurn': write(
    'combat:advanceTurn',
    combatRevisionInputSchema,
    combatCommandResultSchema
  ),
  'combat.retreatTurn': write(
    'combat:retreatTurn',
    combatRevisionInputSchema,
    combatCommandResultSchema
  ),
  'combat.adjustInitiative': write(
    'combat:adjustInitiative',
    adjustInitiativeInputSchema,
    combatCommandResultSchema
  ),
  'combat.changeHp': write(
    'combat:changeHp',
    changeHpInputSchema,
    combatCommandResultSchema
  ),
  'combat.toggleCondition': write(
    'combat:toggleCondition',
    toggleConditionInputSchema,
    combatCommandResultSchema
  ),
  'combat.setConcentration': write(
    'combat:setConcentration',
    setConcentrationInputSchema,
    combatCommandResultSchema
  ),
  'combat.setExhaustion': write(
    'combat:setExhaustion',
    setExhaustionInputSchema,
    combatCommandResultSchema
  ),
  'combat.undo': write(
    'combat:undo',
    combatRevisionInputSchema,
    combatCommandResultSchema
  ),
  'combat.end': write(
    'combat:end',
    combatRevisionInputSchema,
    combatCommandResultSchema
  ),
  'combat.moveToPhase': write(
    'combat:moveToPhase',
    moveCombatPhaseInputSchema,
    combatCommandResultSchema
  ),
  'combat.updateResolution': write(
    'combat:updateResolution',
    updateResolutionInputSchema,
    combatCommandResultSchema
  ),
  'combat.awardXp': write(
    'combat:awardXp',
    awardCombatXpInputSchema,
    combatCommandResultSchema
  ),
  'combat.complete': write(
    'combat:complete',
    combatRevisionInputSchema,
    combatCommandResultSchema
  ),
  'hex.biomeCatalog': read('hex:biomeCatalog', none, hexBiomeCatalogSchema),
  'hex.editorBootstrap': read(
    'hex:editorBootstrap',
    none,
    hexEditorBootstrapSchema
  ),
  'hex.catalog': read('hex:catalog', none, hexMapCatalogSnapshotSchema),
  'hex.locateLocation': read(
    'hex:locateLocation',
    locationId,
    hexLocationPlacementReferenceSchema
  ),
  'hex.readChunks': read(
    'hex:readChunks',
    readHexChunksInputSchema,
    hexChunkReadResultSchema
  ),
  'hex.replaceBiomePlaceholder': write(
    'hex:replaceBiomePlaceholder',
    replaceMapBiomePlaceholderInputSchema,
    replaceMapBiomePlaceholderResultSchema
  ),
  'hex.create': write(
    'hex:create',
    createHexMapInputSchema,
    hexBrushStrokeResultSchema
  ),
  'hex.update': write(
    'hex:update',
    updateHexMapInputSchema,
    hexBrushStrokeResultSchema
  ),
  'hex.applyBrushStroke': write(
    'hex:applyBrushStroke',
    applyHexBrushStrokeInputSchema,
    hexBrushStrokeResultSchema
  ),
  'hex.history': read(
    'hex:history',
    hexMapIdInputSchema,
    hexHistoryStateSchema
  ),
  'hex.undo': write(
    'hex:undo',
    mutateHexHistoryInputSchema,
    hexBrushStrokeResultSchema
  ),
  'hex.redo': write(
    'hex:redo',
    mutateHexHistoryInputSchema,
    hexBrushStrokeResultSchema
  ),
  'hex.commandReceipt': read(
    'hex:commandReceipt',
    hexCommandIdInputSchema,
    hexBrushStrokeResultSchema.nullable()
  ),
  'hex.runtimeOverlays': read(
    'hex:runtimeOverlays',
    hexMapIdInputSchema,
    hexRuntimeOverlayProjectionSchema
  ),
  'hexTravel.read': read(
    'hex-travel:read',
    sceneId,
    hexTravelContextResultSchema
  ),
  'hexTravel.evaluate': read(
    'hex-travel:evaluate',
    evaluateHexRouteInputSchema,
    hexRouteEvaluationSchema
  ),
  'hexTravel.position': write(
    'hex-travel:position',
    positionHexPartyInputSchema,
    hexTravelContextResultSchema
  ),
  'hexTravel.start': write(
    'hex-travel:start',
    startHexTravelInputSchema,
    hexTravelContextResultSchema
  ),
  'hexTravel.pause': write(
    'hex-travel:pause',
    mutateHexTravelInputSchema,
    hexTravelContextResultSchema
  ),
  'hexTravel.resume': write(
    'hex-travel:resume',
    mutateHexTravelInputSchema,
    hexTravelContextResultSchema
  ),
  'hexTravel.abort': write(
    'hex-travel:abort',
    mutateHexTravelInputSchema,
    hexTravelContextResultSchema
  ),
  'hexTravel.setMultiplier': write(
    'hex-travel:setMultiplier',
    setHexTravelMultiplierInputSchema,
    hexTravelContextResultSchema
  ),
  'core.sessionGenerationCatalog': read(
    null,
    none,
    sessionGenerationCatalogReferenceSchema,
    []
  ),
  'core.shutdown': write(null, none, z.unknown(), [])
} as const

export const coreOperations = registerOperations(coreOperationDefinitions)

/**
 * Main-owned capabilities use the same contract shape as Core operations.
 * Keeping them here means every renderer invocation has one authoritative
 * channel, input, output, mode, role and deadline definition.
 */
const mainOperationDefinitions = {
  'runtime.memory': read(
    'runtime:memory',
    none,
    z.number().int().nonnegative(),
    ['gm', 'qualification']
  ),
  'runtime.gpuObservation': read(
    'runtime:gpu-observation',
    none,
    runtimeGpuObservationSchema,
    ['gm', 'qualification']
  ),
  'runtime.coreStatus': read(
    'runtime:core-status',
    none,
    coreProcessStatusSchema,
    ['gm', 'passive', 'qualification']
  ),
  'runtime.retryCore': write(
    'runtime:retry-core',
    none,
    coreProcessStatusSchema,
    ['gm', 'qualification']
  ),
  'runtime.reportRendererIncident': write(
    'runtime:report-renderer-incident',
    rendererIncidentSchema,
    none,
    ['gm']
  ),
  'runtime.reloadRenderer': write('runtime:reload-renderer', none, none, [
    'gm'
  ]),
  'runtime.pickLocationSymbolFile': write(
    'runtime:pick-location-symbol-file',
    none,
    svgSymbolFileResultSchema,
    ['gm']
  )
} as const

export const mainOperations = registerOperations(mainOperationDefinitions)

function registerOperations<
  const Definitions extends Readonly<Record<string, OperationDefinition>>
>(
  definitions: Definitions
): {
  readonly [Kind in keyof Definitions]: Definitions[Kind] &
    Readonly<{ namespace: string; method: string }>
} {
  return Object.fromEntries(
    Object.entries(definitions).map(([kind, definition]) => {
      const separator = kind.indexOf('.')
      if (separator < 1 || separator === kind.length - 1)
        throw new Error(`invalid_operation_kind:${kind}`)
      return [
        kind,
        {
          ...definition,
          namespace: kind.slice(0, separator),
          method: kind.slice(separator + 1)
        }
      ]
    })
  ) as {
    readonly [Kind in keyof Definitions]: Definitions[Kind] &
      Readonly<{ namespace: string; method: string }>
  }
}

export type CoreOperationKind = keyof typeof coreOperations
export type MainOperationKind = keyof typeof mainOperations
export type CoreOperationInput<K extends CoreOperationKind> = z.output<
  (typeof coreOperations)[K]['input']
>
export type CoreOperationOutput<K extends CoreOperationKind> = z.output<
  (typeof coreOperations)[K]['output']
>
export type MainOperationInput<K extends MainOperationKind> = z.output<
  (typeof mainOperations)[K]['input']
>
export type MainOperationOutput<K extends MainOperationKind> = z.output<
  (typeof mainOperations)[K]['output']
>

export function isCoreOperationKind(value: string): value is CoreOperationKind {
  return Object.hasOwn(coreOperations, value)
}

export function operationForChannel(
  channel: string
):
  | readonly [CoreOperationKind, (typeof coreOperations)[CoreOperationKind]]
  | null {
  for (const [kind, definition] of Object.entries(coreOperations))
    if (definition.channel === channel)
      return [kind as CoreOperationKind, definition] as const
  return null
}

export function mainOperationForChannel(
  channel: string
):
  | readonly [MainOperationKind, (typeof mainOperations)[MainOperationKind]]
  | null {
  for (const [kind, definition] of Object.entries(mainOperations))
    if (definition.channel === channel)
      return [kind as MainOperationKind, definition] as const
  return null
}
