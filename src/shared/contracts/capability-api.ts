import type { CampaignSnapshot } from './campaign.js'
import type { RuntimeGpuObservation } from '../qualification/runtime-observation.js'
import type { CoreProcessStatus, RendererIncident } from './runtime.js'
import type { SessionChangeNotice } from './session-change.js'
import type {
  Creature,
  CreatureCatalogPage,
  CreatureCatalogQuery,
  CreatureFilterOptions
} from './encounter.js'
import type {
  CombatCommandResult,
  CombatCondition,
  LiveSessionSnapshot,
  PartySnapshot,
  SceneGroupCommandResult
} from './live-session.js'
import type { AdventuringDayCalculation, PartyCharacterDraft } from './party.js'
import type { EncounterTuning } from './encounter-tuning.js'
import type {
  GeneratorConfig,
  GeneratorPresetSnapshot
} from './generator-presets.js'
import type {
  EncounterSelectionEvaluation,
  GroupGenerationMode,
  SceneGroupDraftEntry,
  SceneGroupDraftEvaluation,
  SceneGroupDraftGeneration,
  SceneGroupDisposition
} from './scene.js'
import type {
  InstallationPreferencesPatch,
  InstallationSettings
} from './settings.js'
import type {
  WorldLocationChangeNotice,
  WorldLocationDeleteReceipt,
  WorldLocationMapPresentation,
  WorldLocationMapPresentationPatch,
  SaveWorldLocationInput,
  WorldLocationPlacementCommand,
  WorldLocationPlacementCommitResult,
  WorldLocationSaveReceipt,
  WorldLocationSnapshot
} from './world-location.js'
import type {
  LocationSymbolDraft,
  LocationSymbolChangeNotice,
  LocationSymbolDeleteImpact,
  LocationSymbolDeleteResult,
  LocationSymbolPage,
  LocationSymbol,
  LocationSymbolMutationReceipt,
  ImportLocationSymbolResult,
  LocationSymbolSnapshot,
  SvgSymbolFileResult
} from './location-symbol.js'
import type {
  BiomeCatalogMutationResult,
  BiomeChangeNotice,
  BiomeDefinition,
  BiomeDeleteImpact,
  BiomeDraft,
  BiomeId,
  BiomePage,
  PaintableBiomeId
} from './biome.js'
import type {
  EncounterTableChangeNotice,
  EncounterTableCommandReceipt,
  EncounterTableDraft,
  EncounterTableDeleteReceipt,
  EncounterTableMutationReceipt,
  EncounterTableScope,
  EncounterTableSnapshot,
  WorldFactionDraft,
  WorldFactionCommandReceipt,
  WorldFactionDeleteReceipt,
  WorldFactionMutationReceipt,
  WorldFactionSnapshot
} from './encounter-source.js'
import type {
  AxialCoordinate,
  ApplyHexBrushStrokeInput,
  HexBrushStrokeResult,
  HexChunkKey,
  HexChunkReadResult,
  HexMapCatalogSnapshot,
  HexLocationPlacementReference,
  HexHistoryState,
  HexChangeNotice,
  HexEditorBootstrap,
  HexRuntimeOverlayProjection,
  HexRouteEvaluation,
  ReplaceMapBiomePlaceholderInput,
  ReplaceMapBiomePlaceholderResult,
  HexBiomeCatalog,
  HexTravelSnapshot
} from './hex.js'
import type {
  ReferenceDocument,
  ReferenceIndex,
  ReferenceIndexChangeNotice,
  ReferenceTarget
} from './reference.js'
import type {
  SessionGenerationEncounterInput,
  SessionGenerationEncounterResult
} from './session-generation.js'

export interface CampaignReadCapability {
  list(): Promise<CampaignSnapshot>
}

export interface CampaignCapability extends CampaignReadCapability {
  create(name: string): Promise<CampaignSnapshot>
  activate(id: string): Promise<CampaignSnapshot>
  rename(id: string, name: string): Promise<CampaignSnapshot>
  trash(id: string): Promise<CampaignSnapshot>
  restore(id: string): Promise<CampaignSnapshot>
  deleteForever(id: string, confirmationName: string): Promise<CampaignSnapshot>
}

export interface GeneratorPresetCapability {
  read(): Promise<GeneratorPresetSnapshot>
  create(
    name: string,
    config: GeneratorConfig,
    expectedRevision: number
  ): Promise<GeneratorPresetSnapshot>
  update(
    id: string,
    name: string,
    config: GeneratorConfig,
    expectedRevision: number
  ): Promise<GeneratorPresetSnapshot>
  delete(id: string, expectedRevision: number): Promise<GeneratorPresetSnapshot>
  assign(
    campaignId: string,
    presetId: string | null,
    expectedRevision: number
  ): Promise<GeneratorPresetSnapshot>
}

