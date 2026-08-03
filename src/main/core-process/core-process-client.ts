import { randomUUID } from 'node:crypto'
import { utilityProcess, type UtilityProcess } from 'electron'
import { z } from 'zod'
import {
  coreReadySchema,
  type CampaignSnapshot
} from '../../shared/contracts/campaign.js'
import {
  coreRequestSchema,
  coreResultSchema
} from '../../shared/contracts/core-protocol.js'
import {
  creatureCatalogPageSchema,
  creatureCatalogQuerySchema,
  creatureFilterOptionsSchema,
  creatureSchema,
  type CreatureCatalogPage,
  type CreatureCatalogQuery,
  type CreatureFilterOptions
} from '../../shared/contracts/encounter.js'
import {
  liveSessionSnapshotSchema,
  partySnapshotSchema,
  type LiveSessionSnapshot,
  type PartySnapshot
} from '../../shared/contracts/live-session.js'
import {
  adventuringDayCalculationSchema,
  type AdventuringDayCalculation,
  type PartyCharacterDraft
} from '../../shared/contracts/party.js'
import type { EncounterTuning } from '../../shared/contracts/encounter-tuning.js'
import {
  encounterSelectionEvaluationSchema,
  sceneGroupDraftEvaluationSchema,
  sceneGroupDraftGenerationSchema,
  type EncounterSelectionEvaluation,
  type GroupGenerationMode,
  type SceneGroupDraftEntry,
  type SceneGroupDraftEvaluation,
  type SceneGroupDraftGeneration
} from '../../shared/contracts/scene.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import {
  worldLocationSnapshotSchema,
  type WorldLocationDraft,
  type WorldLocationSnapshot
} from '../../shared/contracts/world-location.js'
import {
  encounterTableSnapshotSchema,
  worldFactionSnapshotSchema,
  type EncounterTableDraft,
  type EncounterTableSnapshot,
  type WorldFactionDraft,
  type WorldFactionSnapshot
} from '../../shared/contracts/encounter-source.js'
import {
  hexMapCatalogSnapshotSchema,
  hexMapSnapshotSchema,
  hexRouteEvaluationSchema,
  hexTerrainCatalogSchema,
  hexTravelSnapshotSchema,
  type AxialCoordinate,
  type HexTerrainId
} from '../../shared/contracts/hex.js'

export class CoreProcessClient {
  readonly #process: UtilityProcess
  readonly #ready: Promise<void>
  #resolve?: () => void
  #reject?: (error: Error) => void
  #closed = false
  readonly #pending = new Map<
    string,
    {
      resolve: (value: unknown) => void
      reject: (error: Error) => void
      schema: z.ZodType<unknown>
    }
  >()

