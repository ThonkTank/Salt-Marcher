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
  creatureCatalogPageSchema,
  creatureCatalogQuerySchema,
  creatureFilterOptionsSchema,
  creatureSchema
} from './encounter.js'
import {
  adjustInitiativeInputSchema,
  changeHpInputSchema,
  combatCommandResultSchema,
  combatRevisionInputSchema,
  confirmInitiativeInputSchema,
  joinCombatGroupInputSchema,
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
  createWorldLocationInputSchema,
  createWorldLocationResultSchema,
  deleteWorldLocationInputSchema,
  updateWorldLocationInputSchema,
  updateWorldLocationMapPresentationInputSchema,
  worldLocationMapPresentationSchema,
  worldLocationSnapshotSchema
} from './world-location.js'
import {
  createLocationSymbolInputSchema,
  deleteLocationSymbolInputSchema,
  importLocationSymbolInputSchema,
  importLocationSymbolResultSchema,
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
  createEncounterTableInputSchema,
  createWorldFactionInputSchema,
  deleteEncounterTableInputSchema,
  deleteWorldFactionInputSchema,
  encounterTableSnapshotSchema,
  updateEncounterTableInputSchema,
  updateWorldFactionInputSchema,
  worldFactionSnapshotSchema
} from './encounter-source.js'
import {
  applyHexBrushStrokeInputSchema,
  createHexMapInputSchema,
  evaluateHexRouteInputSchema,
  editHexLocationInputSchema,
  hexChunkReadResultSchema,
  hexBrushStrokeResultSchema,
  hexLocationPlacementReferenceSchema,
  hexMapCatalogSnapshotSchema,
  hexRouteEvaluationSchema,
  hexTerrainCatalogSchema,
  hexTravelSnapshotSchema,
  hexHistoryStateSchema,
  hexCommandIdInputSchema,
  hexEditorBootstrapSchema,
  hexMapIdInputSchema,
  hexRuntimeOverlayProjectionSchema,
  mutateHexHistoryInputSchema,
  mutateHexTravelInputSchema,
  positionHexPartyInputSchema,
  readHexChunksInputSchema,
  unplaceHexLocationInputSchema,
  setHexTravelMultiplierInputSchema,
  startHexTravelInputSchema,
  updateHexMapInputSchema
} from './hex.js'
import {
  installationSettingsSchema,
  updateInstallationSettingsInputSchema
} from './settings.js'
import { passiveProjectionSchema } from './passive-display.js'
import { coreProcessStatusSchema, rendererIncidentSchema } from './runtime.js'
import { runtimeGpuObservationSchema } from '../qualification/runtime-observation.js'
import {
  referenceCampaignIndexInputSchema,
  referenceDocumentSchema,
  referenceIndexSchema,
  referenceTargetSchema
} from './reference.js'

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
export const coreOperations = {
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
  'settings.read': read('settings:read', none, installationSettingsSchema),
  'settings.update': write(
    'settings:update',
    updateInstallationSettingsInputSchema,
    installationSettingsSchema
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
  'locations.create': write(
    'locations:create',
    createWorldLocationInputSchema,
    createWorldLocationResultSchema
  ),
  'locations.update': write(
    'locations:update',
    updateWorldLocationInputSchema,
    worldLocationSnapshotSchema
  ),
  'locations.updateMapPresentation': write(
    'locations:update-map-presentation',
    updateWorldLocationMapPresentationInputSchema,
    worldLocationMapPresentationSchema
  ),
  'locations.delete': write(
    'locations:delete',
    deleteWorldLocationInputSchema,
    worldLocationSnapshotSchema
  ),
  'locationSymbols.create': write(
    'location-symbols:create',
    createLocationSymbolInputSchema,
    locationSymbolSnapshotSchema
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
  'encounterTables.read': read(
    'encounter-tables:read',
    none,
    encounterTableSnapshotSchema
  ),
  'encounterTables.create': write(
    'encounter-tables:create',
    createEncounterTableInputSchema,
    encounterTableSnapshotSchema
  ),
  'encounterTables.update': write(
    'encounter-tables:update',
    updateEncounterTableInputSchema,
    encounterTableSnapshotSchema
  ),
  'encounterTables.delete': write(
    'encounter-tables:delete',
    deleteEncounterTableInputSchema,
    encounterTableSnapshotSchema
  ),
  'factions.read': read('factions:read', none, worldFactionSnapshotSchema),
  'factions.create': write(
    'factions:create',
    createWorldFactionInputSchema,
    worldFactionSnapshotSchema
  ),
  'factions.update': write(
    'factions:update',
    updateWorldFactionInputSchema,
    worldFactionSnapshotSchema
  ),
  'factions.delete': write(
    'factions:delete',
    deleteWorldFactionInputSchema,
    worldFactionSnapshotSchema
  ),
  'session.read': read('session:read', none, liveSessionSnapshotSchema),
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
    combatRevisionInputSchema,
    combatCommandResultSchema
  ),
  'combat.complete': write(
    'combat:complete',
    combatRevisionInputSchema,
    combatCommandResultSchema
  ),
  'hex.terrainCatalog': read(
    'hex:terrainCatalog',
    none,
    hexTerrainCatalogSchema
  ),
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
  'hex.placeLocation': write(
    'hex:placeLocation',
    editHexLocationInputSchema,
    hexBrushStrokeResultSchema
  ),
  'hex.removeLocation': write(
    'hex:removeLocation',
    unplaceHexLocationInputSchema,
    hexBrushStrokeResultSchema
  ),
  'hexTravel.read': read('hex-travel:read', sceneId, hexTravelSnapshotSchema),
  'hexTravel.evaluate': read(
    'hex-travel:evaluate',
    evaluateHexRouteInputSchema,
    hexRouteEvaluationSchema
  ),
  'hexTravel.position': write(
    'hex-travel:position',
    positionHexPartyInputSchema,
    hexTravelSnapshotSchema
  ),
  'hexTravel.start': write(
    'hex-travel:start',
    startHexTravelInputSchema,
    hexTravelSnapshotSchema
  ),
  'hexTravel.pause': write(
    'hex-travel:pause',
    mutateHexTravelInputSchema,
    hexTravelSnapshotSchema
  ),
  'hexTravel.resume': write(
    'hex-travel:resume',
    mutateHexTravelInputSchema,
    hexTravelSnapshotSchema
  ),
  'hexTravel.abort': write(
    'hex-travel:abort',
    mutateHexTravelInputSchema,
    hexTravelSnapshotSchema
  ),
  'hexTravel.setMultiplier': write(
    'hex-travel:setMultiplier',
    setHexTravelMultiplierInputSchema,
    hexTravelSnapshotSchema
  ),
  'core.shutdown': write(null, none, z.unknown(), [])
} as const

/**
 * Main-owned capabilities use the same contract shape as Core operations.
 * Keeping them here means every renderer invocation has one authoritative
 * channel, input, output, mode, role and deadline definition.
 */
export const mainOperations = {
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

export type CoreOperationKind = keyof typeof coreOperations
export type MainOperationKind = keyof typeof mainOperations
export type CoreOperationInput<K extends CoreOperationKind> = z.output<
  (typeof coreOperations)[K]['input']
>
export type CoreOperationOutput<K extends CoreOperationKind> = z.output<
  (typeof coreOperations)[K]['output']
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
