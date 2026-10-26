import { matchesReceipt } from './command-fingerprint';
import { validateTransferSnapshot } from '../transfer/registry';
import { installSourceCellIndex } from './atlas-source-cell';
import DATA_FORMAT from '../data-format.json';
import { atlasProjectionSource, installAtlasShapeSource } from './atlas-shape-source';
import {
  decodePreparationDraft,
  decodeRoom,
  decodeRoomDraft,
  preparationDraftTable,
  readStoredPlan,
  storedAddRoom,
  storedEdit,
  storedHistory,
  storedKeepRoomDraft,
  storedReconcile,
} from './stored-records';
import { validateBackupCandidate, validateDatabase } from './snapshot-validation';
import { keepSessionRecapDraft, readSessionRecapDraft } from './session-recap';
import { profileBounds, terrainProfile } from '../atlas/terrain-profile';
import { installTravelHistory } from './travel-history';
import { checkedWorldNoteRow } from './world-note-row';
import { installRoomGroups, validateRoomGroups } from './room-groups';
import { installTerritories, readTerritories } from './atlas-territories';
import { TerrainAuthorCache } from './terrain-author-cache';
import { terrainTraceMeasure } from '../atlas/terrain-timing';
import { vegetationScene } from './vegetation';
import { readSceneEncounterSelection } from './scene-encounter-selection';
import { noteMergeWork } from './note-merge';
import type {
  AtlasRegionGeometry,
  AtlasRegionSource,
  AtlasRegionView,
} from '../atlas/atlas-region-contracts';
import { storedExecuteWorld } from './world';
import {
  installWorldSchema,
  previewTravel,
  readWorldCalendar as readNpcPlanCalendar,
  readSceneWorld,
  readWorld,
  reconcileWorld,
} from './world';
import { CommittedSources } from './committed-sources';
import { atlasReadChanges } from './atlas-read-journal';
import { drawingElement, drawingRoom } from './drawing';
import {
  activateDungeonFeature,
  drawingView,
  executeDrawing,
  installDrawingSchema,
  roomMapStyle,
} from './drawing';
import { dungeonMapView } from './dungeon-play';
import {
  dungeonCommandState,
  dungeonDisplay,
  dungeonGeometry,
  dungeonView,
  executeDungeon,
  installDungeonPlaySchema,
  previewDungeon,
} from './dungeon-play';
import { roomDirectoryQuery, roomGeometries, roomOrder, visibleRoomWhere } from './room-reads';
import type { RoomDirectoryQuery, WorkspaceGeometry, WorkspaceShell } from '../shared/contracts';
import {
  type Campaign,
  type CampaignRename,
  type Edit,
  type Room,
  type RoomCommit,
  type WorkingRoomDraft,
  type Workspace,
} from '../shared/contracts';
import { keepLiveMomentDraft as keepMomentDraft } from './live-moment-drafts';
import { atlasPartyPoint } from '../atlas/atlas-runtime-model';
import { installLandscape, landscapeRegion, terrainRegion } from './atlas-landscape';
import { checkNoteThread, readNoteThread } from './note-thread';
import { captureKeyNote, keyNoteCaptureStatus, readKeyNoteChoices } from './key-note-capture';
import type { KeyNoteCaptureCommand } from '../campaign/key-note-capture-contracts';
import { readNoteRoomUses } from './note-room-uses';
import {
  atlasEntrances,
  atlasLocalJourney,
  installAtlasTravel,
  previewAtlasLocal,
  storedApplyAtlasTravel,
} from './atlas-travel';
import {
  applyAtlasCommand,
  atlasBindings,
  atlasHistoryState,
  atlasRoot,
  hasAtlasReceipt,
  installCampaignAtlas,
  storedAtlasCitySite,
  storedAtlasOverview,
  storedCampaignAtlas,
  storedCoupleAtlasWall,
  storedReconcileAtlasGeometry,
} from './campaign-atlas';
import type { AtlasCommand, CampaignAtlas } from '../atlas/campaign-atlas-contracts';
import {
  applyCampaignCatalog,
  catalogCommand,
  catalogOutcome,
  noteCampaignOpened,
} from './campaign-catalog';
import type {
  CampaignCatalogCommand,
  CampaignCatalogReceipt,
} from '../campaign/campaign-contracts';
import type { ConflictChoice } from '../campaign/campaign-contracts';
import { readCombatResolution } from './combat-resolution';
import { ChronicleReadSession } from './chronicle-pages';
import { readLocationActivities } from './location-activity';
import { readCityActivities } from './city-activity';
import { readNpcBuildingChoices, readNpcPlaces } from './npc-places';
import { readLocationMaterials } from './location-notebook';
import { readWorldLinks } from './world-links';
import {
  discardWorldRelationPairDraft,
  executeWorldRelationPair,
  executeWorldRelationPairHistory,
  installWorldRelationPairs,
  keepWorldRelationPairDraft,
  readWorldRelationPairDraft,
  readWorldRelationPairHistory,
  reconcileWorldRelationPair,
  reconcileWorldRelationPairHistory,
} from './world-relation-pair';
import type {
  WorldRelationPairCommand,
  WorldRelationPairDraft,
  WorldRelationPairHistoryCommand,
} from '../campaign/world-relation-pair-contracts';
import { readNpcCast, readNpcDossier } from './npc-cast';
import { previewSceneTime } from './time-plan';
import { readAgenda } from './agenda';
import { readSceneVisits } from './scene-visits';
import { readNarrativeJournal } from './narrative-journal';
import { readSessionProgress } from './visit-outcomes';
import { readSessionPacket } from './session-packet';
import { installMaskHistoryIndexes, readMaskHistory } from './mask-history';
import { keepChaseDraft } from './chase-drafts';
import { readDay } from './adventuring-day';
import { installNpcRecords } from './npc-record';
import {
  discardNpcDraft,
  executeNpc,
  keepNpcDraft,
  npcDraft,
  npcDrafts,
  readNpc,
  readNpcs,
  reconcileNpc,
} from './npcs';
import type { NpcCommand, NpcDraft, NpcQuery } from '../campaign/npc-contracts';
import { readWorldSources } from './world-sources';
import {
  discardGroupDraft,
  groupDraft,
  groupView,
  installGroups,
  keepGroupDraft,
  preparedGroups,
} from './groups';
import {
  discardTreasuryDraft,
  installTreasury,
  keepTreasuryDraft,
  readTreasuryDraft,
  treasureHistory,
} from './treasury';
import {
  deskContent,
  installSceneDesk,
  keepSceneCreationDraft,
  pinSceneDesk,
  readSceneCreationDraft,
  readSceneDesk,
  searchDesk,
} from './scene-desk';
import {
  discardFinishDraft,
  installFinishDrafts,
  keepFinishDraft,
  readFinishDraft,
} from './finish-drafts';
import {
  discardNarrativeDraft,
  installNarrative,
  keepNarrativeDraft,
  readNarrative,
} from './narrative';
import { readPreparedGroup } from './session';
import {
  executeSession,
  generateSession,
  installSessionSchema,
  readSession,
  readSessionRun,
  readSessionRuns,
  regenerateSessionProposal,
  regenerateSessionReward,
  scenePreparation,
} from './session';
import {
  combatDrafts,
  discardCombatDraft,
  installCombatDraftSchema,
  keepCombatDraft,
  readCombatDraft,
} from './combat-drafts';
import type { CombatDraftKind, CombatWorkingDraft } from '../runtime/combat-draft-contracts';
import { installContentRuntime } from './content-runtime';
import { installTriggers } from './triggers';
import { ExtensionRegistry } from './extensions';
import type { ExtensionCommand } from '../workspace/extension-contracts';
import { dungeonBudgetView, validateDungeonPlacement } from './dungeon-budget';
import type { CommitOutcome } from '../shared/commit-receipt';
import { checkedCommitReference, type CommitReference } from '../shared/commit-receipt';
import { graphLayout, GraphShadow, graphView, installGraph } from './graph';
import type { GraphCommand, GraphView } from '../atlas/graph-contracts';
import type { DrawingCommand, DrawingView } from '../atlas/drawing-contracts';
import type { DungeonPath, PathPreview } from '../atlas/path-contracts';
import { installDungeonKey } from './dungeon-key';
import { installPathSchema, previewDungeonPath } from './paths';
import { readCommitReceipt } from './commit-receipt';
import { installVolumeSchema, readDungeonVolume } from './volume';
import { installDungeonSenses } from './dungeon-senses';
import { installAutonomyResources } from './autonomy-resources';
import { installNpcDungeonSchema } from './npc-dungeon';
import { installAutonomyDungeonSchema } from './autonomy-dungeon';
import type { DungeonCommand, DungeonRequest } from '../atlas/dungeon-contracts';
import { installNpcWorldSchema } from './npc-world';
import {
  autonomyDecision,
  autonomyView,
  captureAutonomyBasis,
  executeAutonomy,
  installAutonomySchema,
} from './autonomy';
import type { AutonomyCommand } from '../runtime/autonomy-contracts';
import {
  executePlayer,
  installPlayerSchema,
  playerAssets,
  playerMediaFiles,
  playerObservers,
  playerSettings,
  playerView,
  projectPlayer,
  savePlayerAsset,
  setPlayerWindow,
} from './player';
import type { PlayerAsset, PlayerCommand, PlayerFrame } from '../runtime/player-contracts';
import {
  cityOverview,
  executeCity,
  installCitySchema,
  readCity,
  readCityBuildingChoices,
} from './city';
import type { CityCommand } from '../atlas/city-contracts';
import { storedCreate, storedRenameCampaign } from './campaign-data';
import {
  archiveSourceChoices,
  campaignOverview,
  definitionConflicts,
  eraseCampaignRows,
  installCampaignSchema,
  pruneCampaignSnapshot,
  publishSnapshot,
  remapSnapshot,
  sharedPlan,
  snapshotCounts,
  trashCampaign,
  validateCampaignSnapshotSettings,
} from './campaign-data';
import {
  closeSync as closeSnapshot,
  closeSync,
  copyFileSync,
  fsyncSync,
  mkdirSync,
  mkdtempSync,
  openSync as openSnapshot,
  openSync,
  readSync,
  renameSync,
  rmSync,
} from 'node:fs';
import { canonicalJson } from '../campaign/generation/canonical-json';
import {
  audioFile,
  audioLibrarySnapshot,
  audioMediaFiles,
  executeMusic,
  ingestAudio,
  installMusicSchema,
  mergeAudioLibrary,
  readAudioAsset,
  readAudioAssets,
  readMusic,
  readMusicFavorites,
  readMusicSubject,
  refreshMusicContext,
  saveMusicPosition,
} from './music';
import type {
  AudioAsset,
  AudioQuery,
  MusicCommand,
  MusicSubject,
  MusicView,
} from '../runtime/music-contracts';
import type { TravelRequest, WorldCommand } from '../runtime/world-contracts';
import {
  executeItemShop,
  installItemsSchema,
  readShop,
  readShopHistory,
  readShops,
  sceneShops,
} from './items';
import { readItemDefinition, readItemDefinitions } from './item-definitions';
import type { ItemQuery, ItemShopCommand } from '../catalog/items-contracts';
import { createHash, randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import {
  preparationTarget,
  type Preparation,
  type PreparationCommand,
  type PreparationDraft,
  type PreparationEdit,
  type PreparationSelection,
} from '../campaign/preparation-contracts';
import { type ManualPlan } from '../../features/planner/manual-planner';
import { applyLiveCommand, consumeSceneTime } from './live';
import {
  installLiveSchema,
  liveStatus,
  readArchivedRoster,
  readArchives,
  readLive,
  readLiveScene,
} from './live';
import type { LiveCommand, LiveScene } from '../runtime/live-contracts';
import { executeCombat, installCombatSchema, readCombat } from './combat';
import { executeChase, installChaseSchema, readChase } from './chase';
import { installMaskReconciliationSchema } from './mask-reconciliation';
import { executeSceneRule, installRuleReferenceSchema, readSceneRules } from './rule-references';
import type { SceneRuleCommand } from '../catalog/rule-reference-contracts';
import { executeSceneCheck, installSceneCheckSchema, readSceneChecks } from './scene-checks';
import type { SceneCheckCommand } from '../runtime/scene-check-contracts';
import type { ChaseCommand } from '../runtime/chase-contracts';
import type { CombatCommand } from '../runtime/combat-contracts';
import { storedExecuteProgress } from './progression';
import {
  installProgressSchema,
  readLedger,
  readLedgerDetail,
  readLedgerInventory,
  readLootBalance,
  readProgress,
  readProgressHistory,
  readTreasure,
  readTreasures,
} from './progression';
import type { LedgerInventoryQuery, LedgerQuery, ProgressCommand } from '../runtime/progression';
import { readChronicle } from './chronicle';
import {
  installEncounterSchema,
  readEncounterPlan,
  readEncounterPlans,
  saveEncounterPlan,
} from './encounters';
import type { EncounterPlanCommand } from '../catalog/encounter-contracts';
import { executePresetCommand, readPresetOutcome, readPresetRegistry } from './preset-registry';
import {
  acceptGeneration,
  executeGeneration,
  generateEncounters,
  installGenerationSchema,
  readEncounterTables,
  readGenerationRun,
  readGenerationRuns,
  readGeneratorRegistry,
  readLootTables,
  rollLoot,
} from './generation';
import type {
  GenerationCommand,
  GenerationRequest,
  LootRollCommand,
} from '../campaign/generation-contracts';
import type { SessionCommand, SessionGenerationRequest } from '../campaign/session-contracts';
import { storedAtlasRegionView } from './atlas-region';
import {
  commitPreparation,
  storedKeepPreparationDrafts,
  storedPreparation,
  storedReconcilePreparationPlan,
  storedSelectPreparation,
} from './preparation';
import { storedAtlasHeight } from './terrain-grid';
import {
  checkedTutorialRun,
  tutorialLessonRevision,
  type TutorialRun,
} from '../workspace/tutorial-contracts';
const roomNumberOrder = new Intl.Collator('de', { numeric: true });

const json = (value: unknown) => JSON.stringify(value);
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

/** Only the privileged host owns this connection. All command guards run inside BEGIN IMMEDIATE. */
// Hash the source without retaining a second, potentially huge database in memory.
function snapshotDigest(filename: string) {
  const fd = openSnapshot(filename, 'r'),
    hash = createHash('sha256'),
    chunk = Buffer.allocUnsafe(65536);
  try {
    let n: number;
    while ((n = readSync(fd, chunk, 0, chunk.length, null)) > 0) hash.update(chunk.subarray(0, n));
    return hash.digest('hex');
  } finally {
    closeSnapshot(fd);
  }
}

export class CampaignStore {
  private terrainAuthorCache = new TerrainAuthorCache();
  /** Internal trusted-worker handoff; deliberately absent from the preload API. */
  rememberTerrainGrid(
    token: string,
    fence: string,
    grid: import('../atlas/terrain-spatial-model').TerrainGrid,
  ) {
    const source = this.atlasRegionSource(token);
    if (source.fence === fence) this.terrainAuthorCache.seed(source.campaignId, grid, fence);
  }

  private chronicleRead: ChronicleReadSession | null = null;
  private db: any;
  private committedSources = new CommittedSources();
  private shellFirstRoom = new WeakMap<
    object,
    { campaignId: string; stamp: string; id: string | null }
  >();
  private graphShadow: GraphShadow | null = null;
  private graphRouting = false;
  private withGraph<T>(fn: () => T): T {
    const original = this.db;
    if (!this.graphShadow) return fn();
    this.db = this.graphShadow.db;
    this.graphRouting = true;
    try {
      return fn();
    } finally {
      this.db = original;
      this.graphRouting = false;
    }
  }

  private extensionRegistry: ExtensionRegistry;
  private backupEpoch = 0;
  private active: { campaignId: string; token: string } | null = null;
  constructor(
    readonly filename: string,
    readonly applicationVersion = 'development',
  ) {
    if (
      typeof applicationVersion !== 'string' ||
      !applicationVersion.trim() ||
      applicationVersion.length > 128
    )
      throw new Error('Anwendungsversion fehlt.');
    mkdirSync(dirname(filename), { recursive: true });
    this.db = new Database(filename);
    const schema = this.db.pragma('user_version', { simple: true });
    if (
      (schema !== 0 && schema !== DATA_FORMAT.schema) ||
      (schema === 0 &&
        this.db.prepare("SELECT 1 FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' LIMIT 1").get())
    ) {
      this.db.close();
      throw new Error(
        'Nicht unterstütztes Testdatenformat. Eine neue Kampagne im aktuellen Format anlegen. Originaldatei bleibt erhalten.',
      );
    }
    if (schema === DATA_FORMAT.schema) {
      const findTable = this.db.prepare(
        "SELECT 1 FROM sqlite_schema WHERE type='table' AND name=?",
      );
      for (const table of DATA_FORMAT.tables) {
        if (!findTable.get(table)) {
          const message: Record<string, string> = {
            travel_checkpoint: 'Reisecheckpoint-Speicher fehlt.',
            room_group: 'Raumgruppenspeicher fehlt.',
            scene_opponent_group: 'Szenengegner-Zuordnung fehlt.',
            atlas_territory: 'Regionsspeicher fehlt.',
            atlas_territory_layer: 'Regionsspeicher fehlt.',
            chase_working_draft: 'Verfolgungsentwurfsspeicher fehlt.',
          };
          this.db.close();
          throw new Error(message[table] ?? 'Kampagnenspeicher ist unvollständig: ' + table);
        }
      }
    }
    this.extensionRegistry = new ExtensionRegistry(this.db);
    const version = this.db.prepare('SELECT sqlite_version() v').get().v as string;
    if (version.localeCompare('3.53.4', undefined, { numeric: true }) < 0) {
      this.db.close();
      throw new Error('SQLite-Wartungsstand zu alt.');
    }
    this.db.pragma('foreign_keys=ON');
    this.db.pragma('journal_mode=WAL');
    this.db.pragma('synchronous=FULL');
    this.db.pragma('secure_delete=ON');
    this.db.pragma('busy_timeout=5000');

    try {
      this.db
        .transaction(() => {
          if (schema === 0) {
            this.db.exec(`
      CREATE TABLE IF NOT EXISTS campaign(id TEXT PRIMARY KEY, name TEXT NOT NULL, selected_id TEXT, cursor INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 0) STRICT;
      CREATE TABLE IF NOT EXISTS scope(campaign_id TEXT NOT NULL REFERENCES campaign(id), id TEXT NOT NULL, name TEXT NOT NULL, PRIMARY KEY(campaign_id,id)) STRICT;
      CREATE TABLE IF NOT EXISTS room(campaign_id TEXT NOT NULL, id TEXT NOT NULL, scope_id TEXT NOT NULL, number TEXT NOT NULL, name TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT NOT NULL, checksum TEXT NOT NULL, floor_id TEXT NOT NULL DEFAULT 'ground', PRIMARY KEY(campaign_id,id), FOREIGN KEY(campaign_id,scope_id) REFERENCES scope(campaign_id,id)) STRICT;
      CREATE TABLE IF NOT EXISTS history(campaign_id TEXT NOT NULL REFERENCES campaign(id), ordinal INTEGER NOT NULL, room_id TEXT NOT NULL, before_json TEXT NOT NULL, after_json TEXT NOT NULL, guard_revision INTEGER NOT NULL, PRIMARY KEY(campaign_id,ordinal)) STRICT;
      CREATE TABLE IF NOT EXISTS receipt(command_id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, campaign_id TEXT NOT NULL REFERENCES campaign(id), room_id TEXT NOT NULL, revision INTEGER NOT NULL) STRICT;
      CREATE TABLE IF NOT EXISTS source(campaign_id TEXT PRIMARY KEY REFERENCES campaign(id), bytes BLOB NOT NULL, checksum TEXT NOT NULL) STRICT;
      CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
    `);
            this.db.exec(`
      CREATE TABLE IF NOT EXISTS world_note(campaign_id TEXT NOT NULL REFERENCES campaign(id), id TEXT NOT NULL, revision INTEGER NOT NULL, trashed INTEGER NOT NULL DEFAULT 0, payload TEXT NOT NULL, checksum TEXT NOT NULL, PRIMARY KEY(campaign_id,id)) STRICT;
      CREATE TABLE IF NOT EXISTS plan(campaign_id TEXT NOT NULL REFERENCES campaign(id), id TEXT NOT NULL, revision INTEGER NOT NULL, name TEXT NOT NULL, PRIMARY KEY(campaign_id,id)) STRICT;
      CREATE TABLE IF NOT EXISTS planned_visit(campaign_id TEXT NOT NULL, plan_id TEXT NOT NULL, id TEXT NOT NULL, ordinal INTEGER NOT NULL, payload TEXT NOT NULL, checksum TEXT NOT NULL, PRIMARY KEY(campaign_id,id), FOREIGN KEY(campaign_id,plan_id) REFERENCES plan(campaign_id,id)) STRICT;
      CREATE VIRTUAL TABLE IF NOT EXISTS note_search USING fts5(campaign_id UNINDEXED, note_id UNINDEXED, title, body);
      INSERT INTO note_search(note_search,rank) VALUES('secure-delete',1);
    `);
            this.db.exec(
              'CREATE TABLE IF NOT EXISTS drawing_floor(campaign_id TEXT NOT NULL, scope_id TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, source_elevation REAL NOT NULL, PRIMARY KEY(campaign_id,scope_id,id), FOREIGN KEY(campaign_id,scope_id) REFERENCES scope(campaign_id,id)) STRICT;',
            );
            this.db.exec(
              'CREATE TABLE IF NOT EXISTS room_draft(campaign_id TEXT NOT NULL, room_id TEXT NOT NULL, payload TEXT NOT NULL, checksum TEXT NOT NULL, PRIMARY KEY(campaign_id,room_id), FOREIGN KEY(campaign_id,room_id) REFERENCES room(campaign_id,id)) STRICT;',
            );
            this.db
              .exec(`CREATE TABLE IF NOT EXISTS location(campaign_id TEXT NOT NULL REFERENCES campaign(id), id TEXT NOT NULL, revision INTEGER NOT NULL, trashed INTEGER NOT NULL DEFAULT 0, payload TEXT NOT NULL, checksum TEXT NOT NULL, PRIMARY KEY(campaign_id,id)) STRICT;
        CREATE TABLE IF NOT EXISTS location_map(campaign_id TEXT NOT NULL, scope_id TEXT NOT NULL, location_id TEXT NOT NULL, PRIMARY KEY(campaign_id,scope_id), FOREIGN KEY(campaign_id,scope_id) REFERENCES scope(campaign_id,id), FOREIGN KEY(campaign_id,location_id) REFERENCES location(campaign_id,id)) STRICT;`);
            installLiveSchema(this.db);
            installCombatSchema(this.db);
            installCombatDraftSchema(this.db);
            installChaseSchema(this.db);
            installMaskHistoryIndexes(this.db);
            installMaskReconciliationSchema(this.db);
            installRuleReferenceSchema(this.db);
            installSceneCheckSchema(this.db);
            installProgressSchema(this.db);
            installEncounterSchema(this.db);
            installGenerationSchema(this.db);
            installNpcRecords(this.db);
            this.db.exec(
              "CREATE TABLE IF NOT EXISTS preparation_draft(campaign_id TEXT NOT NULL REFERENCES campaign(id), kind TEXT NOT NULL CHECK(kind IN ('note','plan','location')), target_id TEXT NOT NULL, payload TEXT NOT NULL, checksum TEXT NOT NULL, PRIMARY KEY(campaign_id,kind,target_id)) STRICT;",
            );
            installSessionSchema(this.db);
            installItemsSchema(this.db);
            installWorldSchema(this.db);
            installMusicSchema(this.db);
            installCampaignSchema(this.db);
            installCitySchema(this.db);
            installPlayerSchema(this.db);
            installNpcWorldSchema(this.db);
            installAutonomySchema(this.db);
            installDrawingSchema(this.db);
            installDungeonPlaySchema(this.db);
            installNpcDungeonSchema(this.db);
            installAutonomyDungeonSchema(this.db);
            installAutonomyResources(this.db);
            installDungeonSenses(this.db);
            installVolumeSchema(this.db);
            installPathSchema(this.db);
            installDungeonKey(this.db);
            installGraph(this.db);
            installTriggers(this.db);
            installContentRuntime(this.db);
            installNarrative(this.db);
            installFinishDrafts(this.db);
            installSceneDesk(this.db);
            installTreasury(this.db);
            installGroups(this.db);
            installWorldRelationPairs(this.db);
            installCampaignAtlas(this.db);
            installAtlasTravel(this.db);
            installLandscape(this.db);
            installTerritories(this.db);
            installRoomGroups(this.db);
            installTravelHistory(this.db);
            this.db.pragma('user_version=' + DATA_FORMAT.schema);
          }
          installSourceCellIndex(this.db);
          installAtlasShapeSource(this.db);
        })
        .immediate();
    } catch (error) {
      this.db.close();
      throw error;
    }
    this.db.function('atlas_lower', { deterministic: true }, (text: unknown) =>
      typeof text === 'string' ? text.normalize('NFC').toLocaleLowerCase('de') : '',
    );
  }
  private reconcileAtlasGeometry(token: string) {
    return storedReconcileAtlasGeometry(
      this.db,
      { guard: this.guard.bind(this), cities: this.cities.bind(this), city: this.city.bind(this) },
      token,
    );
  }
  private coupleAtlasWall(
    c: AtlasCommand,
    before: Room,
    elements: import('../atlas/drawing-contracts').DrawingElement[],
  ) {
    return storedCoupleAtlasWall(
      this.db,
      {
        workspace: this.workspace.bind(this),
        edit: this.edit.bind(this),
        drawing: this.drawing.bind(this),
        executeDrawing: this.executeDrawing.bind(this),
      },
      c,
      before,
      elements,
    );
  }
  private travelAtlas(token: string) {
    const a = this.campaignAtlas(token),
      p = atlasPartyPoint(a) ?? { x: 0, y: 0 };
    a.terrain.landscape = landscapeRegion(this.db, a.campaignId, {
      x: p.x - 6000,
      y: p.y - 6000,
      width: 12000,
      height: 12000,
    });
    return a;
  }
  previewAtlasTravel(token: string, destination: import('../shared/contracts').Point) {
    return previewAtlasLocal(this.travelAtlas(token), destination);
  }
  private applyAtlasTravel(c: import('../atlas/atlas-travel-contracts').AtlasTravelCommand) {
    return storedApplyAtlasTravel(
      this.db,
      {
        guard: this.guard.bind(this),
        travelAtlas: this.travelAtlas.bind(this),
        executeLive: this.executeLive.bind(this),
        liveScene: this.liveScene.bind(this),
        dungeon: this.dungeon.bind(this),
        executeDungeon: this.executeDungeon.bind(this),
      },
      c,
    );
  }
  executeAtlasTravel(c: import('../atlas/atlas-travel-contracts').AtlasTravelCommand) {
    this.applyAtlasTravel(c);
    return this.campaignAtlas(c.token);
  }
  executeAtlasTravelCommit(
    c: import('../atlas/atlas-travel-contracts').AtlasTravelCommand,
  ): import('../atlas/atlas-travel-contracts').AtlasTravelCommit {
    this.applyAtlasTravel(c);
    return { campaignId: c.campaignId, commandId: c.commandId, sceneId: c.sceneId };
  }
  atlasVegetationScene(
    token: string,
    box: import('../atlas/atlas-landscape').LandscapeBox,
    mpp: number,
  ) {
    const cam = this.guard(token);
    return {
      ...vegetationScene(this.db, cam, box, mpp, atlasRoot(this.db, cam).revision),
      fence: this.atlasRegionSource(token).fence,
    };
  }
  atlasSpatialScene(
    token: string,
    box: import('../atlas/atlas-landscape').LandscapeBox,
    mpp: number,
    draft?: import('../atlas/spatial-terrain').SpatialTerrainDraft,
    fence?: string,
  ) {
    const cam = this.guard(token),
      source = this.atlasRegionSource(token);
    if (fence !== undefined && source.fence !== fence)
      throw Error('Gelände inzwischen geändert. Entwurf verwerfen und erneut zeichnen.');
    return {
      ...vegetationScene(this.db, cam, box, mpp, atlasRoot(this.db, cam).revision, { draft }),
      fence: source.fence,
    };
  }
  atlasTerrainProfile(token: string, points: import('../shared/contracts').Point[]) {
    const first = this.atlasMaskRegion(token, profileBounds(points));
    const pad = Math.max(1, ...first.records.filter((r) => r.height).map((r) => r.resolution));
    const reply = this.atlasMaskRegion(token, profileBounds(points, pad));
    return { ...terrainProfile(reply.records, points), revision: reply.revision };
  }
  atlasHeight(token: string, point: import('../shared/contracts').Point) {
    return storedAtlasHeight(this.db, { guard: this.guard.bind(this) }, token, point);
  }
  atlasMaskRegion(token: string, box: import('../atlas/atlas-landscape').LandscapeBox) {
    const cam = this.guard(token);
    if (
      !box ||
      ![box.x, box.y, box.width, box.height, box.x + box.width, box.y + box.height].every(
        Number.isFinite,
      ) ||
      box.width <= 0 ||
      box.height <= 0
    )
      throw Error('Pinselbereich prüfen.');
    const bytes = this.db
      .prepare(
        'SELECT coalesce(sum(length(payload)),0) n FROM atlas_landscape WHERE campaign_id=? AND max_x>=? AND min_x<=? AND max_y>=? AND min_y<=?',
      )
      .get(cam, box.x, box.x + box.width, box.y, box.y + box.height) as { n: number };
    if (bytes.n > 16 * 1024 * 1024)
      throw Error('Pinselbereich zu groß. In kürzeren Zügen bearbeiten.');
    return {
      revision: atlasRoot(this.db, cam).revision,
      records: terrainRegion(this.db, cam, box, true),
    };
  }
  landscapeFind(token: string, text: string) {
    const cam = this.guard(token);
    if (typeof text !== 'string' || text.length > 200) throw new Error('Suchtext prüfen.');
    return this.db
      .prepare(
        "SELECT payload FROM atlas_landscape WHERE campaign_id=? AND json_extract(payload,'$.kind')!='patch' AND (instr(lower(json_extract(payload,'$.name')),lower(?))>0 OR json_extract(payload,'$.locationId')=?) LIMIT 100",
      )
      .all(cam, text, text)
      .map((r: any) =>
        JSON.parse(r.payload),
      ) as import('../atlas/atlas-landscape').LandscapeRecord[];
  }
  landscapeRegion(
    token: string,
    box: import('../atlas/atlas-landscape').LandscapeBox,
    metersPerPixel = 0,
    includePatches = true,
  ) {
    const cam = this.guard(token);
    return {
      revision: atlasRoot(this.db, cam).revision,
      records: landscapeRegion(this.db, cam, box, metersPerPixel, includePatches),
    };
  }
  registerReference(token: string, mime: string, bytes: Buffer) {
    const cam = this.guard(token),
      id = hash(bytes);
    this.db
      .prepare('INSERT OR IGNORE INTO atlas_reference_asset VALUES(?,?,?,?)')
      .run(cam, id, mime, bytes);
    return id;
  }
  referenceAssetSource(token: string, id: string) {
    const r = this.db
      .prepare('SELECT mime,bytes FROM atlas_reference_asset WHERE campaign_id=? AND id=?')
      .get(this.guard(token), id);
    if (!r) throw new Error('Referenzbild fehlt.');
    return r as { mime: string; bytes: Buffer };
  }
  atlasIdentity(token: string) {
    const campaignId = this.guard(token);
    return { campaignId, token, revision: atlasRoot(this.db, campaignId).revision };
  }
  atlasOverview(token: string): import('../atlas/campaign-atlas-contracts').AtlasOverview {
    return storedAtlasOverview(this.db, { guard: this.guard.bind(this) }, token);
  }
  atlasObjects(
    token: string,
    q: import('../atlas/campaign-atlas-contracts').AtlasObjectQuery,
  ): import('../atlas/campaign-atlas-contracts').AtlasObjectPage {
    const cam = this.guard(token);
    if (
      !q ||
      !['room', 'city', 'landscape', 'scope'].includes(q.kind) ||
      typeof q.text !== 'string' ||
      q.text.length > 200 ||
      !Number.isSafeInteger(q.limit) ||
      q.limit < 1 ||
      q.limit > 200
    )
      throw new Error('Atlassuche prüfen.');
    const fence = this.committedSources.version(this.db);
    const page = this.db.transaction(() => {
      const revision = atlasRoot(this.db, cam).revision,
        c = q.cursor;
      if (
        c &&
        (c.token !== token ||
          c.fence !== fence ||
          !Number.isSafeInteger(c.revision) ||
          c.revision !== revision ||
          c.kind !== q.kind ||
          c.text !== q.text ||
          typeof c.after !== 'string')
      )
        throw new Error('Atlassuche inzwischen geändert. Suche erneut beginnen.');
      const text = q.text.normalize('NFC').toLocaleLowerCase('de'),
        room = q.kind === 'room';
      const sql =
        q.kind === 'scope'
          ? `SELECT id,name,0 revision FROM scope WHERE campaign_id=? AND id>? AND instr(atlas_lower(name),?)>0 ORDER BY id LIMIT ?`
          : q.kind === 'landscape'
            ? `SELECT a.id,a.revision,coalesce(json_extract(l.payload,'$.name'),json_extract(a.payload,'$.name')) name FROM atlas_landscape a LEFT JOIN location l ON l.campaign_id=a.campaign_id AND l.id=json_extract(a.payload,'$.locationId') WHERE a.campaign_id=? AND a.id>? AND json_extract(a.payload,'$.kind')!='patch' AND coalesce(l.trashed,0)=0 AND instr(atlas_lower(coalesce(json_extract(l.payload,'$.name'),json_extract(a.payload,'$.name'))),?)>0 ORDER BY a.id LIMIT ?`
            : room
              ? `SELECT r.id,r.name,r.number,r.revision,r.scope_id scopeId,r.floor_id floorId FROM room r WHERE r.campaign_id=? AND r.id>? AND instr(atlas_lower(r.name||' '||r.number),?)>0 AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=r.campaign_id AND h.id=r.id AND h.kind='room' AND h.hidden=1) AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=r.campaign_id AND h.id=r.floor_id AND h.scope_id=r.scope_id AND h.kind='floor' AND h.hidden=1) ORDER BY r.id LIMIT ?`
              : `SELECT id,json_extract(payload,'$.name') name,revision FROM city_document WHERE campaign_id=? AND id>? AND instr(atlas_lower(json_extract(payload,'$.name')),?)>0 ORDER BY id LIMIT ?`;
      const items = this.db.prepare(sql).all(cam, c?.after ?? '', text, q.limit + 1),
        more = items.length > q.limit;
      items.length = Math.min(q.limit, items.length);
      return {
        campaignId: cam,
        token,
        revision,
        items,
        next: more
          ? { token, fence, revision, after: items.at(-1)!.id, kind: q.kind, text: q.text }
          : null,
      };
    })();
    if (this.committedSources.version(this.db) !== fence)
      throw new Error('Atlassuche inzwischen geändert. Suche erneut beginnen.');
    return page;
  }
  atlasLandscapeObject(
    token: string,
    id: string,
  ): import('../atlas/atlas-landscape').LandscapeRecord {
    const cam = this.guard(token);
    if (typeof id !== 'string' || !id) throw new Error('Landschaftskennung prüfen.');
    const row = this.db
      .prepare(
        "SELECT a.payload,l.payload location,l.trashed FROM atlas_landscape a LEFT JOIN location l ON l.campaign_id=a.campaign_id AND l.id=json_extract(a.payload,'$.locationId') WHERE a.campaign_id=? AND a.id=?",
      )
      .get(cam, id);
    if (!row || row.trashed) throw new Error('Landschaftsobjekt nicht gefunden.');
    const record = JSON.parse(row.payload);
    if (row.location) record.name = JSON.parse(row.location).name;
    return record;
  }
  atlasRoom(token: string, id: string): Room {
    if (this.graphShadow && !this.graphRouting)
      return this.withGraph(() => this.atlasRoom(token, id));
    const cam = this.guard(token);
    if (typeof id !== 'string' || !id) throw new Error('Raumkennung prüfen.');
    const row = this.db.prepare('SELECT * FROM room WHERE campaign_id=? AND id=?').get(cam, id);
    if (!row) throw new Error('Raum nicht gefunden.');
    return decodeRoom(row);
  }
  atlasRoomCommit(edit: Edit): import('../shared/contracts').RoomCommit {
    this.applyAtlas({
      commandId: edit.commandId,
      token: edit.token,
      campaignId: edit.campaignId,
      action: { kind: 'room-edit', edit },
    });
    return { ...this.edit(edit), atlasRevision: atlasRoot(this.db, edit.campaignId).revision };
  }
  atlasDrawingCommit(command: DrawingCommand) {
    this.applyAtlas({
      commandId: command.commandId,
      token: command.token,
      campaignId: command.campaignId,
      action: { kind: 'drawing', command },
    });
    // The Atlas receipt already checked replay; read back the same complete author inventory.
    return {
      workspace: this.workspace(),
      view: this.dungeonAuthoring(command.token).drawing,
      atlasRevision: atlasRoot(this.db, command.campaignId).revision,
    };
  }
  terrainStrokeSource(
    c: AtlasCommand,
    cursor?: import('../atlas/atlas-region-contracts').AtlasRegionCursor,
  ) {
    this.guard(c.token, c.campaignId);
    if (
      c.action.kind !== 'landscape-height-stroke' ||
      this.db.prepare('SELECT 1 FROM atlas_receipt WHERE command_id=?').get(c.commandId)
    )
      return;
    const source = this.atlasRegionSource(c.token, cursor);
    if (c.sourceFence !== undefined && c.sourceFence !== source.fence)
      throw Error('Atlas inzwischen geändert. Ausschnitt vor dem Zeichnen erneut laden.');
    return source;
  }
  executeAtlasCommit(
    c: AtlasCommand,
    prepared?: import('./terrain-scale').PreparedTerrainStroke,
  ): import('../atlas/campaign-atlas-contracts').AtlasCommitAck {
    const value = terrainTraceMeasure('author.transaction-history', () =>
      prepared ? this.db.transaction(() => this.applyAtlas(c, prepared))() : this.applyAtlas(c),
    ) as { id?: string } | undefined;
    const root = atlasRoot(this.db, c.campaignId);
    return {
      campaignId: c.campaignId,
      commandId: c.commandId,
      revision: root.revision,
      ...(c.terrainStroke ? { sourceFence: this.atlasRegionSource(c.token).fence } : {}),
      ...(typeof value?.id === 'string' ? { result: { id: value.id } } : {}),
      ...atlasHistoryState(this.db, c.campaignId),
    };
  }
  reconcileAtlasCommit(
    c: AtlasCommand,
    pending = false,
  ): import('../atlas/campaign-atlas-contracts').AtlasCommitOutcome {
    this.guard(c.token, c.campaignId);
    // Main must exclude in-flight async terrain preparation before absence is definitive.
    if (pending) return { outcome: 'unknown' };
    return this.db.transaction(() => {
      if (!hasAtlasReceipt(this.db, c)) return { outcome: 'not-applied' as const };
      const root = atlasRoot(this.db, c.campaignId);
      return {
        outcome: 'applied' as const,
        ack: {
          campaignId: c.campaignId,
          commandId: c.commandId,
          revision: root.revision,
          ...atlasHistoryState(this.db, c.campaignId),
        },
      };
    })();
  }
  atlasRegionSource(
    token: string,
    cursor?: import('../atlas/atlas-region-contracts').AtlasRegionCursor,
  ): AtlasRegionSource {
    const campaignId = this.guard(token),
      preview = this.graphShadow,
      version = this.committedSources.version(this.db),
      shadowVersion = preview ? this.committedSources.version(preview.db) : undefined;
    const changes = atlasReadChanges(this.db, campaignId, cursor);
    const shadowChanges = preview
      ? atlasReadChanges(preview.db, campaignId, cursor?.shadow)
      : undefined;
    const shadow =
      preview && shadowChanges
        ? {
            filename: preview.db.name,
            scopeId: preview.scopeId,
            epoch: shadowChanges.epoch,
            sequence: shadowChanges.sequence,
          }
        : undefined;
    const fingerprint = [
      this.db.name,
      version,
      changes.epoch,
      changes.sequence,
      shadow,
      shadowVersion,
      preview?.state(),
    ];
    const revision = atlasRoot(this.db, campaignId).revision;
    const versions = atlasProjectionSource(this.db, campaignId);
    if (
      this.committedSources.version(this.db) !== version ||
      (preview && this.committedSources.version(preview.db) !== shadowVersion)
    )
      throw new Error('Atlas inzwischen geändert. Ausschnitt erneut laden.');
    return {
      filename: this.db.name,
      campaignId,
      token,
      ...changes,
      shadow,
      reset: changes.reset || !!shadowChanges?.reset,
      changes: [...changes.changes, ...(shadowChanges?.changes ?? [])],
      fence: hash(JSON.stringify(fingerprint)),
      revision,
      ...versions,
    };
  }
  atlasCitySite(
    token: string,
    cityId: string,
    id?: string,
  ): import('../atlas/atlas-region-contracts').AtlasCitySite {
    return storedAtlasCitySite(this.db, { guard: this.guard.bind(this) }, token, cityId, id);
  }
  workspaceInitial(token: string): WorkspaceGeometry {
    if (this.graphShadow && !this.graphRouting)
      return this.withGraph(() => this.workspaceInitial(token));
    const cam = this.guard(token),
      shell = this.workspaceShell();
    let rooms: import('../shared/contracts').RoomGeometry[] = [];
    const problems: WorkspaceGeometry['problems'] = [];
    if (shell.selectedId)
      try {
        const { sections: unused, ...room } = this.atlasRoom(token, shell.selectedId);
        rooms = [room];
      } catch (error) {
        problems.push({ id: shell.selectedId, number: '', message: (error as Error).message });
      }
    return {
      ...shell,
      geometryCoverage: 'selected',
      rooms,
      problems,
      floors: this.db
        .prepare(
          'SELECT id,scope_id scopeId,name,source_elevation sourceElevation FROM drawing_floor WHERE campaign_id=?',
        )
        .all(cam),
    };
  }
  atlasRegionView(
    token: string,
    region: AtlasRegionGeometry,
    withPerception = false,
    entranceId?: string,
  ): AtlasRegionView {
    return storedAtlasRegionView(
      this.db,
      {
        guard: this.guard.bind(this),
        atlasRegionSource: this.atlasRegionSource.bind(this),
        workspaceShell: this.workspaceShell.bind(this),
      },
      token,
      region,
      withPerception,
      entranceId,
    );
  }
  atlasRenderView(token: string): import('../atlas/campaign-atlas-contracts').AtlasRenderView {
    const cam = this.guard(token);
    return this.db.transaction(() => {
      const root = atlasRoot(this.db, cam),
        workspace = this.workspaceGeometry(token),
        drawing = this.graphShadow
          ? this.withGraph(() => drawingView(this.db, cam, true))
          : undefined,
        geometry = dungeonMapView(this.db, cam, workspace, drawing);
      geometry.rooms = workspace.rooms;
      const perception =
        geometry.position && geometry.sceneId
          ? dungeonDisplay(
              this.db,
              cam,
              geometry.sceneId,
              playerSettings(this.db, cam),
              playerObservers(this.db, cam).list,
              geometry,
            )
          : null;
      return {
        scopes: this.db.prepare('SELECT id,name FROM scope WHERE campaign_id=?').all(cam),
        perception,
        entrances: atlasEntrances(this.db, cam),
        localJourney: geometry.sceneId ? atlasLocalJourney(this.db, cam, geometry.sceneId) : null,
        campaignId: cam,
        revision: root.revision,
        terrain: JSON.parse(
          this.db
            .prepare("SELECT payload FROM world_record WHERE campaign_id=? AND kind='map' AND id=?")
            .get(cam, root.map_id).payload,
        ),
        bindings: atlasBindings(this.db, cam),
        cities: this.cities(token).cities.map((h) => this.city(token, h.id)),
        geometry,
        workspace,
        scene: geometry.sceneId ? this.sceneWorld(token, geometry.sceneId) : null,
        ...atlasHistoryState(this.db, cam),
      };
    })();
  }
  campaignAtlas(token: string): CampaignAtlas {
    return storedCampaignAtlas(
      this.db,
      {
        guard: this.guard.bind(this),
        dungeon: this.dungeon.bind(this),
        sceneWorld: this.sceneWorld.bind(this),
        cities: this.cities.bind(this),
        city: this.city.bind(this),
        workspace: this.workspace.bind(this),
      },
      token,
    );
  }
  atlasTerritories(token: string, box?: import('../atlas/atlas-landscape').LandscapeBox) {
    return readTerritories(this.db, this.guard(token), box);
  }
  executeAtlas(c: AtlasCommand) {
    const result = this.applyAtlas(c);
    return { atlas: this.campaignAtlas(c.token), result };
  }
  private applyAtlas(c: AtlasCommand, prepared?: import('./terrain-scale').PreparedTerrainStroke) {
    return applyAtlasCommand(
      this.db,
      {
        guard: this.guard.bind(this),
        atlasRegionSource: this.atlasRegionSource.bind(this),
        terrainAuthorCache: this.terrainAuthorCache,
        commitPreparation: this.commitPreparation.bind(this),
        executeWorld: this.executeWorld.bind(this),
        addRoom: this.addRoom.bind(this),
        insertRoom: this.insertRoom.bind(this),
        executeGraph: this.executeGraph.bind(this),
        workspace: this.workspace.bind(this),
        drawing: this.drawing.bind(this),
        executeDrawing: this.executeDrawing.bind(this),
        coupleAtlasWall: this.coupleAtlasWall.bind(this),
        atlasRoom: this.atlasRoom.bind(this),
        edit: this.edit.bind(this),
        city: this.city.bind(this),
        executeCity: this.executeCity.bind(this),
        campaignAtlas: this.campaignAtlas.bind(this),
        reconcileAtlasGeometry: this.reconcileAtlasGeometry.bind(this),
      },
      c,
      prepared,
    );
  }
  extensionPreview(bytes: Buffer) {
    return this.extensionRegistry.preview(bytes);
  }
  extensions(after: string | null) {
    return this.extensionRegistry.list(after);
  }
  executeExtension(command: ExtensionCommand) {
    return this.extensionRegistry.execute(command);
  }
  extensionOutcome(command: ExtensionCommand) {
    return this.extensionRegistry.outcome(command);
  }
  close() {
    this.chronicleRead?.close();
    this.chronicleRead = null;
    this.extensionRegistry.dispose();
    this.committedSources.close();
    this.graphShadow?.dispose();
    this.graphShadow = null;
    this.db.close();
  }
  list(): { campaigns: Campaign[]; activeId: string | null } {
    return {
      campaigns: this.db
        .prepare(
          'SELECT c.id,c.name,c.revision FROM campaign c JOIN campaign_lifecycle l ON l.campaign_id=c.id WHERE l.trashed=0 ORDER BY c.name,c.id',
        )
        .all(),
      activeId:
        this.db.prepare("SELECT value FROM settings WHERE key='active'").get()?.value ?? null,
    };
  }
  create(name: string, rooms: Room[] = [], source?: Buffer): Campaign {
    return storedCreate(this.db, { insertRoom: this.insertRoom.bind(this) }, name, rooms, source);
  }
  private insertRoom(campaignId: string, room: Room) {
    const payload = json({ polygons: room.polygons, sections: room.sections });
    this.db
      .prepare('INSERT INTO room VALUES(?,?,?,?,?,?,?,?,?)')
      .run(
        campaignId,
        room.id,
        room.scopeId,
        room.number,
        room.name,
        0,
        payload,
        hash(payload),
        room.floorId,
      );
  }
  activate(campaignId: string): Workspace {
    this.activateShell(campaignId);
    return this.workspace();
  }
  activateShell(campaignId: string): WorkspaceShell {
    this.chronicleRead?.close();
    this.chronicleRead = null;
    if (this.graphShadow && this.graphShadow.campaignId !== campaignId)
      throw new Error('Offene Graphvorschau zuerst übernehmen oder Ursprung wiederherstellen.');
    if (
      !this.db
        .prepare(
          'SELECT c.id FROM campaign c JOIN campaign_lifecycle l ON l.campaign_id=c.id WHERE c.id=? AND l.trashed=0',
        )
        .get(campaignId)
    )
      throw new Error('Kampagne nicht gefunden.');
    this.active = { campaignId, token: randomUUID() };
    this.db
      .transaction(() => {
        this.db
          .prepare(
            "INSERT INTO settings VALUES('active',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
          )
          .run(campaignId);
        noteCampaignOpened(this.db, campaignId);
      })
      .immediate();
    return this.workspaceShell();
  }
  private guard(token: string, campaignId = this.active?.campaignId) {
    if (!this.active || token !== this.active.token || campaignId !== this.active.campaignId)
      throw new Error('Diese Eingabe gehört zu einer früheren Kampagnenaktivierung.');
    if (
      !this.db
        .prepare('SELECT campaign_id FROM campaign_lifecycle WHERE campaign_id=? AND trashed=0')
        .get(this.active.campaignId)
    )
      throw new Error('Kampagne befindet sich im Papierkorb.');
    return this.active.campaignId;
  }

  preparationDraft(
    token: string,
    kind: PreparationEdit['kind'],
    id: string,
  ): PreparationDraft | null {
    const campaignId = this.guard(token);
    preparationDraftTable(kind);
    const row = this.db
      .prepare('SELECT * FROM preparation_draft WHERE campaign_id=? AND kind=? AND target_id=?')
      .get(campaignId, kind, id);
    return row ? decodePreparationDraft(row) : null;
  }
  keepPreparationDrafts(token: string, drafts: PreparationDraft[]) {
    return storedKeepPreparationDrafts(this.db, { guard: this.guard.bind(this) }, token, drafts);
  }
  discardPreparationDraft(
    token: string,
    kind: PreparationEdit['kind'],
    id: string,
    writeId: string,
  ) {
    this.db
      .transaction(() => {
        const campaignId = this.guard(token);
        preparationDraftTable(kind);
        const row = this.db
          .prepare('SELECT * FROM preparation_draft WHERE campaign_id=? AND kind=? AND target_id=?')
          .get(campaignId, kind, id);
        if (!row) return;
        if (typeof writeId !== 'string' || decodePreparationDraft(row).writeId !== writeId)
          throw new Error('Der Entwurf wurde inzwischen geändert.');
        this.db
          .prepare('DELETE FROM preparation_draft WHERE campaign_id=? AND kind=? AND target_id=?')
          .run(campaignId, kind, id);
      })
      .immediate();
  }
  workspaceShell(): WorkspaceShell {
    if (this.graphShadow && !this.graphRouting) return this.withGraph(() => this.workspaceShell());
    if (!this.active) throw new Error('Bitte eine Kampagne öffnen.');
    const { campaignId, token } = this.active;
    this.guard(token);
    return this.db.transaction(() => {
      const campaign = this.db.prepare('SELECT * FROM campaign WHERE id=?').get(campaignId);
      const valid = this.db
        .prepare(`SELECT r.id FROM room r WHERE ${visibleRoomWhere} AND r.id=?`)
        .get(campaignId, campaign.selected_id);
      let first = valid;
      if (!first) {
        // This internal cache also runs inside write transactions and must see uncommitted edits.
        const stamp = JSON.stringify([
            this.db.prepare('SELECT total_changes() n').get().n,
            this.db.pragma('data_version', { simple: true }),
          ]),
          cached = this.shellFirstRoom.get(this.db);
        if (cached?.campaignId === campaignId && cached.stamp === stamp)
          first = cached.id ? { id: cached.id } : null;
        else {
          for (const row of this.db
            .prepare(`SELECT r.id,r.number FROM room r WHERE ${visibleRoomWhere}`)
            .iterate(campaignId))
            if (!first || roomOrder(row, first) < 0) first = row;
          this.shellFirstRoom.set(this.db, { campaignId, stamp, id: first?.id ?? null });
        }
      }
      return {
        graphPreview: this.graphShadow?.state(),
        campaign: { id: campaign.id, name: campaign.name, revision: campaign.revision },
        token,
        selectedId: first?.id ?? null,
        canUndo: !!this.db
          .prepare('SELECT 1 FROM history WHERE campaign_id=? AND ordinal=?')
          .get(campaignId, campaign.cursor),
        canRedo: !!this.db
          .prepare('SELECT 1 FROM history WHERE campaign_id=? AND ordinal=?')
          .get(campaignId, campaign.cursor + 1),
      };
    })();
  }
  workspaceGeometry(token: string): WorkspaceGeometry {
    if (this.graphShadow && !this.graphRouting)
      return this.withGraph(() => this.workspaceGeometry(token));
    const cam = this.guard(token);
    return this.db.transaction(() => ({
      ...this.workspaceShell(),
      ...roomGeometries(this.db, cam),
      floors: this.db
        .prepare(
          `SELECT f.id,f.scope_id scopeId,f.name,f.source_elevation sourceElevation FROM drawing_floor f WHERE f.campaign_id=? AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=f.campaign_id AND h.id=f.id AND h.scope_id=f.scope_id AND h.kind='floor' AND h.hidden=1) ORDER BY source_elevation,id`,
        )
        .all(cam),
    }))();
  }
  roomReadSource(
    token: string,
    q?: RoomDirectoryQuery,
  ): { filename: string; campaignId: string; token: string; fence: string } {
    if (this.graphShadow && !this.graphRouting)
      return this.withGraph(() => this.roomReadSource(token, q));
    const campaignId = this.guard(token),
      filename = this.db.name;
    const fence = hash(
      JSON.stringify([
        filename,
        this.committedSources.version(this.db),
        this.graphShadow?.state() ?? null,
      ]),
    );
    if (q) {
      roomDirectoryQuery(q);
      if (q.cursor && (q.cursor.token !== token || q.cursor.fence !== fence))
        throw new Error('Raumsuche inzwischen geändert. Suche erneut beginnen.');
    }
    return { filename, campaignId, token, fence };
  }
  workspace(): Workspace {
    if (this.graphShadow && !this.graphRouting) return this.withGraph(() => this.workspace());
    if (!this.active) throw new Error('Bitte eine Kampagne öffnen.');
    return this.db.transaction(() => {
      const active = this.active!;
      const campaign = this.db.prepare('SELECT * FROM campaign WHERE id=?').get(active.campaignId);
      const rooms: Room[] = [],
        problems: Workspace['problems'] = [];
      for (const row of this.db
        .prepare(
          `SELECT r.* FROM room r WHERE r.campaign_id=? AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=r.campaign_id AND h.id=r.id AND h.kind='room' AND h.hidden=1) AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=r.campaign_id AND h.id=r.floor_id AND h.scope_id=r.scope_id AND h.kind='floor' AND h.hidden=1) ORDER BY number,id`,
        )
        .all(active.campaignId)) {
        try {
          rooms.push(decodeRoom(row));
        } catch (error) {
          problems.push({ id: row.id, number: row.number, message: (error as Error).message });
        }
      }
      rooms.sort((a, b) => roomNumberOrder.compare(a.number, b.number) || a.id.localeCompare(b.id));
      const floors = this.db
        .prepare(
          `SELECT f.id,f.scope_id AS scopeId,f.name,f.source_elevation AS sourceElevation FROM drawing_floor f WHERE f.campaign_id=? AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=f.campaign_id AND h.id=f.id AND h.scope_id=f.scope_id AND h.kind='floor' AND h.hidden=1) ORDER BY source_elevation,id`,
        )
        .all(active.campaignId);
      return {
        graphPreview: this.graphShadow?.state(),
        campaign: { id: campaign.id, name: campaign.name, revision: campaign.revision },
        token: active.token,
        rooms,
        problems,
        floors,
        selectedId: rooms.some((r) => r.id === campaign.selected_id)
          ? campaign.selected_id
          : (rooms[0]?.id ?? null),
        canUndo: !!this.db
          .prepare('SELECT 1 FROM history WHERE campaign_id=? AND ordinal=?')
          .get(campaign.id, campaign.cursor),
        canRedo: !!this.db
          .prepare('SELECT 1 FROM history WHERE campaign_id=? AND ordinal=?')
          .get(campaign.id, campaign.cursor + 1),
      };
    })();
  }
  select(token: string, id: string) {
    if (this.graphShadow && !this.graphRouting)
      return this.withGraph<void>(() => this.select(token, id));
    const campaignId = this.guard(token);
    if (!this.db.prepare('SELECT 1 FROM room WHERE campaign_id=? AND id=?').get(campaignId, id))
      throw new Error('Raum nicht gefunden.');
    this.db.prepare('UPDATE campaign SET selected_id=? WHERE id=?').run(id, campaignId);
  }
  addRoom(token: string, atlasInternal = false): Workspace {
    if (!atlasInternal) {
      const cam = this.guard(token);
      return this.executeAtlas({
        commandId: randomUUID(),
        token,
        campaignId: cam,
        action: { kind: 'room-default' },
      }).atlas.workspace;
    }
    if (this.graphShadow && !this.graphRouting) return this.withGraph(() => this.addRoom(token));
    return storedAddRoom(
      this.db,
      {
        guard: this.guard.bind(this),
        workspace: this.workspace.bind(this),
        insertRoom: this.insertRoom.bind(this),
        executeDrawing: this.executeDrawing.bind(this),
      },
      token,
    );
  }
  edit(edit: Edit): RoomCommit {
    if (this.graphShadow && !this.graphRouting) return this.withGraph(() => this.edit(edit));
    return storedEdit(
      this.db,
      { guard: this.guard.bind(this), writeRoom: this.writeRoom.bind(this) },
      edit,
    );
  }
  private writeRoom(campaignId: string, room: Room) {
    const payload = json({ polygons: room.polygons, sections: room.sections });
    this.db
      .prepare(
        'UPDATE room SET name=?,revision=?,payload=?,checksum=? WHERE campaign_id=? AND id=?',
      )
      .run(room.name, room.revision, payload, hash(payload), campaignId, room.id);
  }
  history(token: string, direction: 'undo' | 'redo'): Workspace {
    if (this.graphShadow && !this.graphRouting)
      return this.withGraph(() => this.history(token, direction));
    return storedHistory(
      this.db,
      {
        guard: this.guard.bind(this),
        writeRoom: this.writeRoom.bind(this),
        workspace: this.workspace.bind(this),
      },
      token,
      direction,
    );
  }
  async backup(filename: string, validateCandidate?: (filename: string) => Promise<void>) {
    const epoch = this.backupEpoch,
      candidate = filename + '.candidate-' + randomUUID();
    try {
      await this.db.backup(candidate);
      if (validateCandidate) await validateCandidate(candidate);
      else validateBackupCandidate(candidate);
      const fd = openSync(candidate, 'r');
      try {
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      if (epoch !== this.backupEpoch)
        throw new Error('Wiederherstellungskopie durch Löschung überholt.');
      renameSync(candidate, filename);
      const directory = openSync(dirname(filename), 'r');
      try {
        fsyncSync(directory);
      } finally {
        closeSync(directory);
      }
    } catch (error) {
      rmSync(candidate, { force: true });
      throw error;
    } finally {
      // Read-only validation of a WAL-mode copy can create these sidecars too.
      // The unique candidate is closed and never shared with another connection.
      for (const suffix of ['-wal', '-shm']) rmSync(candidate + suffix, { force: true });
    }
  }
  reconcile(
    edit: Edit,
    token = edit.token,
  ): {
    outcome: 'applied' | 'not-applied' | 'conflict';
    targetChanged: boolean;
    workspace: Workspace;
  } {
    if (this.graphShadow && !this.graphRouting)
      return this.withGraph(() => this.reconcile(edit, token));
    return storedReconcile(
      this.db,
      { guard: this.guard.bind(this), workspace: this.workspace.bind(this) },
      edit,
      token,
    );
  }
  captureKeyNote(c: KeyNoteCaptureCommand) {
    return captureKeyNote(
      this.db,
      c,
      () => {
        this.guard(c.token, c.campaignId);
      },
      (note, expectedRevision) =>
        this.commitPreparation({
          commandId: c.commandId + '|note',
          campaignId: c.campaignId,
          token: c.token,
          change: { kind: 'note', expectedRevision, note },
        }),
    );
  }
  noteThread(token: string, id: string, offset = 0, active = true, history = false) {
    return readNoteThread(this.db, this.guard(token), id, offset, active, history);
  }
  checkNoteThread(
    token: string,
    selection: import('../campaign/note-thread-contracts').NoteThreadSelection,
  ) {
    return checkNoteThread(this.db, this.guard(token), selection);
  }
  keyNoteChoices(token: string, query: string) {
    const cam = this.guard(token);
    return this.db.transaction(() => readKeyNoteChoices(this.db, cam, query))();
  }
  keyNoteCaptureStatus(c: KeyNoteCaptureCommand, token = c.token) {
    return keyNoteCaptureStatus(this.db, c, () => {
      this.guard(token, c.campaignId);
    });
  }
  noteRoomUses(
    token: string,
    id: string,
    offset = 0,
  ): import('../campaign/preparation-contracts').NoteRoomUsesPage {
    if (typeof id !== 'string' || !id || id.length > 1000) throw new Error('Ungültiges Notizziel.');
    const cam = this.guard(token);
    return this.db.transaction(() => {
      const row = this.db
        .prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?')
        .get(cam, id);
      if (!row) throw new Error('Notiz nicht verfügbar.');
      const note = checkedWorldNoteRow(row);
      return readNoteRoomUses(this.db, cam, note, offset);
    })();
  }
  noteMergePreview(token: string, sourceId: string, targetId: string) {
    const cam = this.guard(token);
    return this.db.transaction(() => {
      const preview = noteMergeWork(this.db, cam, sourceId, targetId).preview;
      if (this.graphShadow) preview.blockers.push('Die offene Dungeonvorschau zuerst abschließen.');
      return preview;
    })();
  }
  preparation(token: string, search = ''): Preparation {
    return storedPreparation(
      this.db,
      { guard: this.guard.bind(this), readPlan: this.readPlan.bind(this) },
      token,
      search,
    );
  }
  locationActivities(
    token: string,
    q: import('../campaign/location-activity-contracts').LocationActivityQuery,
  ): import('../campaign/location-activity-contracts').LocationActivityPage {
    const cam = this.guard(token);
    return this.db.transaction(() => readLocationActivities(this.db, cam, q))();
  }
  locationMaterials(
    token: string,
    q: import('../campaign/location-notebook-contracts').LocationMaterialsQuery,
  ) {
    const cam = this.guard(token);
    return this.db.transaction(() => readLocationMaterials(this.db, cam, q))();
  }
  worldLinks(
    token: string,
    q: import('../campaign/world-links-contracts').WorldLinksQuery,
  ): import('../campaign/world-links-contracts').WorldLinksPage {
    const cam = this.guard(token);
    return this.db.transaction(() => readWorldLinks(this.db, cam, q))();
  }
  npcCast(
    token: string,
    q: import('../campaign/npc-cast-contracts').NpcCastQuery,
  ): import('../campaign/npc-cast-contracts').NpcCastPage {
    const cam = this.guard(token);
    return this.db.transaction(() => readNpcCast(this.db, cam, q))();
  }
  npcBuildingChoices(
    token: string,
    id: string,
    q: import('../campaign/npc-places-contracts').NpcBuildingQuery,
  ): import('../campaign/npc-places-contracts').NpcBuildingChoices {
    const cam = this.guard(token);
    return this.db.transaction(() => readNpcBuildingChoices(this.db, cam, id, q))();
  }
  npcPlaces(
    token: string,
    id: string,
    offset: number,
  ): import('../campaign/npc-places-contracts').NpcPlaces {
    const cam = this.guard(token);
    return this.db.transaction(() => readNpcPlaces(this.db, cam, id, offset))();
  }
  npcPlanCalendar(token: string) {
    return readNpcPlanCalendar(this.db, this.guard(token));
  }
  npcDossier(
    token: string,
    sceneId: string,
    id: string,
  ): import('../campaign/npc-cast-contracts').NpcDossier {
    const cam = this.guard(token);
    return this.db.transaction(() => readNpcDossier(this.db, cam, sceneId, id))();
  }
  npcDrafts(token: string) {
    return npcDrafts(this.db, this.guard(token));
  }
  npcDraft(token: string, id: string) {
    return npcDraft(this.db, this.guard(token), id);
  }
  keepNpcDraft(token: string, d: NpcDraft, expected: string | null) {
    return keepNpcDraft(this.db, this.guard(token), d, expected);
  }
  discardNpcDraft(token: string, id: string, writeId: string) {
    return discardNpcDraft(this.db, this.guard(token), id, writeId);
  }
  npcs(token: string, q: NpcQuery) {
    return readNpcs(this.db, this.guard(token), q);
  }
  npc(token: string, id: string) {
    return readNpc(this.db, this.guard(token), id);
  }
  reconcileNpc(c: NpcCommand, token: string) {
    return reconcileNpc(this.db, c, () => {
      this.guard(token, c.campaignId);
    });
  }
  executeNpc(c: NpcCommand) {
    return executeNpc(this.db, c, () => {
      this.guard(c.token, c.campaignId);
    });
  }
  generationSources(token: string) {
    return readWorldSources(this.db, this.guard(token));
  }
  sceneVisits(token: string, sceneId: string, after: string | null) {
    return readSceneVisits(this.db, this.guard(token), sceneId, after);
  }
  sessionProgress(token: string, planId: string, sceneId?: string) {
    return readSessionProgress(this.db, this.guard(token), planId, sceneId);
  }
  sessionPacket(token: string, planId: string) {
    return readSessionPacket(this.db, this.guard(token), planId);
  }
  session(token: string, planId: string) {
    return readSession(this.db, this.guard(token), planId);
  }
  executeSession(command: SessionCommand) {
    return executeSession(
      this.db,
      command,
      () => {
        this.guard(command.token, command.campaignId);
      },
      (plan, expectedRevision) => {
        this.commitPreparation({
          commandId: command.commandId + '|timeline',
          campaignId: command.campaignId,
          token: command.token,
          change: { kind: 'plan', plan, expectedRevision },
        });
      },
    );
  }
  generateSession(token: string, request: SessionGenerationRequest) {
    return generateSession(this.db, this.guard(token), request);
  }
  regenerateSessionReward(token: string, runId: string, index: number, seed: string) {
    return regenerateSessionReward(this.db, this.guard(token), runId, index, seed);
  }
  regenerateSessionProposal(token: string, runId: string, index: number, seed: string) {
    return regenerateSessionProposal(this.db, this.guard(token), runId, index, seed);
  }
  sessionRuns(token: string, planId: string) {
    return readSessionRuns(this.db, this.guard(token), planId);
  }
  sessionRun(token: string, id: string) {
    return readSessionRun(this.db, this.guard(token), id);
  }
  sceneEncounterSelection(token: string, sceneId: string) {
    return readSceneEncounterSelection(this.db, this.guard(token), sceneId);
  }
  scenePreparation(token: string, sceneId: string) {
    return scenePreparation(this.db, this.guard(token), sceneId);
  }
  sceneRules(token: string, sceneId: string) {
    return readSceneRules(this.db, this.guard(token), sceneId);
  }
  executeSceneRule(command: SceneRuleCommand) {
    return executeSceneRule(this.db, command, () => this.guard(command.token, command.campaignId));
  }
  sceneChecks(token: string, sceneId: string) {
    return readSceneChecks(this.db, this.guard(token), sceneId);
  }
  executeSceneCheck(command: SceneCheckCommand) {
    return executeSceneCheck(this.db, command, () => this.guard(command.token, command.campaignId));
  }
  encounterTables(token: string, includeTrashed: boolean) {
    return readEncounterTables(this.db, this.guard(token), includeTrashed);
  }
  lootTables(token: string, includeTrashed: boolean) {
    return readLootTables(this.db, this.guard(token), includeTrashed);
  }
  presetRegistry(campaignId: string | null) {
    return readPresetRegistry(this.db, campaignId);
  }
  presetCommand(command: import('../campaign/generation-contracts').PresetCommand) {
    return executePresetCommand(this.db, command);
  }
  presetOutcome(command: import('../campaign/generation-contracts').PresetCommand) {
    return readPresetOutcome(this.db, command);
  }
  generatorRegistry(token: string) {
    return readGeneratorRegistry(this.db, this.guard(token));
  }
  executeGeneration(command: GenerationCommand) {
    return executeGeneration(this.db, command, () => {
      this.guard(command.token, command.campaignId);
    });
  }
  generateEncounters(token: string, request: GenerationRequest) {
    return generateEncounters(this.db, this.guard(token), request);
  }
  acceptGeneration(command: Parameters<typeof acceptGeneration>[1]) {
    return acceptGeneration(this.db, command, () => {
      this.guard(command.token, command.campaignId);
    });
  }
  generationRuns(token: string) {
    return readGenerationRuns(this.db, this.guard(token));
  }
  generationRun(token: string, id: string) {
    return readGenerationRun(this.db, this.guard(token), id);
  }
  rollLoot(command: LootRollCommand) {
    return rollLoot(this.db, command, () => {
      this.guard(command.token, command.campaignId);
    });
  }
  encounterPlans(token: string, search: string, limit?: number) {
    return readEncounterPlans(this.db, this.guard(token), search, limit);
  }
  encounterPlan(token: string, id: string) {
    return readEncounterPlan(this.db, this.guard(token), id);
  }
  saveEncounterPlan(command: EncounterPlanCommand) {
    return saveEncounterPlan(this.db, command, () => {
      this.guard(command.token, command.campaignId);
    });
  }
  progressHistory(token: string, characterId: string, after: string | null) {
    return readProgressHistory(this.db, this.guard(token), characterId, after);
  }
  keepChaseDraft(
    token: string,
    draft: import('../runtime/chase-draft-contracts').ChaseWorkingDraft,
    expected: string | null,
  ) {
    return keepChaseDraft(this.db, this.guard(token), draft, expected);
  }
  maskHistory(
    token: string,
    sceneId: string,
    query: import('../runtime/mask-history-contracts').MaskHistoryQuery,
  ) {
    return readMaskHistory(this.db, this.guard(token), sceneId, query);
  }
  chase(token: string, sceneId: string, id?: string) {
    return readChase(this.db, this.guard(token), sceneId, id);
  }
  executeChase(c: ChaseCommand) {
    return executeChase(
      this.db,
      c,
      () => this.guard(c.token, c.campaignId),
      (chase) => {
        // The Chase transaction owns both the round and the existing Scene-time writer.
        // Receipt replay returns before this port; downstream World faults roll back both.
        const scene = readLiveScene(this.db, c.campaignId, chase.sceneId);
        this.executeLive({
          commandId: c.commandId + ':clock',
          token: c.token,
          campaignId: c.campaignId,
          action: {
            kind: 'advance-clock',
            sceneId: scene.id,
            expectedRevision: scene.clock.revision,
            amount: 6,
            unit: 'seconds',
            calendarVersion: 'relative-v1',
            reason: 'Verfolgung · ' + chase.title + ' · Runde ' + chase.round,
          },
        });
      },
    );
  }
  chroniclePage(
    token: string,
    category: import('../runtime/chronicle-contracts').ChronicleCategory | 'all',
    search: string,
    cursor: import('../runtime/chronicle-contracts').ChronicleCursor | null,
  ) {
    const cam = this.guard(token);
    if (!cursor) {
      this.chronicleRead?.close();
      this.chronicleRead = new ChronicleReadSession(this.filename, cam);
    }
    if (
      !this.chronicleRead ||
      this.chronicleRead.campaignId !== cam ||
      (cursor && cursor.snapshotId !== this.chronicleRead.id)
    )
      throw new Error('Chronik-Lesestand nicht mehr verfügbar. Aktualisieren.');
    return this.chronicleRead.read(category, search, cursor);
  }
  closeChroniclePage(token: string, id: string) {
    this.guard(token);
    if (this.chronicleRead?.id === id) {
      this.chronicleRead.close();
      this.chronicleRead = null;
    }
  }
  chronicleExportSnapshot(token: string) {
    return new ChronicleReadSession(this.filename, this.guard(token));
  }
  chronicle(
    token: string,
    category: import('../runtime/chronicle-contracts').ChronicleCategory | 'all' = 'all',
    search = '',
  ) {
    return readChronicle(this.db, this.guard(token), category, search);
  }
  progress(token: string) {
    return readProgress(this.db, this.guard(token));
  }
  lootBalance(token: string) {
    return readLootBalance(this.db, this.guard(token));
  }
  treasures(
    token: string,
    after: string | null,
    query?: import('../runtime/treasury-contracts').TreasureQuery,
  ) {
    return readTreasures(this.db, this.guard(token), after, query);
  }
  treasure(token: string, id: string) {
    return readTreasure(this.db, this.guard(token), id);
  }
  ledger(token: string, query: LedgerQuery) {
    return readLedger(this.db, this.guard(token), query);
  }
  ledgerInventory(token: string, query: LedgerInventoryQuery) {
    return readLedgerInventory(this.db, this.guard(token), query);
  }
  ledgerItem(token: string, id: string) {
    return readLedgerDetail(this.db, this.guard(token), id);
  }
  commitStatus(ref: CommitReference, token: string): CommitOutcome {
    checkedCommitReference(ref);
    this.guard(token, ref.campaignId);
    return readCommitReceipt(this.db, ref);
  }
  ledgerParties(token: string) {
    const cam = this.guard(token),
      rows: any[] = [];
    for (const kind of ['npc', 'faction'])
      rows.push(
        ...this.db
          .prepare(
            "SELECT id,json_extract(payload,'$.title') name FROM world_note WHERE campaign_id=? AND trashed=0 AND json_extract(payload,'$.kind')=? ORDER BY name LIMIT 2000",
          )
          .all(cam, kind)
          .map((r: any) => ({ ...r, kind })),
      );
    rows.push(
      ...this.db
        .prepare(
          "SELECT id,json_extract(payload,'$.name') name FROM location WHERE campaign_id=? AND trashed=0 ORDER BY name LIMIT 2000",
        )
        .all(cam)
        .map((r: any) => ({ ...r, kind: 'location' })),
    );
    rows.push(
      ...this.db
        .prepare(
          "SELECT id,json_extract(payload,'$.name') name FROM shop WHERE campaign_id=? AND coalesce(json_extract(payload,'$.trashed'),0)=0 ORDER BY name LIMIT 2000",
        )
        .all(cam)
        .map((r: any) => ({ ...r, kind: 'shop' })),
    );
    return rows;
  }
  preparedGroups(token: string, search: string, after: string | null) {
    return preparedGroups(this.db, this.guard(token), search, after);
  }
  groupView(token: string, id: string) {
    return groupView(this.db, this.guard(token), id);
  }
  groupDraft(token: string, id: string) {
    return groupDraft(this.db, this.guard(token), id);
  }
  keepGroupDraft(
    token: string,
    draft: import('../campaign/groups-contracts').GroupDraft,
    expected: string | null,
  ) {
    return keepGroupDraft(this.db, this.guard(token), draft, expected);
  }
  discardGroupDraft(token: string, id: string, writeId: string) {
    return discardGroupDraft(this.db, this.guard(token), id, writeId);
  }
  treasuryDraft(token: string, id: string) {
    return readTreasuryDraft(this.db, this.guard(token), id);
  }
  keepTreasuryDraft(
    token: string,
    draft: import('../runtime/treasury-contracts').TreasuryDraft,
    expected: string | null,
  ) {
    return keepTreasuryDraft(this.db, this.guard(token), draft, expected);
  }
  discardTreasuryDraft(token: string, id: string, writeId: string) {
    return discardTreasuryDraft(this.db, this.guard(token), id, writeId);
  }
  treasureHistory(token: string, id: string, after: string | null) {
    return treasureHistory(this.db, this.guard(token), id, after);
  }
  sceneDesk(token: string, id: string) {
    return readSceneDesk(this.db, this.guard(token), id);
  }
  searchDesk(token: string, kind: string, search: string, offset: number) {
    return searchDesk(this.db, this.guard(token), kind, search, offset);
  }
  deskContent(token: string, ref: import('../runtime/scene-desk-contracts').DeskRef) {
    return deskContent(this.db, this.guard(token), ref);
  }
  pinSceneDesk(
    token: string,
    id: string,
    revision: number,
    ref: import('../runtime/scene-desk-contracts').DeskRef,
    pin: boolean,
  ) {
    return pinSceneDesk(this.db, this.guard(token), id, revision, ref, pin);
  }
  sceneCreationDraft(token: string, sceneId: string) {
    return readSceneCreationDraft(this.db, this.guard(token), sceneId);
  }
  keepSceneCreationDraft(
    token: string,
    sceneId: string,
    draft: import('../runtime/scene-desk-contracts').SceneCreationDraft | null,
    expected: string | null,
  ) {
    return keepSceneCreationDraft(this.db, this.guard(token), sceneId, draft, expected);
  }
  keepDeskDraft(token: string, draft: PreparationDraft, expected: string | null) {
    return this.db
      .transaction(() => {
        const target = preparationTarget(draft.change),
          old = this.preparationDraft(token, target.kind, target.id);
        if ((old?.writeId ?? null) !== expected)
          throw new Error('Notizeingabe inzwischen an anderer Stelle geändert.');
        this.keepPreparationDrafts(token, [draft]);
      })
      .immediate();
  }
  finishDraft(token: string, owner: import('../runtime/finish-draft-contracts').FinishOwner) {
    return readFinishDraft(this.db, this.guard(token), owner);
  }
  keepFinishDraft(
    token: string,
    draft: import('../runtime/finish-draft-contracts').FinishDraft,
    expected: string | null,
  ) {
    return keepFinishDraft(this.db, this.guard(token), draft, expected);
  }
  discardFinishDraft(
    token: string,
    owner: import('../runtime/finish-draft-contracts').FinishOwner,
    writeId: string,
  ) {
    return discardFinishDraft(this.db, this.guard(token), owner, writeId);
  }
  keepNarrativeDraft(
    token: string,
    draft: import('../runtime/narrative-contracts').NarrativeDraft,
    expected: string | null,
  ) {
    return keepNarrativeDraft(this.db, this.guard(token), draft, expected);
  }
  discardNarrativeDraft(token: string, id: string, writeId: string) {
    return discardNarrativeDraft(this.db, this.guard(token), id, writeId);
  }
  narrativeJournal(
    token: string,
    query: import('../runtime/narrative-journal-contracts').NarrativeJournalQuery,
  ) {
    return readNarrativeJournal(this.db, this.guard(token), query);
  }
  narrative(token: string, id: string) {
    return this.db.transaction(() => readNarrative(this.db, this.guard(token), id))();
  }
  adventuringDay(
    token: string,
    request: import('../runtime/adventuring-day-contracts').DayRequest,
  ): import('../runtime/adventuring-day-contracts').DayView {
    return this.db.transaction(() => readDay(this.db, this.guard(token), request))();
  }
  executeProgress(command: ProgressCommand) {
    return storedExecuteProgress(
      this.db,
      { guard: this.guard.bind(this), executeLive: this.executeLive.bind(this) },
      command,
    );
  }
  preparedGroup(token: string, id: string) {
    return readPreparedGroup(this.db, this.guard(token), id);
  }
  drawingMap(
    token: string,
    roomId?: string,
    elementId?: string,
  ): import('../atlas/drawing-contracts').DrawingMapView {
    if (this.graphShadow && !this.graphRouting)
      return this.withGraph(() => this.drawingMap(token, roomId, elementId));
    const cam = this.guard(token);
    if (roomId === undefined) return drawingView(this.db, cam, true);
    const checked = (r: any) => {
      if (hash(r.payload) !== r.checksum) throw new Error('Zeichnungsdaten beschädigt.');
      return JSON.parse(r.payload);
    };
    const style = roomMapStyle(this.db, cam, roomId),
      styles = style ? [style] : [];
    const volume = roomId ? readDungeonVolume(this.db, cam, roomId) : undefined,
      volumes = volume ? [volume] : [];
    const features = elementId
      ? this.db
          .prepare(
            'SELECT payload,checksum FROM dungeon_feature_state WHERE campaign_id=? AND id=?',
          )
          .all(cam, elementId)
          .map(checked)
      : [];
    return {
      coverage: 'selected',
      elements: [],
      styles,
      volumes,
      hiddenRooms: [],
      hiddenFloors: [],
      features,
    };
  }
  drawingElement(token: string, id: string): import('../atlas/drawing-contracts').DrawingElement {
    if (this.graphShadow && !this.graphRouting)
      return this.withGraph(() => this.drawingElement(token, id));
    return drawingElement(this.db, this.guard(token), id);
  }
  /** Authoring needs canonical geometry/content, never live travel or perception. */
  dungeonAuthoring(token: string): import('../atlas/dungeon-contracts').DungeonGeometry {
    if (this.graphShadow && !this.graphRouting)
      return this.withGraph(() => this.dungeonAuthoring(token));
    const cam = this.guard(token);
    return this.db.transaction(() => {
      const geometry = dungeonGeometry(this.db, cam),
        preserved = new Map(geometry.drawing.hiddenRooms.map((r) => [r.id, r]));
      // Archiving a floor hides its map, not the authored room contents.
      for (const row of this.db
        .prepare(
          "SELECT r.id FROM room r JOIN drawing_hidden h ON h.campaign_id=r.campaign_id AND h.scope_id=r.scope_id AND h.id=r.floor_id AND h.kind='floor' AND h.hidden=1 WHERE r.campaign_id=?",
        )
        .iterate(cam))
        if (!preserved.has(row.id)) preserved.set(row.id, drawingRoom(this.db, cam, row.id));
      geometry.drawing.hiddenRooms = [...preserved.values()];
      if (this.graphShadow) geometry.drawing.graphPreview = this.graphShadow.state();
      return geometry;
    })();
  }
  dungeon(token: string) {
    const cam = this.guard(token),
      view = dungeonView(this.db, cam);
    return this.graphShadow
      ? {
          ...view,
          ...dungeonGeometry(this.graphShadow.db, cam),
          drawing: {
            ...drawingView(this.graphShadow.db, cam),
            graphPreview: this.graphShadow.state(),
          },
        }
      : view;
  }
  dungeonCommandState(command: DungeonCommand) {
    this.guard(command.token, command.campaignId);
    return dungeonCommandState(this.db, command);
  }
  previewDungeon(token: string, r: DungeonRequest) {
    return previewDungeon(this.db, this.guard(token), r);
  }
  executeDungeon(c: DungeonCommand) {
    if (this.graphShadow)
      throw new Error(
        'Graphvorschau zuerst übernehmen oder Ursprung wiederherstellen. Dungeon-Leiten nutzt die bestätigte Geometrie.',
      );
    return executeDungeon(
      this.db,
      c,
      () => {
        this.guard(c.token, c.campaignId);
      },
      (command) => this.executeLive(command),
      (command) => this.executeCombat(command),
      (command) => this.executeProgress(command),
    );
  }
  previewPath(token: string, p: DungeonPath): PathPreview {
    if (this.graphShadow && !this.graphRouting)
      return this.withGraph(() => this.previewPath(token, p));
    const cam = this.guard(token);
    return previewDungeonPath(this.db, cam, p, dungeonGeometry(this.db, cam));
  }
  drawing(token: string): DrawingView {
    if (this.graphShadow && !this.graphRouting) return this.withGraph(() => this.drawing(token));
    return { ...drawingView(this.db, this.guard(token)), graphPreview: this.graphShadow?.state() };
  }
  executeDrawing(c: DrawingCommand): { workspace: Workspace; view: DrawingView } {
    if (c.action.kind === 'graph-commit')
      throw new Error('Graphübernahme ist nur über die geschützte Vorschau möglich.');
    if (this.graphShadow && !this.graphRouting) {
      if (c.action.kind === 'element')
        validateDungeonPlacement(this.db, c.campaignId, c.action.element, this.graphShadow.scopeId);
      return this.withGraph(() => this.executeDrawing(c));
    }
    executeDrawing(this.db, c, () => {
      this.guard(c.token, c.campaignId);
    });
    return {
      workspace: this.workspace(),
      view: { ...drawingView(this.db, c.campaignId), graphPreview: this.graphShadow?.state() },
    };
  }
  activateFeature(
    token: string,
    id: string,
    sceneId: string,
    expected: number,
    action: 'activate' | 'reset' | 'correct',
    charges: number | null,
    commandId: string,
  ) {
    if (this.graphShadow)
      throw new Error('Graphvorschau zuerst übernehmen oder Ursprung wiederherstellen.');
    const cam = this.guard(token);
    activateDungeonFeature(this.db, cam, id, sceneId, expected, action, charges, commandId);
    return drawingView(this.db, cam);
  }
  graph(token: string, scopeId: string): GraphView {
    const cam = this.guard(token);
    if (
      this.graphShadow &&
      (this.graphShadow.campaignId !== cam || this.graphShadow.scopeId !== scopeId)
    )
      throw new Error('Zuerst die offene Graphvorschau übernehmen oder wiederherstellen.');
    const view = graphView(
      this.graphShadow?.db ?? this.db,
      cam,
      scopeId,
      this.graphShadow?.state() ?? null,
    );
    return { ...view, budget: dungeonBudgetView(this.db, cam, scopeId, view) };
  }
  executeGraph(c: GraphCommand): { workspace: Workspace; view: GraphView } {
    const cam = this.guard(c.token, c.campaignId);
    if (
      this.graphShadow &&
      (this.graphShadow.campaignId !== cam || this.graphShadow.scopeId !== c.scopeId)
    )
      throw new Error('Eine Dungeonvorschau gleichzeitig bearbeiten.');
    const a = c.action;
    if (a.kind === 'select') {
      this.select(c.token, a.roomId);
      return { workspace: this.workspace(), view: this.graph(c.token, c.scopeId) };
    }
    if (a.kind === 'restore') {
      if (this.graphShadow) this.committedSources.forget(this.graphShadow.db);
      this.graphShadow?.dispose();
      this.graphShadow = null;
      return { workspace: this.workspace(), view: this.graph(c.token, c.scopeId) };
    }
    if (a.kind === 'accept') {
      const shadow = this.graphShadow;
      if (!shadow || shadow.phase !== 'raster')
        throw new Error(
          'Zur Rastervorschau wechseln, dort korrigieren und anschließend übernehmen.',
        );
      const changes = shadow.changes(),
        selected = shadow.db
          .prepare('SELECT selected_id FROM campaign WHERE id=?')
          .get(cam)?.selected_id;
      this.db
        .transaction(() => {
          if (changes.length)
            executeDrawing(
              this.db,
              {
                commandId: c.commandId,
                token: c.token,
                campaignId: cam,
                action: { kind: 'graph-commit', changes },
              },
              () => {
                this.guard(c.token, cam);
              },
            );
          if (
            selected &&
            selected !==
              this.db.prepare('SELECT selected_id FROM campaign WHERE id=?').get(cam)?.selected_id
          )
            this.db.prepare('UPDATE campaign SET selected_id=? WHERE id=?').run(selected, cam);
        })
        .immediate();
      this.committedSources.forget(shadow.db);
      shadow.dispose();
      this.graphShadow = null;
      return { workspace: this.workspace(), view: this.graph(c.token, c.scopeId) };
    }
    if (!this.graphShadow) this.graphShadow = new GraphShadow(this.db, cam, c.scopeId);
    const shadow = this.graphShadow;
    const draw = (action: DrawingCommand['action']) =>
      this.withGraph(() => {
        executeDrawing(
          this.db,
          { commandId: randomUUID(), token: c.token, campaignId: cam, action },
          () => {
            this.guard(c.token, cam);
          },
        );
      });
    const saveLayout = (layout: import('../atlas/graph-contracts').GraphLayout) => {
      const current = shadow.db
        .prepare('SELECT revision FROM dungeon_graph_layout WHERE campaign_id=? AND id=?')
        .get(cam, c.scopeId);
      draw({ kind: 'graph-layout', layout, expectedRevision: current?.revision ?? null });
    };
    const connect = (intent: import('../atlas/graph-contracts').GraphIntent) => {
      let layout = graphLayout(shadow.db, cam, c.scopeId);
      const at = layout.intents.findIndex((i) => i.id === intent.id);
      if (at >= 0) layout.intents[at] = intent;
      else layout.intents.push(intent);
      if (!intent.fromRoomId || !intent.toRoomId) {
        intent.problem = 'Gruppenverbindung ist Planungsabsicht. Beide konkreten Endräume wählen.';
        saveLayout(layout);
        return;
      }
      const fromId = intent.fromRoomId,
        toId = intent.toRoomId;
      try {
        shadow.db
          .transaction(() => {
            let g = dungeonGeometry(shadow.db, cam);
            const ends = [fromId, toId].map((id) => g.rooms.find((r) => r.id === id));
            if (ends.some((r) => !r || r.scopeId !== c.scopeId))
              throw new Error('Beide Endräume derselben Dungeonzeichnung wählen.');
            for (const room of ends)
              if (!g.drawing.volumes?.some((v) => v.roomId === room!.id))
                draw({
                  kind: 'volume-initialize',
                  roomId: room!.id,
                  expectedRoomRevision: room!.revision,
                  expectedVolumeRevision: null,
                  heightSteps: 2,
                });
            g = dungeonGeometry(shadow.db, cam);
            const old = g.drawing.paths?.find((p) => p.id === intent.id),
              path: DungeonPath = old
                ? {
                    ...old,
                    from:
                      old.from.roomId === fromId
                        ? old.from
                        : { roomId: fromId, volumeId: null, pinned: false, local: null },
                    to:
                      old.to.roomId === toId
                        ? old.to
                        : { roomId: toId, volumeId: null, pinned: false, local: null },
                  }
                : {
                    id: intent.id,
                    revision: 0,
                    scopeId: c.scopeId,
                    name: intent.name,
                    notes: '',
                    from: { roomId: fromId, volumeId: null, pinned: false, local: null },
                    to: { roomId: toId, volumeId: null, pinned: false, local: null },
                    waypoints: [],
                    segments: [{ form: intent.form, widthSteps: 1, heightSteps: 2, factor: 1 }],
                    medium: 'air',
                    mode: 'path',
                    roomId: null,
                    volumeId: null,
                    fromPassageId: randomUUID(),
                    toPassageId: randomUUID(),
                    basis: '',
                    route: [],
                  };
            const preview = previewDungeonPath(shadow.db, cam, path, g);
            draw({ kind: 'path-publish', preview, expectedRevision: old?.revision ?? null });
            layout = graphLayout(shadow.db, cam, c.scopeId);
            layout.intents = layout.intents.filter((i) => i.id !== intent.id);
            saveLayout(layout);
          })
          .immediate();
      } catch (e) {
        intent.problem = (e as Error).message;
        saveLayout(layout);
      }
    };
    if (a.kind === 'raster') shadow.phase = 'raster';
    else if (a.kind === 'connect') connect(structuredClone(a.intent));
    else if (a.kind === 'resolve') {
      const intent = graphLayout(shadow.db, cam, c.scopeId).intents.find(
        (i) => i.id === a.intentId,
      );
      if (!intent) throw new Error('Verbindungsplanung fehlt.');
      connect({ ...intent, fromRoomId: a.fromRoomId, toRoomId: a.toRoomId });
    } else if (a.kind === 'reroute') {
      for (const path of drawingView(shadow.db, cam).paths ?? []) {
        if (path.mode === 'area' || path.status === 'ready') continue;
        connect({
          id: path.id,
          fromRoomId: path.from.roomId,
          toRoomId: path.to.roomId,
          fromGroupId: null,
          toGroupId: null,
          form: path.segments[0]!.form,
          name: path.name,
          problem: '',
        });
      }
    } else {
      draw(a);
      if (a.kind === 'graph-move' || a.kind === 'graph-duplicate') {
        for (const path of drawingView(shadow.db, cam).paths ?? []) {
          if (path.mode === 'area' || path.status === 'ready') continue;
          connect({
            id: path.id,
            fromRoomId: path.from.roomId,
            toRoomId: path.to.roomId,
            fromGroupId: null,
            toGroupId: null,
            form: path.segments[0]!.form,
            name: path.name,
            problem: '',
          });
        }
      }
    }
    return { workspace: this.workspace(), view: this.graph(c.token, c.scopeId) };
  }
  autonomyDecision(token: string, actorId: string) {
    return autonomyDecision(this.db, this.guard(token), actorId);
  }
  autonomy(token: string) {
    return autonomyView(this.db, this.guard(token));
  }
  executeAutonomy(c: AutonomyCommand) {
    return executeAutonomy(this.db, c, () => {
      this.guard(c.token, c.campaignId);
    });
  }
  playerView(token: string, query?: import('../runtime/player-contracts').PlayerMapQuery) {
    return playerView(this.db, this.guard(token), query);
  }
  executePlayer(c: PlayerCommand) {
    return executePlayer(this.db, c, () => {
      this.guard(c.token, c.campaignId);
    });
  }
  registerPlayerAsset(token: string, a: PlayerAsset) {
    const cam = this.guard(token);
    savePlayerAsset(this.db, cam, a);
    return playerView(this.db, cam);
  }
  playerWindowOpen(token: string, open: boolean) {
    this.db.transaction(() => setPlayerWindow(this.db, this.guard(token), open)).immediate();
  }
  closePlayerWindow(token: string) {
    this.playerWindowOpen(token, false);
  }
  currentPlayerDisplay() {
    return this.db.transaction(() => {
      if (!this.active) return null;
      const settings = this.currentPlayerSettings();
      if (!settings) return null;
      let frame: PlayerFrame = {
        mode: 'blank',
        title: '',
        reason: 'GM hat die Anzeige ausgeblendet.',
      };
      if (settings.windowOpen && !settings.blank)
        try {
          frame = projectPlayer(this.db, this.active.campaignId);
        } catch {
          frame = { mode: 'blank', title: '', reason: 'Anzeige derzeit nicht verfügbar.' };
        }
      return { owner: { id: this.active.campaignId, token: this.active.token }, settings, frame };
    })();
  }
  currentPlayerSettings() {
    if (!this.active) return null;
    const l = this.db
      .prepare('SELECT trashed FROM campaign_lifecycle WHERE campaign_id=?')
      .get(this.active.campaignId);
    return l && !l.trashed ? playerSettings(this.db, this.active.campaignId) : null;
  }
  currentPlayerFrame() {
    if (!this.currentPlayerSettings()) return { mode: 'blank' as const, title: '' };
    return projectPlayer(this.db, this.active!.campaignId);
  }
  playerImageFile(id: string) {
    if (!this.active) throw new Error('Keine Kampagne.');
    const a = playerAssets(this.db, this.active.campaignId).find((a) => a.id === id);
    if (!a) throw new Error('Bild fehlt.');
    return dirname(this.filename) + '/player-images/' + a.sha256 + a.extension;
  }
  cities(token: string) {
    return cityOverview(this.db, this.guard(token));
  }
  city(token: string, id: string) {
    return readCity(this.db, this.guard(token), id);
  }
  cityActivities(
    token: string,
    q: import('../atlas/city-activity-contracts').CityActivityQuery,
  ): import('../atlas/city-activity-contracts').CityActivityPage {
    const cam = this.guard(token);
    return this.db.transaction(() => readCityActivities(this.db, cam, q))();
  }
  cityBuildings(token: string, query: import('../atlas/city-contracts').CityBuildingQuery) {
    const c = this.guard(token);
    return this.db.transaction(() => readCityBuildingChoices(this.db, c, query))();
  }
  executeCity(command: CityCommand) {
    return executeCity(this.db, command, () => {
      this.guard(command.token, command.campaignId);
    });
  }
  campaignInstallationSettings() {
    const id = this.list().activeId;
    return { registry: readGeneratorRegistry(this.db, id ?? ''), activeId: id };
  }
  campaignCatalogOutcome(command: CampaignCatalogCommand) {
    return catalogOutcome(this.db, command);
  }
  campaignCatalog(command: CampaignCatalogCommand): CampaignCatalogReceipt {
    catalogCommand(command);
    const completed = catalogOutcome(this.db, command);
    if (completed) return completed;
    if (
      this.graphShadow &&
      (command.kind === 'create' ||
        (command.kind === 'open' && this.graphShadow.campaignId !== command.id))
    )
      throw new Error('Offene Graphvorschau zuerst übernehmen oder Ursprung wiederherstellen.');
    let changed = false;
    const result = this.db
      .transaction(() => {
        const prior = catalogOutcome(this.db, command);
        if (prior) return prior;
        const receipt = applyCampaignCatalog(this.db, command, {
          create: (name) => this.create(name),
          trash: (command) => trashCampaign(this.db, command),
          erase: (command) => eraseCampaignRows(this.db, command),
        });
        changed = true;
        return receipt;
      })
      .immediate();
    if (changed) {
      if (
        command.kind === 'open' ||
        command.kind === 'create' ||
        (((command.kind === 'trash' && command.trashed) || command.kind === 'erase') &&
          this.active?.campaignId === result.campaignId)
      ) {
        this.active = null;
        this.chronicleRead?.close();
        this.chronicleRead = null;
      }
      this.backupEpoch++;
    }
    return result;
  }
  campaignCatalogWorkspace(commandId: string): Workspace;
  campaignCatalogWorkspace(commandId: string, projection: true): WorkspaceShell;
  campaignCatalogWorkspace(commandId: string, projection?: boolean): Workspace | WorkspaceShell;
  campaignCatalogWorkspace(commandId: string, projection = false): Workspace | WorkspaceShell {
    const row = this.db
      .prepare('SELECT payload,checksum FROM campaign_catalog_receipt WHERE command_id=?')
      .get(commandId);
    if (!row || hash(row.payload) !== row.checksum) throw new Error('Öffnungsbeleg fehlt.');
    const receipt = JSON.parse(row.payload) as CampaignCatalogReceipt;
    if (
      !['open', 'create'].includes(receipt.kind) ||
      this.list().activeId !== receipt.campaignId ||
      !this.list().campaigns.some((c) => c.id === receipt.campaignId)
    )
      throw new Error(
        'Die aktive Kampagne wurde inzwischen gewechselt. Kampagne ausdrücklich neu öffnen.',
      );
    this.chronicleRead?.close();
    this.chronicleRead = null;
    this.active = { campaignId: receipt.campaignId, token: randomUUID() };
    return projection ? this.workspaceShell() : this.workspace();
  }
  campaignOverview() {
    return this.db.transaction(() => campaignOverview(this.db))();
  }
  campaignIdentity(token: string): Campaign {
    return this.db
      .prepare('SELECT id,name,revision FROM campaign WHERE id=?')
      .get(this.guard(token));
  }
  campaignFence(id: string, revision: number) {
    const r = this.db
      .prepare('SELECT revision,trashed FROM campaign_lifecycle WHERE campaign_id=?')
      .get(id);
    if (!r || r.trashed || r.revision !== revision)
      throw new Error('Quellkampagne wurde gelöscht oder ihr Lebenszyklus geändert.');
  }
  async campaignSnapshot(token: string, filename: string) {
    const id = this.guard(token),
      fence = this.db
        .prepare('SELECT revision FROM campaign_lifecycle WHERE campaign_id=?')
        .get(id).revision,
      candidate = filename + '.snapshot-' + randomUUID();
    try {
      await this.db.backup(candidate);
      this.campaignFence(id, fence);
      const db = new Database(candidate, { fileMustExist: true });
      let snapshot;
      try {
        db.pragma('journal_mode=DELETE');
        pruneCampaignSnapshot(db, id);
        validateDatabase(db);
        validateTransferSnapshot(db);
        const c: Pick<Campaign, 'id' | 'name'> = db.prepare('SELECT id,name FROM campaign').get();
        snapshot = {
          ...c,
          fence,
          schema: db.pragma('user_version', { simple: true }),
          counts: snapshotCounts(db),
          media: [...audioMediaFiles(db), ...playerMediaFiles(db, id)],
        };
      } finally {
        db.close();
      }
      const fd = openSync(candidate, 'r');
      try {
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      this.campaignFence(id, fence);
      renameSync(candidate, filename);
      const directory = openSync(dirname(filename), 'r');
      try {
        fsyncSync(directory);
      } finally {
        closeSync(directory);
      }
      return snapshot;
    } finally {
      for (const suffix of ['', '-wal', '-shm']) rmSync(candidate + suffix, { force: true });
    }
  }
  private inspectCampaignDatabase(db: any) {
    const schema = db.pragma('user_version', { simple: true });
    if (schema !== DATA_FORMAT.schema)
      throw new Error(
        'Dieses Paket gehört zum alten Testformat oder benötigt eine neuere Appversion. Originaldatei bleibt erhalten.',
      );
    validateDatabase(db);
    validateRoomGroups(db);
    const rows = db.prepare('SELECT id,name FROM campaign').all();
    if (rows.length !== 1) throw new Error('Paket muss genau eine Kampagne enthalten.');
    const c: Pick<Campaign, 'id' | 'name'> = rows[0];
    validateCampaignSnapshotSettings(db, c.id);
    validateTransferSnapshot(db);
    return {
      ...c,
      schema,
      counts: snapshotCounts(db),
      media: [...audioMediaFiles(db), ...playerMediaFiles(db, rows[0].id)],
      conflicts: definitionConflicts(this.db, db),
    };
  }
  campaignPreview(filename: string) {
    const db = new Database(filename, { readonly: true, fileMustExist: true });
    try {
      return this.inspectCampaignDatabase(db);
    } finally {
      db.close();
    }
  }
  campaignTransferOutcome(
    ticket: string,
    expected?: { name: string; choices: Record<string, ConflictChoice> },
  ): Campaign | null {
    if (typeof ticket !== 'string' || !ticket || ticket.length > 128)
      throw new Error('Übernahmekennung fehlt.');
    const receipt = this.db
      .prepare('SELECT subject_id,fingerprint FROM campaign_management_receipt WHERE command_id=?')
      .get(ticket);
    if (!receipt) return null;
    if (
      !receipt.fingerprint.startsWith('transfer:') ||
      (expected &&
        receipt.fingerprint !== this.transferFingerprint(expected.name, expected.choices))
    )
      throw new Error('Verwaltungskennung anders verwendet.');
    return (
      this.db.prepare('SELECT id,name,revision FROM campaign WHERE id=?').get(receipt.subject_id) ??
      null
    );
  }
  private transferFingerprint(name: string, choices: Record<string, ConflictChoice>) {
    return 'transfer:' + hash(canonicalJson({ name, choices }));
  }
  acceptCampaignSnapshot(
    filename: string,
    name: string,
    choices: Record<string, ConflictChoice>,
    ticket?: string,
    expectedDigest?: string,
  ) {
    if (!name.trim() || name.length > 1000) throw new Error('Kampagnenname fehlt.');
    if (ticket !== undefined) {
      const confirmed = this.campaignTransferOutcome(ticket, { name, choices });
      if (confirmed) return confirmed;
    }
    // Remapping must never consume or mutate the reviewed input, even when publication fails.
    const staging = mkdtempSync(filename + '.accept-'),
      candidate = staging + '/campaign.sqlite';
    let source: any;
    try {
      copyFileSync(filename, candidate);
      source = new Database(candidate, { fileMustExist: true });
      const sha256 = snapshotDigest(candidate);
      if (expectedDigest !== undefined && sha256 !== expectedDigest)
        throw new Error('Geprüfte Paketdatenbank wurde verändert.');
      const c = this.inspectCampaignDatabase(source),
        original = Buffer.from(
          JSON.stringify({
            format: 'Campaign provenance',
            version: 1,
            campaignId: c.id,
            name: c.name,
            schema: c.schema,
            sha256,
          }),
        ),
        plan = sharedPlan(this.db, source, choices);
      archiveSourceChoices(source, plan);
      const remap = remapSnapshot(source, c.id, name, plan.mapping, plan.history);
      validateDatabase(source);
      return publishSnapshot(
        this.db,
        source,
        remap,
        plan,
        original,
        c.id,
        c.name,
        ticket === undefined
          ? undefined
          : { commandId: ticket, fingerprint: this.transferFingerprint(name, choices) },
      );
    } finally {
      try {
        source?.close();
      } finally {
        rmSync(staging, { recursive: true, force: true });
      }
    }
  }

  trashCampaign(command: {
    commandId: string;
    id: string;
    expectedRevision: number;
    trashed: boolean;
  }) {
    trashCampaign(this.db, command);
    this.backupEpoch++;
    if (command.trashed && this.active?.campaignId === command.id) {
      this.active = null;
      this.db.prepare("DELETE FROM settings WHERE key='active'").run();
    }
  }
  eraseCampaign(command: {
    commandId: string;
    id: string;
    expectedRevision: number;
    confirmName: string;
  }) {
    this.backupEpoch++;
    eraseCampaignRows(this.db, command);
    if (this.active?.campaignId === command.id) this.active = null;
    this.db.exec("INSERT INTO note_search(note_search) VALUES('optimize')");
    this.db.pragma('wal_checkpoint(TRUNCATE)');
  }
  pendingCampaignErasures(): string[] {
    return this.db
      .prepare("SELECT id FROM campaign_erasure WHERE phase='cleanup'")
      .all()
      .map((r: any) => r.id);
  }
  campaignErasureFiles(id: string): string[] {
    const value = this.db
      .prepare('SELECT value FROM settings WHERE key=?')
      .get('campaign-erasure-files:' + id)?.value;
    const files: unknown = value === undefined ? [] : JSON.parse(value);
    if (
      !Array.isArray(files) ||
      files.some(
        (name) => typeof name !== 'string' || !/^images\/[a-f0-9]{64}\.[a-z0-9]{1,8}$/.test(name),
      )
    )
      throw Error('Dateizuordnung der Kampagnenlöschung beschädigt.');
    return files;
  }
  finishCampaignErasure(id: string) {
    this.db
      .transaction(() => {
        this.db.prepare("UPDATE campaign_erasure SET phase='complete' WHERE id=?").run(id);
        this.db.prepare('DELETE FROM settings WHERE key=?').run('campaign-erasure-files:' + id);
      })
      .immediate();
  }
  private get audioRoot() {
    return dirname(this.filename) + '/audio';
  }
  private updateMusic(campaignId: string) {
    try {
      this.db.transaction(() => refreshMusicContext(this.db, this.audioRoot, campaignId))();
    } catch {
      /* Music failure does not invalidate the core action. */
    }
  }
  audioAssets(query: AudioQuery) {
    return readAudioAssets(this.db, this.audioRoot, query);
  }
  campaignMediaReferenced(name: string) {
    // Unknown damaged metadata cannot authorize deletion of shared media bytes.
    if (!name.startsWith('audio/') && !name.startsWith('images/')) return true;
    const image = name.startsWith('images/'),
      table = image ? 'player_asset' : 'audio_asset',
      prefix = image ? '$' : '$.media';
    if (this.db.prepare(`SELECT 1 FROM ${table} WHERE NOT json_valid(payload) LIMIT 1`).get())
      return true;
    return !!this.db
      .prepare(
        `SELECT 1 FROM ${table} WHERE json_extract(payload,'${prefix}.sha256')||json_extract(payload,'${prefix}.extension')=? LIMIT 1`,
      )
      .get(name.slice(name.indexOf('/') + 1));
  }
  audioAsset(id: string) {
    return readAudioAsset(this.db, this.audioRoot, id);
  }
  musicFavorites(token: string, after: string | null) {
    return this.db.transaction(() =>
      readMusicFavorites(this.db, this.audioRoot, this.guard(token), after),
    )();
  }
  music(token: string): MusicView {
    return this.db.transaction(() => readMusic(this.db, this.audioRoot, this.guard(token)))();
  }
  musicSubject(token: string, kind: MusicSubject['kind'], id: string) {
    return readMusicSubject(this.db, this.guard(token), kind, id);
  }
  executeMusic(command: MusicCommand) {
    return executeMusic(this.db, this.audioRoot, command, () => {
      this.guard(command.token, command.campaignId);
    });
  }
  musicPosition(token: string, playbackId: string, seconds: number) {
    return saveMusicPosition(this.db, this.guard(token), playbackId, seconds);
  }
  ingestAudio(token: string, media: AudioAsset['media']) {
    const cam = this.guard(token);
    const result = this.db
      .transaction(() => ingestAudio(this.db, this.audioRoot, media))
      .immediate();
    this.updateMusic(cam);
    return result;
  }
  ingestAudios(token: string, medias: AudioAsset['media'][]): AudioAsset[] {
    const cam = this.guard(token),
      assets = this.db
        .transaction(() => medias.map((media) => ingestAudio(this.db, this.audioRoot, media)))
        .immediate();
    this.updateMusic(cam);
    return assets;
  }
  audioLibrary(token: string) {
    this.guard(token);
    return this.db.transaction(() => audioLibrarySnapshot(this.db, this.audioRoot))();
  }
  mergeAudioLibrary(token: string, library: ReturnType<typeof audioLibrarySnapshot>) {
    const cam = this.guard(token),
      ids = mergeAudioLibrary(this.db, this.audioRoot, library);
    this.updateMusic(cam);
    return ids;
  }
  audioFile(id: string) {
    const asset = readAudioAsset(this.db, this.audioRoot, id);
    if (!asset.available) throw new Error('Mediendatei fehlt oder wurde verändert.');
    return audioFile(this.audioRoot, asset);
  }
  agenda(token: string, query: import('../runtime/agenda-contracts').AgendaQuery) {
    return this.db.transaction(() => readAgenda(this.db, this.guard(token), query))();
  }
  world(token: string) {
    return this.db.transaction(() => readWorld(this.db, this.guard(token)))();
  }
  sceneWorld(token: string, id: string) {
    return this.db.transaction(() => readSceneWorld(this.db, this.guard(token), id))();
  }
  previewTravel(token: string, request: TravelRequest) {
    return this.db.transaction(() => previewTravel(this.db, this.guard(token), request))();
  }
  reconcileWorld(command: WorldCommand, token: string) {
    return this.db.transaction(() => {
      this.guard(token, command.campaignId);
      return reconcileWorld(this.db, command);
    })();
  }
  private consumeSceneTime(
    cam: string,
    commandId: string,
    before: LiveScene,
    after: LiveScene,
    basis: ReturnType<typeof captureAutonomyBasis>,
  ) {
    return consumeSceneTime(this.db, cam, commandId, before, after, basis);
  }
  executeWorld(command: WorldCommand) {
    return storedExecuteWorld(
      this.db,
      {
        guard: this.guard.bind(this),
        consumeSceneTime: this.consumeSceneTime.bind(this),
        updateMusic: this.updateMusic.bind(this),
      },
      command,
    );
  }
  itemDefinitions(query: ItemQuery) {
    return readItemDefinitions(this.db, query);
  }
  itemDefinition(id: string, revision?: number) {
    return readItemDefinition(this.db, id, revision);
  }
  shops(token: string, includeTrashed: boolean) {
    return readShops(this.db, this.guard(token), includeTrashed);
  }
  shop(token: string, id: string) {
    return readShop(this.db, this.guard(token), id);
  }
  shopHistory(token: string, id: string, after: string | null) {
    return readShopHistory(this.db, this.guard(token), id, after);
  }
  sceneShops(token: string, id: string) {
    return sceneShops(this.db, this.guard(token), id);
  }
  executeItemShop(command: ItemShopCommand) {
    return executeItemShop(this.db, command, () => {
      this.guard(command.token, command.campaignId);
    });
  }
  combatResolution(token: string, sceneId: string, id: string, after: string | null) {
    return readCombatResolution(this.db, this.guard(token), sceneId, id, after);
  }
  combat(token: string, sceneId: string, id?: string) {
    return readCombat(this.db, this.guard(token), sceneId, id);
  }
  combatDraft(token: string, combatId: string, kind: CombatDraftKind, targetId: string) {
    return this.db.transaction(() =>
      readCombatDraft(this.db, this.guard(token), combatId, kind, targetId),
    )();
  }
  combatDrafts(token: string, combatId: string, after: string | null) {
    return this.db.transaction(() => combatDrafts(this.db, this.guard(token), combatId, after))();
  }
  keepCombatDraft(token: string, draft: CombatWorkingDraft, expected: string | null) {
    keepCombatDraft(this.db, this.guard(token), draft, expected);
  }
  discardCombatDraft(
    token: string,
    combatId: string,
    kind: CombatDraftKind,
    targetId: string,
    writeId: string,
  ) {
    discardCombatDraft(this.db, this.guard(token), combatId, kind, targetId, writeId);
  }
  executeCombat(command: CombatCommand) {
    return this.db
      .transaction(() => {
        const ack = executeCombat(this.db, command, () => {
          this.guard(command.token, command.campaignId);
        });
        this.updateMusic(command.campaignId);
        return ack;
      })
      .immediate();
  }
  archivedRoster(token: string, after: string | null, search: string) {
    return readArchivedRoster(this.db, this.guard(token), after, search);
  }
  previewTime(token: string, request: import('../runtime/time-plan-contracts').TimeRequest) {
    return this.db.transaction(() => previewSceneTime(this.db, this.guard(token), request))();
  }
  live(token: string): import('../runtime/live-contracts').LiveView {
    const cam = this.guard(token),
      live = readLive(this.db, cam);
    try {
      return { ...live, recapDraft: readSessionRecapDraft(this.db, cam) };
    } catch {
      return {
        ...live,
        recapDraftError:
          'Rückblickentwurf nicht lesbar. Gespeicherte Texte bleiben erhalten. Erneut laden oder eine intakte Sicherung verwenden.',
      };
    }
  }
  keepLiveMomentDraft(
    token: string,
    sceneId: string,
    draft: import('../runtime/live-moment-drafts').LiveMomentDraft | null,
    expected: import('../runtime/live-moment-drafts').LiveMomentDraft | null,
  ) {
    return this.db
      .transaction(() => {
        const cam = this.guard(token),
          scene = readLiveScene(this.db, cam, sceneId);
        if (scene.retired) throw new Error('Momententwurf gehört zu einer früheren Scene.');
        keepMomentDraft(this.db, cam, sceneId, draft, expected);
      })
      .immediate();
  }
  keepSessionRecapDraft(
    token: string,
    draft: import('../runtime/live-contracts').SessionRecapDraft,
    expected: import('../runtime/live-contracts').SessionRecapDraft | null,
  ) {
    return this.db
      .transaction(() => keepSessionRecapDraft(this.db, this.guard(token), draft, expected))
      .immediate();
  }
  liveScene(token: string, id: string) {
    return this.db.transaction(() => readLiveScene(this.db, this.guard(token), id))();
  }
  liveArchives(token: string, after: string | null) {
    return readArchives(this.db, this.guard(token), after);
  }
  executeLive(command: LiveCommand) {
    return this.db
      .transaction(() =>
        applyLiveCommand(this.db, command, {
          guard: () => {
            this.guard(command.token, command.campaignId);
          },
          commitPreparation: (command) => this.commitPreparation(command),
          updateMusic: (campaignId) => this.updateMusic(campaignId),
        }),
      )
      .immediate();
  }
  liveStatus(command: LiveCommand, token: string) {
    this.guard(token, command.campaignId);
    return liveStatus(this.db, command);
  }
  private readPlan(campaignId: string, id: string, db = this.db): ManualPlan {
    return readStoredPlan(db, campaignId, id);
  }
  changePreparation(command: PreparationCommand): Preparation {
    this.commitPreparation(command);
    return this.preparation(command.token);
  }
  changePreparationPlan(command: PreparationCommand): ManualPlan {
    if (command.change.kind !== 'plan')
      throw new Error('Gezielte Planänderung benötigt einen Spielabendplan.');
    const id = command.change.plan.id;
    return this.db
      .transaction(() => {
        this.commitPreparation(command);
        return this.readPlan(this.guard(command.token), id);
      })
      .immediate();
  }
  reconcilePreparationPlan(
    command: PreparationCommand,
    token = command.token,
  ): import('../campaign/preparation-contracts').PlanReconciliation {
    return storedReconcilePreparationPlan(
      this.db,
      {
        guard: this.guard.bind(this),
        activeCampaignId: this.active?.campaignId,
        readPlan: this.readPlan.bind(this),
      },
      command,
      token,
    );
  }
  changePreparationContent(command: PreparationCommand) {
    if (command.change.kind !== 'note' && command.change.kind !== 'location')
      throw new Error('Gezielte Änderung benötigt Notiz oder Ort.');
    this.commitPreparation(command);
    const cam = this.guard(command.token);
    return deskContent(
      this.db,
      cam,
      command.change.kind === 'note'
        ? { kind: 'note', id: command.change.note.id }
        : { kind: 'location', id: command.change.document.id },
    );
  }
  reconcilePreparationContent(command: PreparationCommand, token: string) {
    const cam = this.guard(token, command.campaignId),
      target = preparationTarget(command.change),
      r = this.db.prepare('SELECT * FROM receipt WHERE command_id=?').get(command.commandId),
      table =
        target.kind === 'note' ? 'world_note' : target.kind === 'location' ? 'location' : 'plan',
      current = this.db
        .prepare(`SELECT revision FROM ${table} WHERE campaign_id=? AND id=?`)
        .get(cam, target.id);
    if (r) {
      if (r.campaign_id !== cam || !matchesReceipt(r, command))
        throw new Error('Änderungskennung anders verwendet.');
      return { outcome: 'applied' as const, targetChanged: current?.revision !== r.revision };
    }
    const changed = (current?.revision ?? null) !== command.change.expectedRevision;
    return {
      outcome: changed ? ('conflict' as const) : ('not-applied' as const),
      targetChanged: changed,
    };
  }
  executeWorldRelationPair(command: WorldRelationPairCommand) {
    return executeWorldRelationPair(this.db, command, () => {
      this.guard(command.token, command.campaignId);
    });
  }
  reconcileWorldRelationPair(command: WorldRelationPairCommand, token: string) {
    return reconcileWorldRelationPair(this.db, command, this.guard(token, command.campaignId));
  }
  worldRelationPairDraft(token: string, sourceId: string) {
    return readWorldRelationPairDraft(this.db, this.guard(token), sourceId);
  }
  keepWorldRelationPairDraft(
    token: string,
    draft: WorldRelationPairDraft,
    expected: string | null,
  ) {
    keepWorldRelationPairDraft(
      this.db,
      this.guard(token, draft.command.campaignId),
      draft,
      expected,
    );
  }
  discardWorldRelationPairDraft(token: string, sourceId: string, writeId: string) {
    discardWorldRelationPairDraft(this.db, this.guard(token), sourceId, writeId);
  }
  worldRelationPairHistory(token: string) {
    return readWorldRelationPairHistory(this.db, this.guard(token));
  }
  executeWorldRelationPairHistory(command: WorldRelationPairHistoryCommand) {
    return executeWorldRelationPairHistory(this.db, command, () => {
      this.guard(command.token, command.campaignId);
    });
  }
  reconcileWorldRelationPairHistory(command: WorldRelationPairHistoryCommand, token: string) {
    return reconcileWorldRelationPairHistory(
      this.db,
      command,
      this.guard(token, command.campaignId),
    );
  }
  private commitPreparation(command: PreparationCommand): void {
    commitPreparation(this.db, command, {
      activeCampaignId: this.active?.campaignId,
      graphPreviewOpen: !!this.graphShadow,
      guard: this.guard.bind(this),
      commitPreparation: this.commitPreparation.bind(this),
      executeSession: this.executeSession.bind(this),
    });
  }
  selectPreparation(token: string, selection: PreparationSelection): void {
    return storedSelectPreparation(this.db, { guard: this.guard.bind(this) }, token, selection);
  }
  reconcilePreparation(
    command: PreparationCommand,
    token = command.token,
  ): {
    outcome: 'applied' | 'not-applied' | 'conflict';
    targetChanged: boolean;
    data: Preparation;
  } {
    return this.db.transaction(() => {
      const campaignId = this.guard(token, command.campaignId ?? this.active?.campaignId),
        change = command.change;
      const prior = this.db
        .prepare('SELECT fingerprint,campaign_id,revision FROM receipt WHERE command_id=?')
        .get(command.commandId);
      if (prior && (prior.campaign_id !== campaignId || !matchesReceipt(prior, command)))
        throw new Error('Änderungskennung bereits anders verwendet.');
      if (!prior && command.campaignId === undefined && command.token !== token)
        throw new Error('Der alte Auftrag besitzt keine eindeutige Kampagnenbindung.');
      const targetId =
        change.kind === 'plan'
          ? change.plan.id
          : change.kind === 'note'
            ? change.note.id
            : change.kind === 'location'
              ? change.document.id
              : change.id;
      const table =
        change.kind === 'plan'
          ? 'plan'
          : change.kind === 'location' || change.kind === 'location-trash'
            ? 'location'
            : 'world_note';
      const current = this.db
        .prepare(`SELECT revision FROM ${table} WHERE campaign_id=? AND id=?`)
        .get(campaignId, targetId);
      const expected = change.expectedRevision;
      let unchanged = expected === null ? !current : current?.revision === expected;
      let mergeTargetChanged = false;
      if (change.kind === 'note-merge') {
        const target = this.db
          .prepare('SELECT revision FROM world_note WHERE campaign_id=? AND id=?')
          .get(campaignId, change.targetId);
        mergeTargetChanged = target?.revision !== change.expectedTargetRevision + (prior ? 1 : 0);
        if (!prior) {
          try {
            unchanged =
              unchanged &&
              !mergeTargetChanged &&
              noteMergeWork(this.db, campaignId, change.id, change.targetId).preview.basis ===
                change.basis;
          } catch {
            unchanged = false;
          }
        }
      }
      const data = this.preparation(token);
      const readable =
        table === 'plan'
          ? data.plans.some((plan) => plan.id === targetId)
          : table === 'location'
            ? data.locations.some((row) => row.document.id === targetId)
            : data.notes.some((row) => row.note.id === targetId);
      return {
        outcome: prior ? 'applied' : unchanged ? 'not-applied' : 'conflict',
        targetChanged:
          mergeTargetChanged ||
          (prior ? current?.revision !== prior.revision : !unchanged) ||
          (!!current && !readable),
        data,
      };
    })();
  }
  keepRoomDraft(token: string, roomId: string, draft: WorkingRoomDraft | null) {
    if (this.graphShadow && !this.graphRouting)
      return this.withGraph<void>(() => this.keepRoomDraft(token, roomId, draft));
    return storedKeepRoomDraft(this.db, { guard: this.guard.bind(this) }, token, roomId, draft);
  }
  roomDraft(token: string, roomId: string): WorkingRoomDraft | null {
    if (this.graphShadow && !this.graphRouting)
      return this.withGraph(() => this.roomDraft(token, roomId));
    const campaignId = this.guard(token),
      row = this.db
        .prepare('SELECT * FROM room_draft WHERE campaign_id=? AND room_id=?')
        .get(campaignId, roomId);
    if (!row) return null;
    return decodeRoomDraft(row);
  }
  tutorial(state?: 'shown' | 'finished' | 'skipped'): TutorialRun {
    if (state !== undefined && !['shown', 'finished', 'skipped'].includes(state))
      throw new Error('Ungültiger Tutorialstatus.');
    return this.db
      .transaction(() => {
        const key = `tutorial:app:${this.applicationVersion}`,
          saved = this.db.prepare('SELECT value FROM settings WHERE key=?').get(key);
        const prior: TutorialRun | null = saved
          ? checkedTutorialRun(JSON.parse(saved.value), this.applicationVersion)
          : null;
        // Onboarding belongs to an installed app version. Edited help stays available
        // without resetting this version's completed or dismissed run.
        const run: TutorialRun = prior ?? {
          version: this.applicationVersion,
          lessonRevision: tutorialLessonRevision,
          runId: randomUUID(),
          state: 'new',
        };
        if (state && run.state !== 'finished' && run.state !== 'skipped') run.state = state;
        this.db
          .prepare(
            'INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
          )
          .run(key, json(run));
        return run;
      })
      .immediate();
  }
  renameCampaign(command: CampaignRename): Campaign {
    return storedRenameCampaign(this.db, { guard: this.guard.bind(this) }, command);
  }
}
