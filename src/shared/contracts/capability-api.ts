import type { CampaignSnapshot } from './campaign.js'
import type { RuntimeGpuObservation } from '../qualification/runtime-observation.js'
import type { CoreProcessStatus } from './runtime.js'
import type { SessionChangeNotice } from './session-change.js'
import type {
  Creature,
  CreatureCatalogPage,
  CreatureCatalogQuery,
  CreatureFilterOptions
} from './encounter.js'
import type { LiveSessionSnapshot, PartySnapshot } from './live-session.js'
import type { AdventuringDayCalculation, PartyCharacterDraft } from './party.js'
import type { EncounterTuning } from './encounter-tuning.js'
import type {
  EncounterSelectionEvaluation,
  GroupGenerationMode,
  SceneGroupDraftEntry,
  SceneGroupDraftEvaluation,
  SceneGroupDraftGeneration
} from './scene.js'
import type {
  InstallationPreferencesPatch,
  InstallationSettings
} from './settings.js'
import type {
  WorldLocationDraft,
  WorldLocationSnapshot
} from './world-location.js'
import type {
  EncounterTableDraft,
  EncounterTableSnapshot,
  WorldFactionDraft,
  WorldFactionSnapshot
} from './encounter-source.js'
import type {
  AxialCoordinate,
  HexChunkKey,
  HexChunkReadResult,
  HexChunkSnapshot,
  HexMapCatalogSnapshot,
  HexLocationPlacementReference,
  HexMapSummary,
  HexRouteEvaluation,
  HexTerrainCatalog,
  HexTerrainId,
  HexTravelSnapshot
} from './hex.js'

export interface CampaignReadCapability {
  list(): Promise<CampaignSnapshot>
}

export interface CampaignCapability extends CampaignReadCapability {
  create(name: string): Promise<CampaignSnapshot>
  activate(id: string): Promise<CampaignSnapshot>
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
    onCoreStatus(listener: (status: CoreProcessStatus) => void): () => void
  }>
  settings: {
    read(): Promise<InstallationSettings>
    update(
      patch: InstallationPreferencesPatch,
      expectedRevision: number
    ): Promise<InstallationSettings>
  }
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
  locations: {
    read(): Promise<WorldLocationSnapshot>
    create(
      location: WorldLocationDraft,
      expectedRevision: number
    ): Promise<WorldLocationSnapshot>
    update(
      id: string,
      location: WorldLocationDraft,
      expectedRevision: number
    ): Promise<WorldLocationSnapshot>
    delete(id: string, expectedRevision: number): Promise<WorldLocationSnapshot>
  }
  encounterTables: {
    read(): Promise<EncounterTableSnapshot>
    create(
      table: EncounterTableDraft,
      expectedRevision: number
    ): Promise<EncounterTableSnapshot>
    update(
      id: string,
      table: EncounterTableDraft,
      expectedRevision: number
    ): Promise<EncounterTableSnapshot>
    delete(
      id: string,
      expectedRevision: number
    ): Promise<EncounterTableSnapshot>
  }
  factions: {
    read(): Promise<WorldFactionSnapshot>
    create(
      faction: WorldFactionDraft,
      expectedRevision: number
    ): Promise<WorldFactionSnapshot>
    update(
      id: string,
      faction: WorldFactionDraft,
      expectedRevision: number
    ): Promise<WorldFactionSnapshot>
    delete(id: string, expectedRevision: number): Promise<WorldFactionSnapshot>
  }
  hex: {
    terrainCatalog(): Promise<HexTerrainCatalog>
    catalog(): Promise<HexMapCatalogSnapshot>
    locateLocation(locationId: string): Promise<HexLocationPlacementReference>
    readChunks(
      mapId: string,
      keys: readonly HexChunkKey[]
    ): Promise<HexChunkReadResult>
    create(
      displayName: string,
      expectedCatalogRevision: number
    ): Promise<HexMapSummary>
    updateMetadata(
      mapId: string,
      displayName: string,
      expectedMetadataRevision: number
    ): Promise<HexMapSummary>
    paint(
      mapId: string,
      coordinate: AxialCoordinate,
      terrainId: HexTerrainId,
      expectedChunkRevision: number
    ): Promise<HexChunkSnapshot>
    placeLocation(
      mapId: string,
      locationId: string,
      coordinate: AxialCoordinate,
      expectedContentRevision: number
    ): Promise<HexChunkReadResult>
    removeLocation(
      mapId: string,
      locationId: string,
      expectedContentRevision: number
    ): Promise<HexChunkReadResult>
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
      entries: readonly { creatureId: string; quantity: number }[],
      expectedRevision: number
    ): Promise<LiveSessionSnapshot>
    deleteGroup(
      sceneId: string,
      groupId: string,
      expectedRevision: number
    ): Promise<LiveSessionSnapshot>
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
    ): Promise<LiveSessionSnapshot>
    rollInitiative(expectedRevision: number): Promise<LiveSessionSnapshot>
    confirmInitiative(
      values: readonly { id: string; initiative: number }[],
      expectedRevision: number
    ): Promise<LiveSessionSnapshot>
    advanceTurn(expectedRevision: number): Promise<LiveSessionSnapshot>
    adjustInitiative(
      id: string,
      initiative: number,
      expectedRevision: number
    ): Promise<LiveSessionSnapshot>
    changeHp(
      cardId: string,
      amount: number,
      healing: boolean,
      expectedRevision: number
    ): Promise<LiveSessionSnapshot>
    end(expectedRevision: number): Promise<LiveSessionSnapshot>
    updateResolution(
      selectedEnemyIds: readonly string[],
      thresholdFraction: number,
      xpFraction: number,
      expectedRevision: number
    ): Promise<LiveSessionSnapshot>
    awardXp(expectedRevision: number): Promise<LiveSessionSnapshot>
    complete(expectedRevision: number): Promise<LiveSessionSnapshot>
  }
}