  constructor(dataRoot: string, path: string) {
    this.#process = utilityProcess.fork(path, [dataRoot], { stdio: 'ignore' })
    this.#ready = new Promise((resolve, reject) => {
      this.#resolve = resolve
      this.#reject = reject
    })
    this.#process.on('message', (value) => this.handle(value))
    this.#process.on('exit', () =>
      this.fail(new CapabilityError('core_unavailable', false))
    )
  }

  waitUntilReady() {
    return this.#ready
  }
  list() {
    return this.request({ kind: 'campaign.list' }, campaignSchema)
  }
  create(name: string) {
    return this.request(
      { kind: 'campaign.create', input: { name } },
      campaignSchema
    )
  }
  activate(id: string) {
    return this.request(
      { kind: 'campaign.activate', input: { id } },
      campaignSchema
    )
  }
  partyRead(): Promise<PartySnapshot> {
    return this.request({ kind: 'party.read' }, partySnapshotSchema)
  }
  partySetMembership(id: string, active: boolean, expectedRevision: number) {
    return this.request(
      { kind: 'party.setMembership', input: { id, active, expectedRevision } },
      partySnapshotSchema
    )
  }
  partyCreate(character: PartyCharacterDraft, expectedRevision: number) {
    return this.request(
      { kind: 'party.create', input: { character, expectedRevision } },
      partySnapshotSchema
    )
  }
  partyUpdate(
    id: string,
    character: PartyCharacterDraft,
    expectedRevision: number
  ) {
    return this.request(
      { kind: 'party.update', input: { id, character, expectedRevision } },
      partySnapshotSchema
    )
  }
  partyDelete(id: string, expectedRevision: number) {
    return this.request(
      { kind: 'party.delete', input: { id, expectedRevision } },
      partySnapshotSchema
    )
  }
  partyAdjustXp(id: string, delta: number, expectedRevision: number) {
    return this.request(
      { kind: 'party.adjustXp', input: { id, delta, expectedRevision } },
      partySnapshotSchema
    )
  }
  partyRest(type: 'short' | 'long', expectedRevision: number) {
    return this.request(
      { kind: 'party.rest', input: { type, expectedRevision } },
      partySnapshotSchema
    )
  }
  partyCalculateAdventuringDay(
    rows: readonly { level: number; count: number }[],
    totalXp?: number
  ): Promise<AdventuringDayCalculation> {
    return this.request(
      {
        kind: 'party.calculateAdventuringDay',
        input: { rows, ...(totalXp === undefined ? {} : { totalXp }) }
      },
      adventuringDayCalculationSchema
    )
  }
  creaturesSearch(query: CreatureCatalogQuery): Promise<CreatureCatalogPage> {
    return this.request(
      {
        kind: 'creatures.search',
        input: creatureCatalogQuerySchema.parse(query)
      },
      creatureCatalogPageSchema
    )
  }
  creaturesFilterOptions(): Promise<CreatureFilterOptions> {
    return this.request(
      { kind: 'creatures.filterOptions' },
      creatureFilterOptionsSchema
    )
  }
  creaturesDetail(id: string) {
    return this.request(
      { kind: 'creatures.detail', input: { id } },
      creatureSchema
    )
  }
  locationsRead(): Promise<WorldLocationSnapshot> {
    return this.request({ kind: 'locations.read' }, worldLocationSnapshotSchema)
  }
  locationsCreate(
    location: WorldLocationDraft,
    expectedRevision: number
  ): Promise<WorldLocationSnapshot> {
    return this.request(
      { kind: 'locations.create', input: { location, expectedRevision } },
      worldLocationSnapshotSchema
    )
  }
  locationsUpdate(
    id: string,
    location: WorldLocationDraft,
    expectedRevision: number
  ): Promise<WorldLocationSnapshot> {
    return this.request(
      { kind: 'locations.update', input: { id, location, expectedRevision } },
      worldLocationSnapshotSchema
    )
  }
  locationsDelete(
    id: string,
    expectedRevision: number
  ): Promise<WorldLocationSnapshot> {
    return this.request(
      { kind: 'locations.delete', input: { id, expectedRevision } },
      worldLocationSnapshotSchema
    )
  }
  hexTerrainCatalog() {
    return this.request({ kind: 'hex.terrainCatalog' }, hexTerrainCatalogSchema)
  }
  hexCatalog() {
    return this.request({ kind: 'hex.catalog' }, hexMapCatalogSnapshotSchema)
  }
  hexRead(mapId: string) {
    return this.request(
      { kind: 'hex.read', input: { mapId } },
      hexMapSnapshotSchema
    )
  }
  hexCreate(displayName: string, expectedCatalogRevision: number) {
    return this.request(
      { kind: 'hex.create', input: { displayName, expectedCatalogRevision } },
      hexMapSnapshotSchema
    )
  }
  hexUpdate(input: {
    mapId: string
    displayName: string
    radius: number
    confirmDataLoss: boolean
    expectedRevision: number
  }) {
    return this.request({ kind: 'hex.update', input }, hexMapSnapshotSchema)
  }
  hexPaint(input: {
    mapId: string
    coordinate: AxialCoordinate
    terrainId: HexTerrainId
    expectedRevision: number
  }) {
    return this.request({ kind: 'hex.paint', input }, hexMapSnapshotSchema)
  }
  hexPlaceLocation(input: {
    mapId: string
    locationId: string
    coordinate: AxialCoordinate
    expectedRevision: number
  }) {
    return this.request(
      { kind: 'hex.placeLocation', input },
      hexMapSnapshotSchema
    )
  }
  hexRemoveLocation(locationId: string, expectedMapRevision: number) {
    return this.request(
      {
        kind: 'hex.removeLocation',
        input: { locationId, expectedMapRevision }
      },
      hexMapSnapshotSchema
    )
  }
  hexTravelRead(sceneId: string) {
    return this.request(
      { kind: 'hexTravel.read', input: { sceneId } },
      hexTravelSnapshotSchema
    )
  }
  hexTravelEvaluate(
    sceneId: string,
    mapId: string,
    waypoints: readonly AxialCoordinate[]
  ) {
    return this.request(
      {
        kind: 'hexTravel.evaluate',
        input: { sceneId, mapId, waypoints: [...waypoints] }
      },
      hexRouteEvaluationSchema
    )
  }
  hexTravelPosition(input: {
    sceneId: string
    mapId: string
    coordinate: AxialCoordinate
    expectedSceneRevision: number
  }) {
    return this.request(
      { kind: 'hexTravel.position', input },
      hexTravelSnapshotSchema
    )
  }
  hexTravelStart(input: {
    sceneId: string
    mapId: string
    waypoints: readonly AxialCoordinate[]
    multiplier: 1 | 2 | 5 | 10
    expectedRevision: number
  }) {
    return this.request(
      {
        kind: 'hexTravel.start',
        input: { ...input, waypoints: [...input.waypoints] }
      },
      hexTravelSnapshotSchema
    )
  }
  hexTravelMutate(
    kind: 'pause' | 'resume' | 'abort',
    sceneId: string,
    expectedRevision: number
  ) {
    return this.request(
      {
        kind: `hexTravel.${kind}` as const,
        input: { sceneId, expectedRevision }
      },
      hexTravelSnapshotSchema
    )
  }
  hexTravelSetMultiplier(
    sceneId: string,
    multiplier: 1 | 2 | 5 | 10,
    expectedRevision: number
  ) {
    return this.request(
      {
        kind: 'hexTravel.setMultiplier',
        input: { sceneId, multiplier, expectedRevision }
      },
      hexTravelSnapshotSchema
    )
  }
  encounterTablesRead(): Promise<EncounterTableSnapshot> {
    return this.request(
      { kind: 'encounterTables.read' },
      encounterTableSnapshotSchema
    )
  }
  encounterTablesCreate(
    table: EncounterTableDraft,
    expectedRevision: number
  ): Promise<EncounterTableSnapshot> {
    return this.request(
      { kind: 'encounterTables.create', input: { table, expectedRevision } },
      encounterTableSnapshotSchema
    )
  }
  encounterTablesUpdate(
    id: string,
    table: EncounterTableDraft,
    expectedRevision: number
  ): Promise<EncounterTableSnapshot> {
    return this.request(
      {
        kind: 'encounterTables.update',
        input: { id, table, expectedRevision }
      },
      encounterTableSnapshotSchema
    )
  }
  encounterTablesDelete(
    id: string,
    expectedRevision: number
  ): Promise<EncounterTableSnapshot> {
    return this.request(
      { kind: 'encounterTables.delete', input: { id, expectedRevision } },
      encounterTableSnapshotSchema
    )
  }
  factionsRead(): Promise<WorldFactionSnapshot> {
    return this.request({ kind: 'factions.read' }, worldFactionSnapshotSchema)
  }
  factionsCreate(
    faction: WorldFactionDraft,
    expectedRevision: number
  ): Promise<WorldFactionSnapshot> {
    return this.request(
      { kind: 'factions.create', input: { faction, expectedRevision } },
      worldFactionSnapshotSchema
    )
  }
  factionsUpdate(
    id: string,
    faction: WorldFactionDraft,
    expectedRevision: number
  ): Promise<WorldFactionSnapshot> {
    return this.request(
      { kind: 'factions.update', input: { id, faction, expectedRevision } },
      worldFactionSnapshotSchema
    )
  }
  factionsDelete(
    id: string,
    expectedRevision: number
  ): Promise<WorldFactionSnapshot> {
    return this.request(
      { kind: 'factions.delete', input: { id, expectedRevision } },
      worldFactionSnapshotSchema
    )
  }
  sessionRead(): Promise<LiveSessionSnapshot> {
    return this.request({ kind: 'session.read' }, liveSessionSnapshotSchema)
  }
  sceneFocus(sceneId: string, expectedRevision: number) {
    return this.request(
      { kind: 'scene.focus', input: { sceneId, expectedRevision } },
      liveSessionSnapshotSchema
    )
  }
  sceneSetLocation(
    sceneId: string,
    locationId: string | null,
    expectedRevision: number
  ) {
    return this.request(
      {
        kind: 'scene.setLocation',
        input: { sceneId, locationId, expectedRevision }
      },
      liveSessionSnapshotSchema
    )
  }
  sceneSaveGroup(input: {
    sceneId: string
    groupId: string | null
    name: string
    entries: readonly { creatureId: string; quantity: number }[]
    expectedRevision: number
  }) {
    return this.request(
      { kind: 'scene.saveGroup', input },
      liveSessionSnapshotSchema
    )
  }
  sceneDeleteGroup(input: {
    sceneId: string
    groupId: string
    expectedRevision: number
  }) {
    return this.request(
      { kind: 'scene.deleteGroup', input },
      liveSessionSnapshotSchema
    )
  }
  sceneAssignPartyMember(input: {
    sceneId: string
    partyMemberId: string
    assigned: boolean
    expectedRevision: number
  }) {
    return this.request(
      { kind: 'scene.assignPartyMember', input },
      liveSessionSnapshotSchema
    )
  }
  sceneEvaluateGroupDraft(
    sceneId: string,
    entries: readonly SceneGroupDraftEntry[],
    expectedRevision: number
  ): Promise<SceneGroupDraftEvaluation> {
    return this.request(
      {
        kind: 'scene.evaluateGroupDraft',
        input: { sceneId, entries, expectedRevision }
      },
      sceneGroupDraftEvaluationSchema
    )
  }
  sceneGenerateGroupDraft(
    sceneId: string,
    entries: readonly SceneGroupDraftEntry[],
    mode: GroupGenerationMode,
    filters: CreatureCatalogQuery,
    tuning: EncounterTuning,
    seed: number,
    expectedRevision: number
  ): Promise<SceneGroupDraftGeneration> {
    return this.request(
      {
        kind: 'scene.generateGroupDraft',
        input: {
          sceneId,
          entries,
          mode,
          filters,
          tuning,
          seed,
          expectedRevision
        }
      },
      sceneGroupDraftGenerationSchema
    )
  }
  encounterEvaluate(
    sceneId: string,
    groupIds: readonly string[],
    expectedRevision: number
  ): Promise<EncounterSelectionEvaluation> {
    return this.request(
      {
        kind: 'encounter.evaluate',
        input: { sceneId, groupIds, expectedRevision }
      },
      encounterSelectionEvaluationSchema
    )
  }
  combatPrepare(
    sceneId: string,
    groupIds: readonly string[],
    expectedSceneRevision: number
  ) {
    return this.live('combat.prepare', {
      sceneId,
      groupIds,
      expectedSceneRevision
    })
  }
  combatRollInitiative(expectedRevision: number) {
    return this.live('combat.rollInitiative', { expectedRevision })
  }
  combatConfirmInitiative(
    values: readonly { id: string; initiative: number }[],
    expectedRevision: number
  ) {
    return this.live('combat.confirmInitiative', { values, expectedRevision })
  }
  combatAdvanceTurn(expectedRevision: number) {
    return this.live('combat.advanceTurn', { expectedRevision })
  }
  combatAdjustInitiative(
    id: string,
    initiative: number,
    expectedRevision: number
  ) {
    return this.live('combat.adjustInitiative', {
      id,
      initiative,
      expectedRevision
    })
  }
  combatChangeHp(
    cardId: string,
    amount: number,
    healing: boolean,
    expectedRevision: number
  ) {
    return this.live('combat.changeHp', {
      cardId,
      amount,
      healing,
      expectedRevision
    })
  }
  combatEnd(expectedRevision: number) {
    return this.live('combat.end', { expectedRevision })
  }
  combatUpdateResolution(
    selectedEnemyIds: readonly string[],
    thresholdFraction: number,
    xpFraction: number,
    expectedRevision: number
  ) {
    return this.live('combat.updateResolution', {
      selectedEnemyIds,
      thresholdFraction,
      xpFraction,
      expectedRevision
    })
  }
  combatAwardXp(expectedRevision: number) {
    return this.live('combat.awardXp', { expectedRevision })
  }
  combatComplete(expectedRevision: number) {
    return this.live('combat.complete', { expectedRevision })
  }
  close() {
    this.#closed = true
    this.#process.kill()
  }

  private live(kind: string, input: Record<string, unknown>) {
    return this.request({ kind, input }, liveSessionSnapshotSchema)
  }

  private request<T>(raw: unknown, schema: z.ZodType<T>): Promise<T> {
    const request = coreRequestSchema.parse({
      ...(raw as object),
      requestId: randomUUID()
    })
    return new Promise((resolve, reject) => {
      if (this.#closed) {
        reject(new CapabilityError('core_unavailable', false))
        return
      }
      this.#pending.set(request.requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        schema
      })
      this.#process.postMessage(request)
    })
  }

  private handle(raw: unknown) {
    if (coreReadySchema.safeParse(raw).success) {
      this.#resolve?.()
      return
    }
    const result = coreResultSchema.safeParse(raw)
    if (!result.success) return this.protocol()
    const pending = this.#pending.get(result.data.requestId)
    if (!pending) return this.protocol()
    this.#pending.delete(result.data.requestId)
    if (!result.data.ok)
      return pending.reject(
        new CapabilityError(result.data.error.code, result.data.error.retryable)
      )
    const value = pending.schema.safeParse(result.data.payload)
    if (!value.success) return this.protocol()
    pending.resolve(value.data)
  }

  private protocol() {
    this.fail(new CapabilityError('protocol_violation', false))
    this.#process.kill()
  }
  private fail(error: Error) {
    if (this.#closed) return
    this.#closed = true
    this.#reject?.(error)
    for (const pending of this.#pending.values()) pending.reject(error)
    this.#pending.clear()
  }
}

const campaignSchema = z.object({
  activeCampaignId: z.uuid().nullable(),
  campaigns: z.array(
    z.object({ id: z.uuid(), name: z.string(), createdAt: z.string() })
  )
}) as z.ZodType<CampaignSnapshot>
