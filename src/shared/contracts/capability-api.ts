import type { CampaignSnapshot } from './campaign.js'
import type { RuntimeGpuObservation } from '../qualification/runtime-observation.js'
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
import type { SessionLayoutPreference } from './session-layout.js'
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
  }>
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
  session: {
    read(): Promise<LiveSessionSnapshot>
    readLayout(): Promise<SessionLayoutPreference>
    saveLayout(
      preference: SessionLayoutPreference
    ): Promise<SessionLayoutPreference>
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