export interface SaltMarcherApi {
  campaigns: CampaignReadCapability | CampaignCapability
  runtime: Readonly<{
    readOnly: boolean
    e2e: boolean
    processMemoryBytes(): Promise<number>
    gpuObservation(): Promise<RuntimeGpuObservation>
    coreStatus(): Promise<CoreProcessStatus>
    retryCore(): Promise<CoreProcessStatus>
    reportRendererIncident(incident: RendererIncident): Promise<void>
    reloadRenderer(): Promise<void>
    pickLocationSymbolFile(): Promise<SvgSymbolFileResult>
    onCoreStatus(listener: (status: CoreProcessStatus) => void): () => void
  }>
  settings: {
    read(): Promise<InstallationSettings>
    update(
      patch: InstallationPreferencesPatch,
      expectedRevision: number
    ): Promise<InstallationSettings>
  }
  generatorPresets: GeneratorPresetCapability
  party: {
    read(): Promise<PartySnapshot>
    create(
      character: PartyCharacterDraft,
      expectedRevision: number
    ): Promise<PartySnapshot>
    update(
      id: string,
      character: PartyCharacterDraft,
      expectedRevision: number
    ): Promise<PartySnapshot>
    delete(id: string, expectedRevision: number): Promise<PartySnapshot>
    setMembership(
      id: string,
      active: boolean,
      expectedRevision: number
    ): Promise<PartySnapshot>
    adjustXp(
      id: string,
      delta: number,
      expectedRevision: number
    ): Promise<PartySnapshot>
    rest(
      type: 'short' | 'long',
      expectedRevision: number
    ): Promise<PartySnapshot>
    calculateAdventuringDay(
      rows: readonly { level: number; count: number }[],
      totalXp?: number
    ): Promise<AdventuringDayCalculation>
  }
  creatures: {
    search(query: CreatureCatalogQuery): Promise<CreatureCatalogPage>
    filterOptions(): Promise<CreatureFilterOptions>
    detail(id: string): Promise<Creature>
  }
  references: {
    staticIndex(): Promise<ReferenceIndex>
    campaignIndex(campaignId: string): Promise<ReferenceIndex>
    detail(target: ReferenceTarget): Promise<ReferenceDocument>
    onCampaignIndexChanged(
      listener: (notice: ReferenceIndexChangeNotice) => void
    ): () => void
  }
  locations: {
    read(): Promise<WorldLocationSnapshot>
    suggestTags(query: string, limit?: number): Promise<readonly string[]>
    save(input: SaveWorldLocationInput): Promise<WorldLocationSaveReceipt>
    saveReceipt(commandId: string): Promise<WorldLocationSaveReceipt | null>
    commitPlacement(
      input: WorldLocationPlacementCommand
    ): Promise<WorldLocationPlacementCommitResult>
    updateMapPresentation(
      id: string,
      patch: WorldLocationMapPresentationPatch,
      expectedRevision: number
    ): Promise<WorldLocationMapPresentation>
    delete(
      id: string,
      expectedRevision: number
    ): Promise<WorldLocationDeleteReceipt>
    onChanged(listener: (notice: WorldLocationChangeNotice) => void): () => void
  }
  locationSymbols: {
    create(
      symbol: LocationSymbolDraft,
      expectedRevision: number
    ): Promise<LocationSymbolMutationReceipt>
    search(
      query?: string,
      offset?: number,
      limit?: number
    ): Promise<LocationSymbolPage>
    detail(id: string): Promise<LocationSymbol>
    update(
      id: string,
      displayName: string,
      expectedRevision: number
    ): Promise<LocationSymbolSnapshot>
    deleteImpact(id: string): Promise<LocationSymbolDeleteImpact>
    delete(
      commandId: string,
      id: string,
      expectedRevision: number
    ): Promise<LocationSymbolDeleteResult>
    importAndAssign(input: {
      commandId: string
      displayName: string
      source: string
      locationId: string
      expectedSymbolRevision: number
      expectedPresentationRevision: number
    }): Promise<ImportLocationSymbolResult>
    onChanged(
      listener: (notice: LocationSymbolChangeNotice) => void
    ): () => void
  }
  biomes: {
    search(query?: string, offset?: number, limit?: number): Promise<BiomePage>
    detail(id: BiomeId): Promise<BiomeDefinition>
    create(
      commandId: string,
      biome: BiomeDraft,
      expectedRevision: number
    ): Promise<BiomeCatalogMutationResult>
    update(
      commandId: string,
      id: PaintableBiomeId,
      biome: BiomeDraft,
      expectedRevision: number
    ): Promise<BiomeCatalogMutationResult>
    deleteImpact(id: BiomeId): Promise<BiomeDeleteImpact>
    delete(
      commandId: string,
      id: string,
      expectedRevision: number
    ): Promise<BiomeCatalogMutationResult>
    onChanged(listener: (notice: BiomeChangeNotice) => void): () => void
  }
  encounterTables: {
    read(): Promise<EncounterTableSnapshot>
    commandReceipt(
      commandId: string
    ): Promise<EncounterTableCommandReceipt | null>
    create(
      commandId: string,
      table: EncounterTableDraft,
      expectedRevision: number,
      scope?: EncounterTableScope
    ): Promise<EncounterTableMutationReceipt>
    update(
      commandId: string,
      id: string,
      table: EncounterTableDraft,
      expectedRevision: number,
      scope?: EncounterTableScope
    ): Promise<EncounterTableMutationReceipt>
    delete(
      commandId: string,
      id: string,
      expectedRevision: number,
      scope?: EncounterTableScope
    ): Promise<EncounterTableDeleteReceipt>
    onChanged(
      listener: (notice: EncounterTableChangeNotice) => void
    ): () => void
  }
  factions: {
    read(): Promise<WorldFactionSnapshot>
    commandReceipt(
      commandId: string
    ): Promise<WorldFactionCommandReceipt | null>
    create(
      commandId: string,
      faction: WorldFactionDraft,
      expectedRevision: number
    ): Promise<WorldFactionMutationReceipt>
    update(
      commandId: string,
      id: string,
      faction: WorldFactionDraft,
      expectedRevision: number
    ): Promise<WorldFactionMutationReceipt>
    delete(
      commandId: string,
      id: string,
      expectedRevision: number
    ): Promise<WorldFactionDeleteReceipt>
  }
  hex: {
    editorBootstrap(): Promise<HexEditorBootstrap>
    biomeCatalog(): Promise<HexBiomeCatalog>
    catalog(): Promise<HexMapCatalogSnapshot>
    locateLocation(locationId: string): Promise<HexLocationPlacementReference>
    readChunks(
      mapId: string,
      keys: readonly HexChunkKey[]
    ): Promise<HexChunkReadResult>
    replaceBiomePlaceholder(
      input: ReplaceMapBiomePlaceholderInput
    ): Promise<ReplaceMapBiomePlaceholderResult>
    create(input: {
      commandId: string
      displayName: string
      expectedCatalogRevision: number
    }): Promise<HexBrushStrokeResult>
    updateMetadata(input: {
      commandId: string
      mapId: string
      displayName: string
      expectedMetadataRevision: number
    }): Promise<HexBrushStrokeResult>
    applyBrushStroke(
      input: ApplyHexBrushStrokeInput
    ): Promise<HexBrushStrokeResult>
    history(mapId: string): Promise<HexHistoryState>
    undo(input: {
      commandId: string
      mapId: string
      expectedContentRevision: number
      confirmationToken: string | null
    }): Promise<HexBrushStrokeResult>
    redo(input: {
      commandId: string
      mapId: string
      expectedContentRevision: number
      confirmationToken: string | null
    }): Promise<HexBrushStrokeResult>
    commandReceipt(commandId: string): Promise<HexBrushStrokeResult | null>
    runtimeOverlays(mapId: string): Promise<HexRuntimeOverlayProjection>
    onChanged(listener: (notice: HexChangeNotice) => void): () => void
  }
  hexTravel: {
    read(sceneId: string): Promise<HexTravelSnapshot>
    evaluate(
      sceneId: string,
      mapId: string,
      waypoints: readonly AxialCoordinate[]
    ): Promise<HexRouteEvaluation>
    position(
      sceneId: string,
      mapId: string,
      coordinate: AxialCoordinate,
      expectedSceneRevision: number
    ): Promise<HexTravelSnapshot>
    start(
      sceneId: string,
      mapId: string,
      waypoints: readonly AxialCoordinate[],
      multiplier: 1 | 2 | 5 | 10,
      expectedRevision: number
    ): Promise<HexTravelSnapshot>
    pause(sceneId: string, expectedRevision: number): Promise<HexTravelSnapshot>
    resume(
      sceneId: string,
      expectedRevision: number
    ): Promise<HexTravelSnapshot>
    abort(sceneId: string, expectedRevision: number): Promise<HexTravelSnapshot>
    setMultiplier(
      sceneId: string,
      multiplier: 1 | 2 | 5 | 10,
      expectedRevision: number
    ): Promise<HexTravelSnapshot>
  }
  session: {
    read(): Promise<LiveSessionSnapshot>
    onChanged(listener: (notice: SessionChangeNotice) => void): () => void
  }
  sessionGeneration: {
    generateEncounterIntents(
      input: SessionGenerationEncounterInput
    ): Promise<SessionGenerationEncounterResult>
  }
  scene: {
    focus(
      sceneId: string,
      expectedRevision: number
    ): Promise<LiveSessionSnapshot>
    setLocation(
      sceneId: string,
      locationId: string | null,
      expectedRevision: number
    ): Promise<LiveSessionSnapshot>
    saveGroup(
      sceneId: string,
      groupId: string | null,
      name: string,
      note: string,
      disposition: SceneGroupDisposition,
      entries: readonly SceneGroupDraftEntry[],
      expectedRevision: number,
      expectedGroupRevision: number | null
    ): Promise<SceneGroupCommandResult>
    deleteGroup(
      sceneId: string,
      groupId: string,
      expectedGroupRevision: number
    ): Promise<SceneGroupCommandResult>
    setGroupArchived(
      sceneId: string,
      groupId: string,
      archived: boolean,
      expectedGroupRevision: number
    ): Promise<SceneGroupCommandResult>
    assignPartyMember(
      sceneId: string,
      partyMemberId: string,
      assigned: boolean,
      expectedRevision: number
    ): Promise<LiveSessionSnapshot>
    evaluateGroupDraft(
      sceneId: string,
      entries: readonly SceneGroupDraftEntry[],
      expectedRevision: number
    ): Promise<SceneGroupDraftEvaluation>
    generateGroupDraft(
      sceneId: string,
      entries: readonly SceneGroupDraftEntry[],
      mode: GroupGenerationMode,
      filters: CreatureCatalogQuery,
      tuning: EncounterTuning,
      seed: number,
      expectedRevision: number
    ): Promise<SceneGroupDraftGeneration>
  }
  encounter: {
    evaluate(
      sceneId: string,
      groupIds: readonly string[],
      expectedRevision: number
    ): Promise<EncounterSelectionEvaluation>
  }
  combat: {
    prepare(
      sceneId: string,
      groupIds: readonly string[],
      expectedSceneRevision: number
    ): Promise<CombatCommandResult>
    joinGroup(
      sceneId: string,
      groupId: string,
      expectedGroupRevision: number,
      expectedCombatRevision: number
    ): Promise<CombatCommandResult>
    rollInitiative(expectedRevision: number): Promise<CombatCommandResult>
    confirmInitiative(
      values: readonly { id: string; initiative: number }[],
      expectedRevision: number
    ): Promise<CombatCommandResult>
    advanceTurn(expectedRevision: number): Promise<CombatCommandResult>
    retreatTurn(expectedRevision: number): Promise<CombatCommandResult>
    adjustInitiative(
      id: string,
      initiative: number,
      expectedRevision: number
    ): Promise<CombatCommandResult>
    changeHp(
      cardId: string,
      amount: number,
      healing: boolean,
      expectedRevision: number
    ): Promise<CombatCommandResult>
    toggleCondition(
      cardId: string,
      condition: CombatCondition,
      active: boolean,
      expectedRevision: number
    ): Promise<CombatCommandResult>
    setConcentration(
      cardId: string,
      concentrating: boolean,
      expectedRevision: number
    ): Promise<CombatCommandResult>
    setExhaustion(
      cardId: string,
      exhaustionLevel: number,
      expectedRevision: number
    ): Promise<CombatCommandResult>
    undo(expectedRevision: number): Promise<CombatCommandResult>
    end(expectedRevision: number): Promise<CombatCommandResult>
    moveToPhase(
      target: 'selection' | 'initiative' | 'combat',
      expectedRevision: number
    ): Promise<CombatCommandResult>
    updateResolution(
      selectedEnemyIds: readonly string[],
      mode: 'defeated' | 'manual',
      xpFraction: number,
      expectedRevision: number
    ): Promise<CombatCommandResult>
    awardXp(expectedRevision: number): Promise<CombatCommandResult>
    complete(expectedRevision: number): Promise<CombatCommandResult>
  }
}
