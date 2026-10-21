import {installTravelHistory} from './travel-history';
import {checkedWorldNoteRow} from "./world-note-row";
import {nearestAnchor} from '../drawing-model';
import {splitGroupRoom,scaleRoomGroup,installRoomGroups,storeGroupDraft,groupRecipeForHouse,refreshChangedGroupHulls,refreshGroupHull,removeGeneratedGroup,validateRoomGroups} from './room-groups';
import {installTerritories,readTerritories,executeTerritory} from './atlas-territories';
import {vegetationScene} from './vegetation';
import {TerrainSampler} from '../terrain-height';
import {readSceneEncounterSelection} from './scene-encounter-selection';
import {noteMergeWork} from './note-merge';
import {REGION_ACTIVE_BYTES} from '../atlas-region-contracts';
import {readAtlasScene} from './world';
import {atlasReadChanges} from './atlas-read-journal';
import {CommittedSources} from './committed-sources';
import type {AtlasRegionGeometry,AtlasRegionSource,AtlasRegionView} from '../atlas-region-contracts';
import {drawingElement,drawingRoom} from './drawing';
import {dungeonMapView} from './dungeon-play';
import {roomGeometries,visibleRoomWhere,roomDirectoryQuery,roomOrder} from './room-reads';
import type {WorkspaceShell,WorkspaceGeometry,RoomDirectoryQuery} from '../contracts';
import {keepLiveMomentDraft as keepMomentDraft,readLiveMomentDraft} from './live-moment-drafts';
import {atlasPartyPoint} from '../atlas-runtime-model';
import {installLandscape,landscapeRegion,executeLandscape,terrainRegion} from './atlas-landscape';
import {rememberSourceUnlink,validateNoteSourceHistory} from './note-source-history';
import {readNoteThread,checkNoteThread} from './note-thread';
import {captureKeyNote,keyNoteCaptureStatus,readKeyNoteChoices,hasNoteTitle} from './key-note-capture';
import {appendNoteExcerpt} from '../note-excerpt';
import type {KeyNoteCaptureCommand} from '../key-note-capture-contracts';
import {readNoteRoomUses} from './note-room-uses';
import {installAtlasTravel,atlasEntrances,atlasLocalJourney,putAtlasEntrance,previewAtlasLocal,executeAtlasTravel,atlasLocalGeometryBasis} from './atlas-travel';
import {atlasHexAt,atlasFrame,localToAtlas} from '../campaign-atlas-model';
import {newLocation} from '../../features/location/location-schema';
import {installCampaignAtlas,createCampaignAtlas,atlasRoot,atlasBindings,atlasHistoryState,bindAtlas,executeAtlasWrite,validateCampaignAtlases} from './campaign-atlas';
import type {AtlasCommand,CampaignAtlas} from '../campaign-atlas-contracts';
import {catalogOutcome,catalogCommand,catalogReceipt,noteCampaignCreated,noteCampaignOpened} from './campaign-catalog';
import type {CampaignCatalogCommand,CampaignCatalogReceipt} from '../campaign-contracts';
const roomNumberOrder=new Intl.Collator('de',{numeric:true});
import {readCombatResolution} from './combat-resolution';
import {ChronicleReadSession} from './chronicle-pages';
import {checkedSessionRecapDraft} from '../live-contracts';
import {readLocationActivities} from './location-activity';
import {readCityActivities} from './city-activity';
import {readWorldCalendar as readNpcPlanCalendar} from './world';
import {readNpcPlaces,readNpcBuildingChoices} from './npc-places';
import {readLocationMaterials} from './location-notebook';
import {readWorldLinks} from './world-links';
import {installWorldRelationPairs,executeWorldRelationPair,reconcileWorldRelationPair,readWorldRelationPairDraft,keepWorldRelationPairDraft,discardWorldRelationPairDraft,readWorldRelationPairHistory,executeWorldRelationPairHistory,reconcileWorldRelationPairHistory,validateWorldRelationPairs} from './world-relation-pair';
import type {WorldRelationPairCommand,WorldRelationPairDraft,WorldRelationPairHistoryCommand} from '../world-relation-pair-contracts';
import {readNpcCast,readNpcDossier} from './npc-cast';
import {previewSceneTime} from './time-plan';
import {readAgenda} from './agenda';
import {readSceneVisits} from './scene-visits';
import {readNarrativeJournal} from './narrative-journal';
import {readSessionProgress} from './visit-outcomes';
import {readSessionPacket} from './session-packet';
import {readMaskHistory,installMaskHistoryIndexes} from './mask-history';
import {keepChaseDraft,validateChaseDrafts} from './chase-drafts';
import {readDay} from './adventuring-day';
import {installNpcRecords,validateNpcRecords} from './npc-record';
import {readNpc,readNpcs,executeNpc,npcDraft,npcDrafts,keepNpcDraft,discardNpcDraft,reconcileNpc,validateNpcRecovery} from './npcs';
import type {NpcCommand,NpcQuery,NpcDraft} from '../npc-contracts';
import {readWorldSources,installWorldSources} from './world-sources';
import {removePartyFromMasks,migrateMaskHealth,syncOpenMaskHealth} from './mask-health';
import {installGroups,groupView,preparedGroups,groupDraft,keepGroupDraft,discardGroupDraft,validateGroups} from './groups';
import {installTreasury,readTreasuryDraft,keepTreasuryDraft,discardTreasuryDraft,treasureHistory,validateTreasuryDrafts} from './treasury';
import {installSceneDesk,readSceneDesk,searchDesk,deskContent,pinSceneDesk,validateSceneDesk,applySceneCreation,readSceneCreationDraft,keepSceneCreationDraft} from './scene-desk';
import {installFinishDrafts,readFinishDraft,keepFinishDraft,discardFinishDraft,validateFinishDrafts} from './finish-drafts';
import {installNarrative,readNarrative,saveNarrative,validateNarrativeState,keepNarrativeDraft,discardNarrativeDraft,validateNarrativeBackup} from './narrative';
import {readPreparedGroup} from './session';
import {installCombatDraftSchema,validateCombatDrafts,readCombatDraft,combatDrafts,keepCombatDraft,discardCombatDraft} from './combat-drafts';
import type {CombatDraftKind,CombatWorkingDraft} from '../combat-draft-contracts';
import {installContentRuntime} from './content-runtime';
import {installTriggers,createTriggerEvents} from './triggers';
import {ExtensionRegistry,validateExtensionSettings} from './extensions';
import type {ExtensionCommand} from '../extension-contracts';
import {dungeonBudgetView,validateDungeonPlacement} from './dungeon-budget';
import type {CommitOutcome} from '../commit-receipt';
import {GraphShadow,graphView,graphLayout,installGraph} from './graph';
import type {GraphCommand,GraphView} from '../graph-contracts';
import type {DrawingView} from '../drawing-contracts';
import type {PathPreview} from '../path-contracts';
import {installDungeonKey} from './dungeon-key';
import {installPathSchema,previewDungeonPath} from './paths';
import type {DungeonPath} from '../path-contracts';
import {readCommitReceipt} from './commit-receipt';
import {checkedCommitReference,type CommitReference} from '../commit-receipt';
import {installVolumeSchema,readDungeonVolume} from './volume';
import {installDungeonSenses,evaluateDungeonSenses} from './dungeon-senses';
import {installAutonomyResources} from './autonomy-resources';
import {installNpcDungeonSchema} from './npc-dungeon';
import {installAutonomyDungeonSchema} from './autonomy-dungeon';
import {installDungeonPlaySchema,dungeonCommandState,dungeonDisplay,dungeonView,previewDungeon,executeDungeon,validateDungeonPlay,dungeonGeometry,dungeonGeometryBasis} from './dungeon-play';
import type {DungeonCommand,DungeonRequest} from '../dungeon-contracts';
import {installDrawingSchema,roomMapStyle,drawingView,executeDrawing,drawingHistory,rebaseDrawingRoomHistory,activateDungeonFeature,advanceDungeonFeatures,validateDrawing,validateFeatureStates} from './drawing';
import type {DrawingCommand} from '../drawing-contracts';
import {installNpcWorldSchema} from './npc-world';
import {installAutonomySchema,autonomyView,autonomyDecision,executeAutonomy,captureAutonomyBasis,recordAutonomyTime,catchUpAutonomy,validateAutonomy} from './autonomy';
import type {AutonomyCommand} from '../autonomy-contracts';
import {installPlayerSchema,playerObservers,playerSettings,playerView,projectPlayer,executePlayer,savePlayerAsset,playerAssets,playerMediaFiles,setPlayerWindow,validatePlayer} from './player';
import type {PlayerCommand,PlayerAsset,PlayerFrame} from '../player-contracts';
import {installCitySchema,cityOverview,readCity,executeCity,validateCities,readCityBuildingChoices,readCitySite,readCityHeader} from './city';
import type {CityCommand} from '../city-contracts';
import {installCampaignSchema,validateCampaignOrigins,validateCapabilityBytes,validateCampaignSnapshotSettings,campaignOverview,pruneCampaignSnapshot,snapshotCounts,definitionConflicts,sharedPlan,archiveSourceChoices,remapSnapshot,publishSnapshot,trashCampaign,eraseCampaignRows} from './campaign-data';
import {openSync as openSnapshot, readSync, closeSync as closeSnapshot} from 'node:fs';
import type {ConflictChoice} from '../campaign-contracts';
import {canonicalJson} from '../generation/canonical-json';
import {installMusicSchema,readAudioAssets,readAudioAsset,readMusic,readMusicFavorites,readMusicSubject,executeMusic,saveMusicPosition,refreshMusicContext,ingestAudio,audioLibrarySnapshot,mergeAudioLibrary,audioFile,validateMusicBackup,audioMediaFiles} from './music';
import type {MusicView,AudioQuery,MusicSubject,MusicCommand,AudioAsset} from '../music-contracts';
import {installWorldSchema,readWorld,readSceneWorld,previewTravel,executeWorld,reconcileWorld,syncSceneWorld,inheritScenePosition,validateWorldBackup,travelEnvironmentBasis} from './world';
import type {TravelRequest,WorldCommand} from '../world-contracts';
import {installItemsSchema,readShop,readShopHistory,readShops,sceneShops,executeItemShop,restockDue,validateItemsBackup} from './items';
import {readItemDefinition,readItemDefinitions} from './item-definitions';
import type {ItemQuery,ItemShopCommand} from '../items-contracts';
import { createHash, randomUUID } from 'node:crypto';
import { noteSearchQuery } from './note-search-query';
import { noteSearchPreview } from './note-search-preview';
import { mkdirSync, mkdtempSync, copyFileSync, openSync, closeSync, fsyncSync, renameSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { validateRoom, validateRoomDraftContent, type Campaign, type CampaignRename, type Edit, type Room, type RoomCommit, type WorkingRoomDraft, type Workspace } from '../contracts';
import { validatePreparation, checkedPreparationDraft, preparationTarget, type PreparationDraft, type PreparationEdit, type Preparation, type PreparationCommand, type PreparationChange, type PreparationSelection, type Note } from '../preparation-contracts';
import { manualPlan, type ManualPlan } from '../../features/planner/manual-planner';
import { worldNoteDocument } from '../../features/world/world-notes';
import {campaignLocalId} from '../../features/campaign/campaign-contracts';
import { checkedLocationDocument } from '../../features/location/location-schema';
import { tutorialLessonRevision, checkedTutorialRun, type TutorialRun } from '../tutorial';
import { installLiveSchema, migrateLiveClock, ensureLiveOwners, readLive, readLiveScene, readArchives, readArchivedRoster, validateLiveBackup, executeLive, liveStatus } from './live';
import type { LiveCommand, LiveScene } from '../live-contracts';
import { installCombatSchema, readCombat, executeCombat, validateCombatBackup } from './combat';


import {installChaseSchema,readChase,executeChase,reconcileChaseParticipants,validateChaseBackup} from './chase';
import {installMaskReconciliationSchema,validateMaskReconciliations} from './mask-reconciliation';
import {installRuleReferenceSchema,readSceneRules,executeSceneRule,validateRuleReferences} from './rule-references';
import type {SceneRuleCommand} from '../rule-reference-contracts';
import {installSceneCheckSchema,readSceneChecks,executeSceneCheck,validateSceneChecks} from './scene-checks';
import type {SceneCheckCommand} from '../scene-check-contracts';
import type {ChaseCommand} from '../chase-contracts';
import type { CombatCommand } from '../combat-contracts';
import { installProgressSchema, createProgress, migrateProgress, readProgress, readProgressHistory, readLootBalance, readTreasures, readTreasure, readLedger, readLedgerInventory, readLedgerDetail, executeProgress, validateProgressBackup } from './progression';
import type { ProgressCommand, LedgerQuery, LedgerInventoryQuery } from '../progression';
import {readChronicle} from './chronicle';
import { installEncounterSchema, readEncounterPlan, readEncounterPlans, saveEncounterPlan } from './encounters';
import type { EncounterPlanCommand } from '../encounter-contracts';
import { readPresetRegistry,executePresetCommand,readPresetOutcome } from './preset-registry';
import { installGenerationSchema, readEncounterTables, readLootTables, readGeneratorRegistry, executeGeneration, generateEncounters, acceptGeneration, readGenerationRuns, readGenerationRun, rollLoot, validateGenerationBackup } from './generation';
import type { GenerationCommand, GenerationRequest, LootRollCommand } from '../generation-contracts';
import { installSessionSchema, readSession, executeSession, generateSession, regenerateSessionProposal,regenerateSessionReward, readSessionRuns, readSessionRun, validateSessionRuns, readWorldActor, scenePreparation, cleanSessionVisits } from './session';
import type { SessionCommand, SessionGenerationRequest } from '../session-contracts';

const noteTitleOrder = new Intl.Collator('de', {numeric: true, sensitivity: 'base'});
const json = (value: unknown) => JSON.stringify(value);
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const commandFingerprint = (command: object) => hash(json({ ...command, token: undefined }));
const matchesReceipt = (receipt: Row, command: object) => receipt.fingerprint === commandFingerprint(command) || receipt.fingerprint === hash(json(command));
type Row = Record<string, any>;

/** Only the privileged host owns this connection. All command guards run inside BEGIN IMMEDIATE. */
// Hash the source without retaining a second, potentially huge database in memory.
function snapshotDigest(filename:string){const fd=openSnapshot(filename,'r'),hash=createHash('sha256'),chunk=Buffer.allocUnsafe(65536);try{let n:number;while((n=readSync(fd,chunk,0,chunk.length,null))>0)hash.update(chunk.subarray(0,n));return hash.digest('hex');}finally{closeSnapshot(fd);}}

export class CampaignStore {
  private chronicleRead:ChronicleReadSession|null=null;
  private db: any;
  private committedSources=new CommittedSources();
  private shellFirstRoom=new WeakMap<object,{campaignId:string;stamp:string;id:string|null}>();
  private graphShadow:GraphShadow|null=null;
  private graphRouting=false;
  private withGraph<T>(fn:()=>T):T {const original=this.db;if(!this.graphShadow)return fn();this.db=this.graphShadow.db;this.graphRouting=true;try{return fn();}finally{this.db=original;this.graphRouting=false;}}

  private extensionRegistry:ExtensionRegistry;
  private backupEpoch=0;
  private active: { campaignId: string; token: string } | null = null;
  constructor(readonly filename: string, readonly applicationVersion = 'development') {
    if (typeof applicationVersion !== 'string' || !applicationVersion.trim() || applicationVersion.length > 128) throw new Error('Anwendungsversion fehlt.');
    mkdirSync(dirname(filename), { recursive: true });
    this.db = new Database(filename);
    const schema = this.db.pragma('user_version', { simple: true });
    if(schema>=53&&!this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='travel_checkpoint'").get()){this.db.close();throw Error('Reisecheckpoint-Speicher fehlt. Originaldaten bleiben erhalten.');}
    if(schema>0&&schema<50&&this.db.prepare("SELECT 1 FROM sqlite_master WHERE name='city_unit'").get()&&this.db.prepare("SELECT 1 FROM city_unit WHERE kind='building' LIMIT 1").get()){this.db.close();throw Error('Alter Haus-Testbestand: neue Kampagne anlegen. Originaldatei bleibt erhalten.');}
    if(schema>=50&&!this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='room_group'").get()){this.db.close();throw Error('Raumgruppenspeicher fehlt. Originaldaten bleiben erhalten.');}
    if (schema > 53) { this.db.close(); throw new Error('Diese Datenbank benötigt eine neuere Appversion.'); }
    if(schema>=51&&!this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='scene_opponent_group'").get()){this.db.close();throw Error('Szenengegner-Zuordnung fehlt. Originaldaten bleiben erhalten.');}
    if(schema>=49&&['atlas_territory','atlas_territory_layer'].some(table=>!this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table))){this.db.close();throw Error('Regionsspeicher fehlt. Originaldaten bleiben erhalten.');}
    if(schema>=44&&!this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='chase_working_draft'").get()){this.db.close();throw new Error('Verfolgungsentwurfsspeicher fehlt. Originaldaten bleiben erhalten.');}
    this.extensionRegistry=new ExtensionRegistry(this.db);
    const version = this.db.prepare('SELECT sqlite_version() v').get().v as string;
    if (version.localeCompare('3.53.4', undefined, { numeric: true }) < 0) { this.db.close(); throw new Error('SQLite-Wartungsstand zu alt.'); }
    this.db.pragma('foreign_keys=ON'); this.db.pragma('journal_mode=WAL'); this.db.pragma('synchronous=FULL'); this.db.pragma('secure_delete=ON'); this.db.pragma('busy_timeout=5000');


    this.db.exec(`
      CREATE TABLE IF NOT EXISTS campaign(id TEXT PRIMARY KEY, name TEXT NOT NULL, selected_id TEXT, cursor INTEGER NOT NULL DEFAULT 0) STRICT;
      CREATE TABLE IF NOT EXISTS scope(campaign_id TEXT NOT NULL REFERENCES campaign(id), id TEXT NOT NULL, name TEXT NOT NULL, PRIMARY KEY(campaign_id,id)) STRICT;
      CREATE TABLE IF NOT EXISTS room(campaign_id TEXT NOT NULL, id TEXT NOT NULL, scope_id TEXT NOT NULL, number TEXT NOT NULL, name TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT NOT NULL, checksum TEXT NOT NULL, PRIMARY KEY(campaign_id,id), FOREIGN KEY(campaign_id,scope_id) REFERENCES scope(campaign_id,id)) STRICT;
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
    this.db.exec('CREATE TABLE IF NOT EXISTS drawing_floor(campaign_id TEXT NOT NULL, scope_id TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, source_elevation REAL NOT NULL, PRIMARY KEY(campaign_id,scope_id,id), FOREIGN KEY(campaign_id,scope_id) REFERENCES scope(campaign_id,id)) STRICT;');
    this.db.exec('CREATE TABLE IF NOT EXISTS room_draft(campaign_id TEXT NOT NULL, room_id TEXT NOT NULL, payload TEXT NOT NULL, checksum TEXT NOT NULL, PRIMARY KEY(campaign_id,room_id), FOREIGN KEY(campaign_id,room_id) REFERENCES room(campaign_id,id)) STRICT;');
    if (schema < 3) this.db.transaction(() => {
      this.db.exec("ALTER TABLE room ADD COLUMN floor_id TEXT NOT NULL DEFAULT 'ground';");
      for (const row of this.db.prepare('SELECT campaign_id,bytes FROM source').all()) {
        const source = JSON.parse(row.bytes.toString('utf8'));
        for (const floor of source.floors) this.db.prepare('INSERT OR IGNORE INTO drawing_floor VALUES(?,?,?,?,?)').run(row.campaign_id, source.id, floor.id, floor.name, floor.elevation);
        for (const room of source.entities.filter((e: any) => e.kind === 'building')) this.db.prepare('UPDATE room SET floor_id=? WHERE campaign_id=? AND id=?').run(room.floorId, row.campaign_id, room.id);
      }
      for (const row of this.db.prepare('SELECT DISTINCT campaign_id,scope_id FROM room WHERE floor_id=\'ground\'').all()) this.db.prepare('INSERT OR IGNORE INTO drawing_floor VALUES(?,?,\'ground\',\'Erdgeschoss\',0)').run(row.campaign_id, row.scope_id);
      this.db.pragma('user_version=3');
    }).immediate();
    this.db.transaction(() => {
      this.db.exec(`CREATE TABLE IF NOT EXISTS location(campaign_id TEXT NOT NULL REFERENCES campaign(id), id TEXT NOT NULL, revision INTEGER NOT NULL, trashed INTEGER NOT NULL DEFAULT 0, payload TEXT NOT NULL, checksum TEXT NOT NULL, PRIMARY KEY(campaign_id,id)) STRICT;
        CREATE TABLE IF NOT EXISTS location_map(campaign_id TEXT NOT NULL, scope_id TEXT NOT NULL, location_id TEXT NOT NULL, PRIMARY KEY(campaign_id,scope_id), FOREIGN KEY(campaign_id,scope_id) REFERENCES scope(campaign_id,id), FOREIGN KEY(campaign_id,location_id) REFERENCES location(campaign_id,id)) STRICT;`);
      if (schema < 5) this.db.exec('ALTER TABLE campaign ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;');
      installLiveSchema(this.db);
      if (schema < 6) for (const row of this.db.prepare('SELECT id FROM campaign').all()) ensureLiveOwners(this.db, row.id);
      if (schema < 7) migrateLiveClock(this.db);
      if (schema < 8) this.db.exec('INSERT OR IGNORE INTO scene_lifecycle(campaign_id,id,membership_revision,retired) SELECT campaign_id,id,0,0 FROM live_scene;');
      installCombatSchema(this.db);installCombatDraftSchema(this.db);installChaseSchema(this.db);installMaskHistoryIndexes(this.db);installMaskReconciliationSchema(this.db);installRuleReferenceSchema(this.db);installSceneCheckSchema(this.db);
      installProgressSchema(this.db);
      if (schema < 10) migrateProgress(this.db);
      installEncounterSchema(this.db);
      installGenerationSchema(this.db);installNpcRecords(this.db);
      this.db.exec("CREATE TABLE IF NOT EXISTS preparation_draft(campaign_id TEXT NOT NULL REFERENCES campaign(id), kind TEXT NOT NULL CHECK(kind IN ('note','plan','location')), target_id TEXT NOT NULL, payload TEXT NOT NULL, checksum TEXT NOT NULL, PRIMARY KEY(campaign_id,kind,target_id)) STRICT;");
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
      installContentRuntime(this.db);installNarrative(this.db);installFinishDrafts(this.db);installSceneDesk(this.db);installTreasury(this.db);installGroups(this.db);installWorldRelationPairs(this.db);
      if(schema<41)migrateMaskHealth(this.db);
      installCampaignAtlas(this.db);installAtlasTravel(this.db);installLandscape(this.db);installTerritories(this.db);installRoomGroups(this.db);this.db.pragma('user_version=53');

    }).immediate();
    this.db.function('atlas_lower',{deterministic:true},(text:unknown)=>typeof text==='string'?text.normalize('NFC').toLocaleLowerCase('de'):'');
  }
  private reconcileAtlasGeometry(token:string){
    const cam=this.guard(token);
    if(!this.db.prepare("SELECT 1 FROM scene_position WHERE campaign_id=? AND (json_type(payload,'$.dungeon')='object' OR json_type(payload,'$.city')='object') LIMIT 1").get(cam)&&!['world_journey','dungeon_journey','atlas_local_journey'].some(table=>this.db.prepare("SELECT 1 FROM "+table+" WHERE campaign_id=? AND json_extract(payload,'$.status')='active' LIMIT 1").get(cam)))return;
    const root=atlasRoot(this.db,cam),geometry=dungeonGeometry(this.db,cam);
    // Reconcile spatial facts only; descriptions, perceptions and traces are consumers.
    const a={terrain:JSON.parse(this.db.prepare("SELECT payload FROM world_record WHERE campaign_id=? AND kind='map' AND id=?").get(cam,root.map_id).payload),bindings:atlasBindings(this.db,cam),cities:this.cities(token).cities.map(h=>this.city(token,h.id))};
    for(const row of this.db.prepare('SELECT * FROM scene_position WHERE campaign_id=?').all(cam)){
      const p=JSON.parse(row.payload),binding=p.dungeon?a.bindings.find(b=>b.kind==='dungeon'&&b.ownerId===p.dungeon.scopeId):p.city?a.bindings.find(b=>b.kind==='city'&&b.ownerId===p.city.cityId):null;
      if(!binding)continue;const point=localToAtlas(p.dungeon??p.city,atlasFrame(a,binding)),basis=hash(json(point));if(p.spatialBasis===basis)continue;
      const next={...p,...atlasHexAt(point,a.terrain.hexMeters),spatialBasis:basis,revision:p.revision+1},payload=json(next);this.db.prepare('UPDATE scene_position SET revision=?,payload=?,checksum=? WHERE campaign_id=? AND scene_id=?').run(next.revision,payload,hash(payload),cam,row.scene_id);
    }
    for(const table of ['world_journey','dungeon_journey','atlas_local_journey'])for(const row of this.db.prepare('SELECT * FROM '+table+' WHERE campaign_id=?').all(cam)){
      const j=JSON.parse(row.payload);if(j.status!=='active')continue;
      const stale=table==='world_journey'?j.environmentBasis!==travelEnvironmentBasis(this.db,cam,j.sceneId,j.mapId,readWorld(this.db,cam,false),j.usePartyPace):table==='dungeon_journey'?j.basis!==dungeonGeometryBasis(geometry,j.request.destination.scopeId):j.basis!==atlasLocalGeometryBasis(a);
      if(!stale)continue;j.status='paused';j.reason='Atlasgeometrie geändert. Reise vor Fortsetzung neu planen.';j.revision++;const payload=json(j);
      this.db.prepare('UPDATE '+table+' SET '+(table==='world_journey'?"status='paused',":'')+(table!=='atlas_local_journey'?'revision=?,':'')+'payload=?,checksum=? WHERE campaign_id=? AND '+(table==='atlas_local_journey'?'scene_id':'id')+'=?').run(...(table!=='atlas_local_journey'?[j.revision]:[]),payload,hash(payload),cam,table==='atlas_local_journey'?j.sceneId:j.id);
    }
  }
  private coupleAtlasWall(c:AtlasCommand,before:Room,elements:import('../drawing-contracts').DrawingElement[]){
    const binding=atlasBindings(this.db,c.campaignId).find(b=>b.kind==='dungeon'&&b.ownerId===before.scopeId);if(!binding)return;
    const after=this.workspace().rooms.find(r=>r.id===before.id);if(!after)return;
    const pairs:{before:import('../contracts').Point;after:import('../contracts').Point}[]=[];
    before.polygons.forEach((p,pi)=>{const n=after.polygons[pi];if(p.outer.length===n?.outer.length)p.outer.forEach((v,i)=>{const next=n.outer[i]!;if(v.x!==next.x||v.y!==next.y)pairs.push({before:v,after:next});});});if(!pairs.length)return;
    const move=(p:import('../contracts').Point)=>{const match=pairs.find(v=>Math.hypot(v.before.x-p.x,v.before.y-p.y)<1e-7);return match?{...match.after}:p;};
    const ring=(points:import('../contracts').Point[])=>points.flatMap((a,i)=>{const b=points[(i+1)%points.length]!,dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy;return [a,...pairs.map(p=>p.before).filter(p=>{const t=((p.x-a.x)*dx+(p.y-a.y)*dy)/(l||1);return t>1e-7&&t<1-1e-7&&Math.abs((p.x-a.x)*dy-(p.y-a.y)*dx)<1e-7;}).sort((p,q)=>((p.x-q.x)*dx+(p.y-q.y)*dy))].map(move);});
    const changedRooms=new Map<string,{before:Room;after:Room}>([[before.id,{before,after}]]);
    for(const r of this.workspace().rooms.filter(r=>r.scopeId===before.scopeId&&r.floorId===before.floorId&&r.id!==before.id)){
      const polygons=r.polygons.map(p=>({outer:ring(p.outer),holes:p.holes.map(ring)}));if(JSON.stringify(polygons)!==JSON.stringify(r.polygons)){changedRooms.set(r.id,{before:r,after:{...r,polygons}});this.edit({commandId:c.commandId+':shared-wall:'+r.id,token:c.token,campaignId:c.campaignId,roomId:r.id,expectedRevision:r.revision,name:r.name,sections:r.sections,polygons});}
    }
    for(const original of elements.filter(e=>e.anchor&&changedRooms.has(e.anchor.roomId)&&!e.archived)){
      const changed=changedRooms.get(original.anchor!.roomId)!,oldRing=changed.before.polygons[original.anchor!.polygon]?.outer;if(!oldRing)continue;
      const start=oldRing[original.anchor!.edge],end=oldRing[(original.anchor!.edge+1)%oldRing.length];if(!start||!end)continue;
      const a=move(start),b=move(end),point={x:a.x+(b.x-a.x)*original.anchor!.t,y:a.y+(b.y-a.y)*original.anchor!.t},anchor=nearestAnchor(point,changed.after);if(!anchor)continue;
      const current=this.drawing(c.token).elements.find(e=>e.id===original.id);if(!current)continue;
      this.executeDrawing({commandId:c.commandId+':anchor:'+original.id,token:c.token,campaignId:c.campaignId,action:{kind:'element',expectedRevision:current.revision,element:{...current,roomId:changed.after.id,anchor:{roomId:anchor.roomId,polygon:anchor.polygon,edge:anchor.edge,t:anchor.t},points:[point]}}});
    }
  }
  private travelAtlas(token:string){const a=this.campaignAtlas(token),p=atlasPartyPoint(a)??{x:0,y:0};a.terrain.landscape=landscapeRegion(this.db,a.campaignId,{x:p.x-6000,y:p.y-6000,width:12000,height:12000});return a;}
  previewAtlasTravel(token:string,destination:import('../contracts').Point){return previewAtlasLocal(this.travelAtlas(token),destination);}
  private applyAtlasTravel(c:import('../atlas-travel-contracts').AtlasTravelCommand){this.guard(c.token,c.campaignId);executeAtlasTravel(this.db,c,{
    read:()=>this.travelAtlas(c.token),
    advance:(seconds,revision)=>{this.executeLive({commandId:c.commandId+':clock',token:c.token,campaignId:c.campaignId,action:{kind:'advance-clock',sceneId:c.sceneId,expectedRevision:revision,amount:seconds,unit:'seconds',calendarVersion:'relative-v1',reason:'Bestätigte lokale Atlasbewegung'}});},
    location:id=>{const s=this.liveScene(c.token,c.sceneId);if(s.locationId!==id)this.executeLive({commandId:c.commandId+':location',token:c.token,campaignId:c.campaignId,action:{kind:'scene-content',sceneId:c.sceneId,expectedRevision:s.revision,title:s.title,notes:s.notes,readAloud:s.readAloud??'',locationId:id}});},
    crossing:(from,to)=>{const g=dungeonGeometry(this.db,c.campaignId),scene=this.liveScene(c.token,c.sceneId);createTriggerEvents(this.db,c.campaignId,g,{id:'atlas:'+c.commandId,nextIndex:1,request:{sceneId:c.sceneId}},from,to,scene.clock.instantMs);},
    dungeon:pose=>{const d=this.dungeon(c.token);this.executeDungeon({commandId:c.commandId+':dungeon',token:c.token,campaignId:c.campaignId,action:{kind:'place',sceneId:c.sceneId,expectedPositionRevision:d.positionRevision,pose}});}
   });}
  executeAtlasTravel(c:import('../atlas-travel-contracts').AtlasTravelCommand){this.applyAtlasTravel(c);return this.campaignAtlas(c.token);}
  executeAtlasTravelCommit(c:import('../atlas-travel-contracts').AtlasTravelCommand):import('../atlas-travel-contracts').AtlasTravelCommit{this.applyAtlasTravel(c);return{campaignId:c.campaignId,commandId:c.commandId,sceneId:c.sceneId};}
  atlasVegetationScene(token:string,box:import('../atlas-landscape').LandscapeBox,mpp:number){const cam=this.guard(token);return {...vegetationScene(this.db,cam,box,mpp,atlasRoot(this.db,cam).revision),fence:this.atlasRegionSource(token).fence};}
  atlasSpatialScene(token:string,box:import('../atlas-landscape').LandscapeBox,mpp:number,draft?:import('../spatial-terrain').SpatialTerrainDraft,fence?:string){
    const cam=this.guard(token),source=this.atlasRegionSource(token);
    if(fence!==undefined&&source.fence!==fence)throw Error('Gelände inzwischen geändert. Entwurf verwerfen und erneut zeichnen.');
    return {...vegetationScene(this.db,cam,box,mpp,atlasRoot(this.db,cam).revision,{draft}),fence:source.fence};
  }
  atlasHeight(token:string,point:import('../contracts').Point){
    const cam=this.guard(token);
    if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)||Math.max(Math.abs(point.x),Math.abs(point.y))>1e12)throw Error('Höhenpunkt prüfen.');
    const nearby=terrainRegion(this.db,cam,{x:point.x-1,y:point.y-1,width:2,height:2}),step=Math.max(1,...nearby.filter(r=>r.height).map(r=>r.resolution));
    const records=terrainRegion(this.db,cam,{x:point.x-step,y:point.y-step,width:step*2,height:step*2});
    return {...new TerrainSampler(records).query(point),revision:atlasRoot(this.db,cam).revision};
  }
  atlasMaskRegion(token:string,box:import('../atlas-landscape').LandscapeBox){
    const cam=this.guard(token);
    if(!box||![box.x,box.y,box.width,box.height,box.x+box.width,box.y+box.height].every(Number.isFinite)||box.width<=0||box.height<=0)throw Error('Pinselbereich prüfen.');
    const bytes=this.db.prepare('SELECT coalesce(sum(length(payload)),0) n FROM atlas_landscape WHERE campaign_id=? AND max_x>=? AND min_x<=? AND max_y>=? AND min_y<=?').get(cam,box.x,box.x+box.width,box.y,box.y+box.height) as {n:number};
    if(bytes.n>16*1024*1024)throw Error('Pinselbereich zu groß. In kürzeren Zügen bearbeiten.');
    return{revision:atlasRoot(this.db,cam).revision,records:terrainRegion(this.db,cam,box,true)};
  }
  landscapeFind(token:string,text:string){const cam=this.guard(token);if(typeof text!=='string'||text.length>200)throw new Error('Suchtext prüfen.');return this.db.prepare("SELECT payload FROM atlas_landscape WHERE campaign_id=? AND json_extract(payload,'$.kind')!='patch' AND (instr(lower(json_extract(payload,'$.name')),lower(?))>0 OR json_extract(payload,'$.locationId')=?) LIMIT 100").all(cam,text,text).map((r:any)=>JSON.parse(r.payload)) as import('../atlas-landscape').LandscapeRecord[];}
  landscapeRegion(token:string,box:import('../atlas-landscape').LandscapeBox,metersPerPixel=0,includePatches=true){const cam=this.guard(token);return {revision:atlasRoot(this.db,cam).revision,records:landscapeRegion(this.db,cam,box,metersPerPixel,includePatches)};}
  registerReference(token:string,mime:string,bytes:Buffer){const cam=this.guard(token),id=hash(bytes);this.db.prepare('INSERT OR IGNORE INTO atlas_reference_asset VALUES(?,?,?,?)').run(cam,id,mime,bytes);return id;}
  referenceAssetSource(token:string,id:string){const r=this.db.prepare('SELECT mime,bytes FROM atlas_reference_asset WHERE campaign_id=? AND id=?').get(this.guard(token),id);if(!r)throw new Error('Referenzbild fehlt.');return r as {mime:string;bytes:Buffer};}
  atlasIdentity(token:string) {
    const campaignId=this.guard(token);
    return {campaignId,token,revision:atlasRoot(this.db,campaignId).revision};
  }
  atlasOverview(token:string):import('../campaign-atlas-contracts').AtlasOverview {
    const cam=this.guard(token);
    return this.db.transaction(()=>{
      const root=atlasRoot(this.db,cam), b=this.db.prepare("SELECT min(min_x) x,max(max_x) xmax,min(min_y) y,max(max_y) ymax FROM atlas_landscape WHERE campaign_id=? AND json_extract(payload,'$.terrainSettings') IS NULL").get(cam);
      return {campaignId:cam,token,revision:root.revision,...atlasHistoryState(this.db,cam),
        counts:{rooms:this.db.prepare("SELECT count(*) n FROM room r WHERE campaign_id=? AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=r.campaign_id AND h.id=r.id AND h.kind='room' AND h.hidden=1) AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=r.campaign_id AND h.id=r.floor_id AND h.scope_id=r.scope_id AND h.kind='floor' AND h.hidden=1)").get(cam).n,cities:this.db.prepare('SELECT count(*) n FROM city_document WHERE campaign_id=?').get(cam).n,landscape:this.db.prepare('SELECT count(*) n FROM atlas_landscape WHERE campaign_id=?').get(cam).n},
        landscapeBounds:b.x===null?null:{x:b.x,y:b.y,width:b.xmax-b.x,height:b.ymax-b.y}};
    })();
  }
  atlasObjects(token:string,q:import('../campaign-atlas-contracts').AtlasObjectQuery):import('../campaign-atlas-contracts').AtlasObjectPage {
    const cam=this.guard(token);
    if(!q||!['room','city','landscape','scope'].includes(q.kind)||typeof q.text!=='string'||q.text.length>200||!Number.isSafeInteger(q.limit)||q.limit<1||q.limit>200)throw new Error('Atlassuche prüfen.');
    const fence=this.committedSources.version(this.db);
    const page=this.db.transaction(()=>{
      const revision=atlasRoot(this.db,cam).revision,c=q.cursor;
      if(c&&(c.token!==token||c.fence!==fence||!Number.isSafeInteger(c.revision)||c.revision!==revision||c.kind!==q.kind||c.text!==q.text||typeof c.after!=='string'))throw new Error('Atlassuche inzwischen geändert. Suche erneut beginnen.');
      const text=q.text.normalize('NFC').toLocaleLowerCase('de'), room=q.kind==='room';
      const sql=q.kind==='scope'?`SELECT id,name,0 revision FROM scope WHERE campaign_id=? AND id>? AND instr(atlas_lower(name),?)>0 ORDER BY id LIMIT ?`:q.kind==='landscape'?`SELECT a.id,a.revision,coalesce(json_extract(l.payload,'$.name'),json_extract(a.payload,'$.name')) name FROM atlas_landscape a LEFT JOIN location l ON l.campaign_id=a.campaign_id AND l.id=json_extract(a.payload,'$.locationId') WHERE a.campaign_id=? AND a.id>? AND json_extract(a.payload,'$.kind')!='patch' AND coalesce(l.trashed,0)=0 AND instr(atlas_lower(coalesce(json_extract(l.payload,'$.name'),json_extract(a.payload,'$.name'))),?)>0 ORDER BY a.id LIMIT ?`:room?`SELECT r.id,r.name,r.number,r.revision,r.scope_id scopeId,r.floor_id floorId FROM room r WHERE r.campaign_id=? AND r.id>? AND instr(atlas_lower(r.name||' '||r.number),?)>0 AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=r.campaign_id AND h.id=r.id AND h.kind='room' AND h.hidden=1) AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=r.campaign_id AND h.id=r.floor_id AND h.scope_id=r.scope_id AND h.kind='floor' AND h.hidden=1) ORDER BY r.id LIMIT ?`:`SELECT id,json_extract(payload,'$.name') name,revision FROM city_document WHERE campaign_id=? AND id>? AND instr(atlas_lower(json_extract(payload,'$.name')),?)>0 ORDER BY id LIMIT ?`;
      const items=this.db.prepare(sql).all(cam,c?.after??'',text,q.limit+1),more=items.length>q.limit;items.length=Math.min(q.limit,items.length);
      return{campaignId:cam,token,revision,items,next:more?{token,fence,revision,after:items.at(-1)!.id,kind:q.kind,text:q.text}:null};
    })();
    if(this.committedSources.version(this.db)!==fence)throw new Error('Atlassuche inzwischen geändert. Suche erneut beginnen.');
    return page;
  }
  atlasLandscapeObject(token:string,id:string):import('../atlas-landscape').LandscapeRecord {
    const cam=this.guard(token);
    if(typeof id!=='string'||!id)throw new Error('Landschaftskennung prüfen.');
    const row=this.db.prepare("SELECT a.payload,l.payload location,l.trashed FROM atlas_landscape a LEFT JOIN location l ON l.campaign_id=a.campaign_id AND l.id=json_extract(a.payload,'$.locationId') WHERE a.campaign_id=? AND a.id=?").get(cam,id);
    if(!row||row.trashed)throw new Error('Landschaftsobjekt nicht gefunden.');
    const record=JSON.parse(row.payload);if(row.location)record.name=JSON.parse(row.location).name;
    return record;
  }
  atlasRoom(token:string,id:string):Room {
    if(this.graphShadow&&!this.graphRouting)return this.withGraph(()=>this.atlasRoom(token,id));
    const cam=this.guard(token);
    if(typeof id!=='string'||!id)throw new Error('Raumkennung prüfen.');
    const row=this.db.prepare('SELECT * FROM room WHERE campaign_id=? AND id=?').get(cam,id);
    if(!row)throw new Error('Raum nicht gefunden.');
    return this.decode(row);
  }
  atlasRoomCommit(edit:Edit):import('../contracts').RoomCommit {
    this.applyAtlas({commandId:edit.commandId,token:edit.token,campaignId:edit.campaignId,action:{kind:'room-edit',edit}});
    return{...this.edit(edit),atlasRevision:atlasRoot(this.db,edit.campaignId).revision};
  }
  atlasDrawingCommit(command:DrawingCommand){
    this.applyAtlas({commandId:command.commandId,token:command.token,campaignId:command.campaignId,action:{kind:'drawing',command}});
    // The Atlas receipt already checked replay; read back the same complete author inventory.
    return {workspace:this.workspace(),view:this.dungeonAuthoring(command.token).drawing,atlasRevision:atlasRoot(this.db,command.campaignId).revision};
  }
  executeAtlasCommit(c:AtlasCommand):import('../campaign-atlas-contracts').AtlasCommitAck {
    const value=this.applyAtlas(c) as {id?:string}|undefined;
    const root=atlasRoot(this.db,c.campaignId);
    return {campaignId:c.campaignId,commandId:c.commandId,revision:root.revision,...(typeof value?.id==='string'?{result:{id:value.id}}:{}),...atlasHistoryState(this.db,c.campaignId)};
  }
  atlasRegionSource(token:string,cursor?:import('../atlas-region-contracts').AtlasRegionCursor):AtlasRegionSource {
    const campaignId=this.guard(token),preview=this.graphShadow,version=this.committedSources.version(this.db),shadowVersion=preview?this.committedSources.version(preview.db):undefined;
    const changes=atlasReadChanges(this.db,campaignId,cursor);
    const shadowChanges=preview?atlasReadChanges(preview.db,campaignId,cursor?.shadow):undefined;
    const shadow=preview&&shadowChanges?{filename:preview.db.name,scopeId:preview.scopeId,epoch:shadowChanges.epoch,sequence:shadowChanges.sequence}:undefined;
    const fingerprint=[this.db.name,version,changes.epoch,changes.sequence,shadow,shadowVersion,preview?.state()];
    const revision=atlasRoot(this.db,campaignId).revision;
    if(this.committedSources.version(this.db)!==version||preview&&this.committedSources.version(preview.db)!==shadowVersion)throw new Error('Atlas inzwischen geändert. Ausschnitt erneut laden.');
    return{filename:this.db.name,campaignId,token,...changes,shadow,reset:changes.reset||!!shadowChanges?.reset,changes:[...changes.changes,...(shadowChanges?.changes??[])],fence:hash(JSON.stringify(fingerprint)),revision};
  }
  atlasCitySite(token:string,cityId:string,id?:string):import('../atlas-region-contracts').AtlasCitySite{return this.db.transaction(()=>{
    const cam=this.guard(token),site=id?readCitySite(this.db,cam,cityId,id):{header:readCityHeader(this.db,cam,cityId),unit:null};
    const related=(site.unit?.nodeIds??[]).map(n=>readCitySite(this.db,cam,cityId,n).unit);
    const faction=site.unit?.factionId?this.db.prepare('SELECT id,payload,checksum FROM world_note WHERE campaign_id=? AND id=?').get(cam,site.unit.factionId):null;
    const factions=faction&&hash(faction.payload)===faction.checksum?[{id:faction.id,name:JSON.parse(faction.payload).title}]:[];
    return{...site,related,factions,...atlasHistoryState(this.db,cam)};
  })();}
  workspaceInitial(token:string):WorkspaceGeometry {
    if(this.graphShadow&&!this.graphRouting)return this.withGraph(()=>this.workspaceInitial(token));
    const cam=this.guard(token),shell=this.workspaceShell();let rooms:import('../contracts').RoomGeometry[]=[];const problems:WorkspaceGeometry['problems']=[];
    if(shell.selectedId)try{const {sections:unused,...room}=this.atlasRoom(token,shell.selectedId);rooms=[room];}catch(error){problems.push({id:shell.selectedId,number:'',message:(error as Error).message});}
    return{...shell,geometryCoverage:'selected',rooms,problems,floors:this.db.prepare('SELECT id,scope_id scopeId,name,source_elevation sourceElevation FROM drawing_floor WHERE campaign_id=?').all(cam)};
  }
  atlasRegionView(token:string,region:AtlasRegionGeometry,withPerception=false):AtlasRegionView {
    const cam=this.guard(token);if(region.token!==token||region.campaignId!==cam||region.fence!==this.atlasRegionSource(token).fence)throw new Error('Atlas inzwischen geändert. Ausschnitt erneut laden.');
    return this.db.transaction(()=>{
      const root=atlasRoot(this.db,cam),workspace={...this.workspaceShell(),rooms:region.rooms,floors:region.floors,problems:[]},geometry=dungeonMapView(this.db,cam,workspace,region.drawing);
      // Perception retains its exact canonical reader; viewport geometry never supplies rule truth.
      const exact=withPerception&&geometry.position?{...roomGeometries(this.db,cam),floors:this.db.prepare("SELECT f.id,f.scope_id scopeId,f.name,f.source_elevation elevation FROM drawing_floor f WHERE campaign_id=? AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=f.campaign_id AND h.id=f.id AND h.scope_id=f.scope_id AND h.kind='floor' AND h.hidden=1)").all(cam),drawing:drawingView(this.db,cam,true)}:null;
      const perception=exact&&geometry.sceneId?dungeonDisplay(this.db,cam,geometry.sceneId,playerSettings(this.db,cam),playerObservers(this.db,cam).list,exact):null;
      const row=this.db.prepare("SELECT json_remove(payload,'$.cells','$.landscape') payload FROM world_record WHERE campaign_id=? AND kind='map' AND id=?").get(cam,root.map_id),terrain=JSON.parse(row.payload);
      const {rooms:unusedRooms,floors:unusedFloors,drawing:unusedDrawing,cities:unusedCities,bindings:unusedBindings,scopes:unusedScopes,...coverage}=region;
      const bindings=[...region.bindings],frames=Object.assign(Object.create(null),region.frames),scene=geometry.sceneId?readAtlasScene(this.db,cam,geometry.sceneId):null;
      // Party placement and the 'to party' action remain exact even outside the loaded viewport.
      const owner=geometry.position?{kind:'dungeon',id:geometry.position.scopeId}:scene?.position.city?{kind:'city',id:scene.position.city.cityId}:null;
      if(owner){const row=this.db.prepare('SELECT * FROM atlas_binding WHERE campaign_id=? AND kind=? AND owner_id=?').get(cam,owner.kind,owner.id);
       if(row&&!bindings.some(b=>b.id===row.id)){
        const b:import('../campaign-atlas-contracts').AtlasBinding={id:row.id,kind:row.kind,ownerId:row.owner_id,parent:row.parent,parentId:row.parent_id,x:row.x,y:row.y,angle:row.angle,revision:row.revision};
        if(b.parent==='world'){bindings.push(b);frames[b.id]={x:b.x,y:b.y,angle:b.angle};}
        else{const unit=this.db.prepare('SELECT city_id FROM city_unit WHERE campaign_id=? AND id=?').get(cam,b.parentId),parent=unit?this.db.prepare("SELECT * FROM atlas_binding WHERE campaign_id=? AND kind='city' AND owner_id=?").get(cam,unit.city_id):null;
         if(unit&&parent){const site=readCitySite(this.db,cam,unit.city_id,b.parentId!),u=site.unit;if(u.position){const p=localToAtlas(u.position,parent),pose={...p,angle:parent.angle+(u.angle??0)},point=localToAtlas(b,pose);bindings.push(b);frames[b.id]={...point,angle:pose.angle+b.angle};}}
        }
       }
      }
      const result:AtlasRegionView={campaignId:cam,revision:root.revision,workspace,geometry,terrain,perception,scopes:region.scopes,cities:region.cities,bindings,region:{...coverage,frames},
       entrances:atlasEntrances(this.db,cam),localJourney:geometry.sceneId?atlasLocalJourney(this.db,cam,geometry.sceneId):null,scene,...atlasHistoryState(this.db,cam)};
      if(Buffer.byteLength(JSON.stringify(result))>REGION_ACTIVE_BYTES)throw new Error('Laufender Atlas-Kontext überschreitet das aktive Darstellungsbudget. Exakte Fachansicht verwenden.');
      return result;
    })();
  }
  atlasRenderView(token:string):import('../campaign-atlas-contracts').AtlasRenderView {
    const cam=this.guard(token);return this.db.transaction(()=>{
      const root=atlasRoot(this.db,cam),workspace=this.workspaceGeometry(token),drawing=this.graphShadow?this.withGraph(()=>drawingView(this.db,cam,true)):undefined,geometry=dungeonMapView(this.db,cam,workspace,drawing);
      geometry.rooms=workspace.rooms;
      const perception=geometry.position&&geometry.sceneId?dungeonDisplay(this.db,cam,geometry.sceneId,playerSettings(this.db,cam),playerObservers(this.db,cam).list,geometry):null;
      return{scopes:this.db.prepare('SELECT id,name FROM scope WHERE campaign_id=?').all(cam),perception,entrances:atlasEntrances(this.db,cam),localJourney:geometry.sceneId?atlasLocalJourney(this.db,cam,geometry.sceneId):null,campaignId:cam,revision:root.revision,terrain:JSON.parse(this.db.prepare("SELECT payload FROM world_record WHERE campaign_id=? AND kind='map' AND id=?").get(cam,root.map_id).payload),bindings:atlasBindings(this.db,cam),cities:this.cities(token).cities.map(h=>this.city(token,h.id)),geometry,workspace,scene:geometry.sceneId?this.sceneWorld(token,geometry.sceneId):null,...atlasHistoryState(this.db,cam)};
    })();
  }
  campaignAtlas(token:string):CampaignAtlas{
    const cam=this.guard(token);return this.db.transaction(()=>{
      const root=atlasRoot(this.db,cam),terrain=JSON.parse(this.db.prepare("SELECT payload FROM world_record WHERE campaign_id=? AND kind='map' AND id=?").get(cam,root.map_id).payload);
      if(!terrain)throw new Error('Kampagnenatlas fehlt.');
      const geometry=this.dungeon(token),scene=geometry.sceneId?this.sceneWorld(token,geometry.sceneId):null;
      const perception=geometry.position&&geometry.sceneId?dungeonDisplay(this.db,cam,geometry.sceneId,playerSettings(this.db,cam),playerObservers(this.db,cam).list):null;
      return{scopes:this.db.prepare('SELECT id,name FROM scope WHERE campaign_id=?').all(cam),perception,entrances:atlasEntrances(this.db,cam),localJourney:geometry.sceneId?atlasLocalJourney(this.db,cam,geometry.sceneId):null,campaignId:cam,revision:root.revision,terrain,bindings:atlasBindings(this.db,cam),cities:this.cities(token).cities.map(h=>this.city(token,h.id)),geometry,workspace:this.workspace(),scene,...atlasHistoryState(this.db,cam)};
    })();
  }
  atlasTerritories(token:string,box?:import("../atlas-landscape").LandscapeBox){return readTerritories(this.db,this.guard(token),box);}
  executeAtlas(c:AtlasCommand){
    const result=this.applyAtlas(c);
    return {atlas:this.campaignAtlas(c.token),result};
  }
  private applyAtlas(c:AtlasCommand){
    this.guard(c.token,c.campaignId);
    if(c.sourceFence!==undefined&&(typeof c.sourceFence!=='string'||!this.db.prepare('SELECT 1 FROM atlas_receipt WHERE command_id=?').get(c.commandId)&&this.atlasRegionSource(c.token).fence!==c.sourceFence))throw new Error('Atlas inzwischen geändert. Ausschnitt vor dem Zeichnen erneut laden.');
    let landscapeEnvironment=false;
    const landscapeOnly=typeof c.action?.kind==='string'&&c.action.kind.startsWith('landscape-');
    const nested=(v:{token:string;campaignId:string;commandId:string})=>{if(v.token!==c.token||v.campaignId!==c.campaignId||v.commandId!==c.commandId)throw new Error('Atlasbefehl gehört zu einem anderen Kontext.');};
    const result=executeAtlasWrite(this.db,c,()=>{
      const a=c.action,cam=c.campaignId;
      if(a.kind==='territory-layer'||a.kind==='territory-put'||a.kind==='territory-remove'||a.kind==='territory-stroke'||a.kind==='territory-vertex')return executeTerritory(this.db,cam,a);
      if(a.kind==='landscape-route'||a.kind==='landscape-terrain-style'||a.kind==='landscape-vegetation-edit'||a.kind==='landscape-height-stroke'||a.kind==='landscape-sea-level'||a.kind==='landscape-land-stroke'||a.kind==='landscape-color-stroke'||a.kind==='landscape-brush'||a.kind==='landscape-batch'||a.kind==='landscape-put'||a.kind==='landscape-reset'||a.kind==='landscape-remove'||a.kind==='landscape-place'){
        if(a.kind==='landscape-place')this.commitPreparation({commandId:c.commandId+':key',token:c.token,campaignId:cam,change:{kind:'location',document:a.document,expectedRevision:a.expectedLocationRevision}});
        const physical=(kind: string | undefined)=>kind!==undefined&&['patch','road','river','vegetation'].includes(kind);
        const wasPhysical=(id: string)=>physical(this.db.prepare("SELECT json_extract(payload,'$.kind') kind FROM atlas_landscape WHERE campaign_id=? AND id=?").get(cam,id)?.kind);
        landscapeEnvironment=a.kind==='landscape-terrain-style'?false:a.kind==='landscape-vegetation-edit'||a.kind==='landscape-height-stroke'||a.kind==='landscape-sea-level'||a.kind==='landscape-land-stroke'||a.kind==='landscape-color-stroke'||a.kind==='landscape-brush'||a.kind==='landscape-reset'||(a.kind==='landscape-remove'?wasPhysical(a.id):a.kind==='landscape-batch'?(a.records.some(x=>physical(x.record.kind)||wasPhysical(x.record.id))||(a.remove??[]).some(x=>wasPhysical(x.id))):physical(a.record.kind)||wasPhysical(a.record.id));
        executeLandscape(this.db,cam,a);
        if(a.kind==='landscape-place'){const root=atlasRoot(this.db,cam),m=JSON.parse(this.db.prepare("SELECT payload FROM world_record WHERE campaign_id=? AND kind='map' AND id=?").get(cam,root.map_id).payload),old=this.db.prepare('SELECT revision FROM atlas_place WHERE campaign_id=? AND location_id=?').get(cam,a.document.id);this.executeWorld({commandId:c.commandId+':place',token:c.token,campaignId:cam,action:{kind:'place',mapId:m.id,locationId:a.document.id,expectedRevision:old?.revision??null,hex:atlasHexAt(a.point??a.record.points[0]!,m.hexMeters)}});}

        const row=this.db.prepare("SELECT * FROM world_record WHERE campaign_id=? AND kind='map' AND id=?").get(cam,atlasRoot(this.db,cam).map_id),m=JSON.parse(row.payload);m.revision++;const payload=json(m);this.db.prepare("UPDATE world_record SET revision=?,payload=?,checksum=? WHERE campaign_id=? AND kind='map' AND id=?").run(m.revision,payload,hash(payload),cam,m.id);return;
      }
      if(a.kind==='room-default')return this.addRoom(c.token,true);
      if(a.kind==='drawing-import'){
        const doc=JSON.parse(a.source),ids=new Map<string,string>();
        const id=(s:string)=>{if(!ids.has(s))ids.set(s,randomUUID());return ids.get(s)!;};
        for(const r of a.rooms){id(r.scopeId);id(r.floorId);id(r.id);for(const section of r.sections)id(section.id);}
        for(const f of doc.floors??[])id(f.id);if(doc.id)id(doc.id);
        const rewrite=(v:any):any=>typeof v==='string'?(ids.get(v)??v):Array.isArray(v)?v.map(rewrite):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,v])=>[k,rewrite(v)])):v;
        const scopes=new Set(a.rooms.map(r=>r.scopeId));
        for(const original of scopes){const scopeId=id(original);this.db.prepare('INSERT INTO scope VALUES(?,?,?)').run(cam,scopeId,a.name);
          const floors=new Map((doc.floors??[]).filter((f:any)=>Number.isFinite(f.elevation)).map((f:any)=>[f.id,{id:id(f.id),name:f.name,elevation:f.elevation}]));
          for(const r of a.rooms.filter(r=>r.scopeId===original))if(!floors.has(r.floorId))floors.set(r.floorId,{id:id(r.floorId),name:'Geschoss',elevation:0});
          for(const f of floors.values() as Iterable<{id:string;name:string;elevation:number}>)this.db.prepare('INSERT INTO drawing_floor VALUES(?,?,?,?,?)').run(cam,scopeId,f.id,f.name,f.elevation);
          bindAtlas(this.db,cam,{id:randomUUID(),kind:'dungeon',ownerId:scopeId,parent:'world',parentId:null,x:a.x,y:a.y,angle:0,revision:0},null);
        }
        for(const original of a.rooms){const room=rewrite(original) as Room;validateRoom(room);this.insertRoom(cam,room);}
        this.db.prepare('INSERT INTO atlas_import_source VALUES(?,?,?,?)').run(cam,c.commandId,a.source,hash(a.source));
        return{roomId:a.rooms.length?id(a.rooms[0]!.id):null};
      }
      if(a.kind==='graph-accept'){nested(a.command);if(a.command.action.kind!=='accept')throw new Error('Nur bestätigte Graphübernahme.');return this.executeGraph(a.command);}
      if(a.kind==='world'){nested(a.command);if(a.command.action.kind==='map'&&a.command.action.map.id!==atlasRoot(this.db,cam).map_id)throw new Error('Jede Kampagne besitzt genau einen Atlas. Inhalte in die bestehende Welt einfügen.');return this.executeWorld(a.command);}
      if(a.kind==='drawing'){nested(a.command);const action=a.command.action,before=action.kind==='shape'?this.workspace().rooms.find(r=>r.id===action.roomId):null,elements=before?this.drawing(c.token).elements:[];const result=this.executeDrawing(a.command);if(before)this.coupleAtlasWall(c,before,elements);return result;}
      if(a.kind==='room-edit'){nested(a.edit);const before=this.atlasRoom(c.token,a.edit.roomId),elements=before?this.drawing(c.token).elements:[];const result=this.edit(a.edit);if(before)this.coupleAtlasWall(c,before,elements);return result;}
      if(a.kind==='city'){nested(a.command);const before=a.command.action.kind==='change'?this.city(c.token,a.command.cityId):null;
        if(a.command.action.kind==='change')for(const id of a.command.action.remove)removeGeneratedGroup(this.db,cam,id,a.command.action.removeGroups===true);
        const result=this.executeCity(a.command);
        if(a.command.action.kind==='change')for(const u of a.command.action.upsert)if(u.kind==='building'&&!this.db.prepare('SELECT 1 FROM scope WHERE campaign_id=? AND id=?').get(cam,u.id)){
          storeGroupDraft(this.db,cam,u.id,u.name||u.use||'Gebäude',groupRecipeForHouse(u));
          const locationId=this.db.prepare('SELECT location_id FROM city_document WHERE campaign_id=? AND id=?').get(cam,a.command.cityId).location_id;
          this.db.prepare('INSERT INTO location_map VALUES(?,?,?)').run(cam,u.id,locationId);
          bindAtlas(this.db,cam,{id:randomUUID(),kind:'dungeon',ownerId:u.id,parent:'building',parentId:u.id,x:0,y:0,angle:0,revision:0},null);
          refreshGroupHull(this.db,cam,u.id,u.protected);
        }
        // Building pose is inherited by its interiors. Scale their local geometry
        // in the very same command, retaining heights and room IDs/text.
        const oldUnits=new Map(before?.units.map(u=>[u.id,u])??[]),houseBindings=new Map(atlasBindings(this.db,cam).filter(b=>b.parent==='building').map(b=>[b.parentId,b]));
        if(before&&a.command.action.kind==='change')for(const u of a.command.action.upsert){const old=oldUnits.get(u.id),binding=houseBindings.get(u.id);if(!old?.outline||!u.outline||!binding)continue;
          const bounds=(p:{x:number;y:number}[])=>({x:Math.max(...p.map(p=>p.x))-Math.min(...p.map(p=>p.x)),y:Math.max(...p.map(p=>p.y))-Math.min(...p.map(p=>p.y))}),o=bounds(old.outline),n=bounds(u.outline),sx=n.x/o.x,sy=n.y/o.y;
          if(!Number.isFinite(sx+sy)||sx<=0||sy<=0)throw new Error('Ungültige Gebäudeskalierung.');
          if(u.outline.length!==old.outline.length||u.outline.some((p,i)=>Math.abs(p.x-old.outline![i]!.x*sx)>1e-6||Math.abs(p.y-old.outline![i]!.y*sy)>1e-6))throw Error('Gebäudeform an den gemeinsamen Räumen bearbeiten.');
          if(Math.abs(sx-sy)>1e-7)throw Error('Die gesamte Raumgruppe proportional skalieren.');
          if(Math.abs(sx-1)>1e-7)scaleRoomGroup(this.db,cam,binding.ownerId,sx);
        }
        if(a.command.action.kind==='change')for(const u of a.command.action.upsert)if(u.kind==='building'){this.db.prepare('UPDATE scope SET name=? WHERE campaign_id=? AND id=?').run(u.name||u.use||'Gebäude',cam,u.id);refreshGroupHull(this.db,cam,u.id,u.protected);}
        return result;
      }
      if(a.kind==='entrance'){putAtlasEntrance(this.db,this.campaignAtlas(c.token),a.entrance);return;}
      if(a.kind==='bind'){bindAtlas(this.db,cam,a.binding,a.expectedRevision);return;}
      if(a.kind==='city-create'){
        const id=randomUUID(),locationId=randomUUID();this.commitPreparation({commandId:c.commandId+':location',token:c.token,campaignId:cam,change:{kind:'location',document:newLocation(locationId,a.name,'city',[randomUUID(),randomUUID()]),expectedRevision:null}});
        this.executeCity({commandId:c.commandId+':city',token:c.token,campaignId:cam,cityId:id,expectedRevision:0,action:{kind:'create',header:{id,locationId,revision:1,name:a.name,width:a.width,height:a.height,paper:'#e9dfc8',roof:'#9c604c'}}});
        bindAtlas(this.db,cam,{id:randomUUID(),kind:'city',ownerId:id,parent:'world',parentId:null,x:a.x,y:a.y,angle:0,revision:0},null);const root=this.campaignAtlas(c.token);this.executeWorld({commandId:c.commandId+':anchor',token:c.token,campaignId:cam,action:{kind:'place',locationId,mapId:root.terrain.id,expectedRevision:null,hex:atlasHexAt({x:a.x,y:a.y},root.terrain.hexMeters)}});return{id};
      }
      if(a.kind==='group-room-split')return splitGroupRoom(this.db,cam,a.roomId,a.expectedRevision,a.axis,a.ratio);
      if(a.kind==='group-scale'){scaleRoomGroup(this.db,cam,a.scopeId,a.factor);return;}
      if(a.kind==='group-generate'){
        if(typeof a.name!=='string'||!a.name.trim())throw Error('Name benötigt.');
        const id=randomUUID(),locationId=randomUUID();
        storeGroupDraft(this.db,cam,id,a.name,a.recipe);
        this.commitPreparation({commandId:c.commandId+':location',token:c.token,campaignId:cam,change:{kind:'location',document:newLocation(locationId,a.name,'poi',[randomUUID(),randomUUID()]),expectedRevision:null}});
        this.db.prepare('INSERT INTO location_map VALUES(?,?,?)').run(cam,id,locationId);
        bindAtlas(this.db,cam,{id:randomUUID(),kind:'dungeon',ownerId:id,parent:'world',parentId:null,x:a.x,y:a.y,angle:0,revision:0},null);return{id};
      }
      if(a.kind==='dungeon-create'){
        const id=randomUUID();if(!a.name.trim())throw new Error('Name benötigt.');
        this.db.prepare('INSERT INTO scope VALUES(?,?,?)').run(cam,id,a.name);this.db.prepare('INSERT INTO drawing_floor VALUES(?,?,?,?,?)').run(cam,id,'ground','Erdgeschoss',0);
        if('buildingId' in a)throw Error('Gebäude besitzen bereits dieselbe Raumgruppe. Direkt Räume bearbeiten.');
        const locationId=randomUUID();this.commitPreparation({commandId:c.commandId+':location',token:c.token,campaignId:cam,change:{kind:'location',document:newLocation(locationId,a.name,'poi',[randomUUID(),randomUUID()]),expectedRevision:null}});
        this.db.prepare('INSERT INTO location_map VALUES(?,?,?)').run(cam,id,locationId);
        bindAtlas(this.db,cam,{id:randomUUID(),kind:'dungeon',ownerId:id,parent:'world',parentId:null,x:a.x,y:a.y,angle:0,revision:0},null);return{id};
      }
      if(a.kind==='room-create'){
        if(!this.db.prepare('SELECT 1 FROM drawing_floor WHERE campaign_id=? AND scope_id=? AND id=?').get(cam,a.scopeId,a.floorId))throw new Error('Geschoss fehlt.');
        const room:Room={id:randomUUID(),scopeId:a.scopeId,floorId:a.floorId,name:a.name,number:String(this.db.prepare('SELECT count(*) n FROM room WHERE campaign_id=?').get(cam).n+1),revision:0,polygons:a.polygons,sections:[{id:randomUUID(),kind:'markdown',markdown:''}]};validateRoom(room);this.insertRoom(cam,room);return{id:room.id};
      }
    },()=>{
      if(!landscapeOnly){refreshChangedGroupHulls(this.db,c.campaignId,!['city','group-generate','dungeon-create','drawing-import'].includes(c.action.kind));this.reconcileAtlasGeometry(c.token);return;}
      if(!landscapeEnvironment)return;
      // Terrain cannot move an indoor actor or change a room boundary. It can
      // invalidate outdoor routes; pause them atomically without loading rooms.
      for(const table of ['world_journey','atlas_local_journey'])for(const row of this.db.prepare('SELECT rowid,payload FROM '+table+' WHERE campaign_id=?').all(c.campaignId)){
        const journey=JSON.parse(row.payload);if(!['active','paused'].includes(journey.status))continue;
        journey.status='paused';journey.reason='Atlaslandschaft geändert. Reise vor Fortsetzung neu planen.';journey.revision++;
        const payload=json(journey);
        if(table==='world_journey')this.db.prepare("UPDATE world_journey SET status='paused',revision=?,payload=?,checksum=? WHERE rowid=?").run(journey.revision,payload,hash(payload),row.rowid);
        else this.db.prepare('UPDATE atlas_local_journey SET payload=?,checksum=? WHERE rowid=?').run(payload,hash(payload),row.rowid);
      }
    },!landscapeOnly);return result;
  }
  extensionPreview(bytes:Buffer){return this.extensionRegistry.preview(bytes);}
  extensions(after:string|null){return this.extensionRegistry.list(after);}
  executeExtension(command:ExtensionCommand){return this.extensionRegistry.execute(command);}
  extensionOutcome(command:ExtensionCommand){return this.extensionRegistry.outcome(command);}
  close() {this.chronicleRead?.close();this.chronicleRead=null; this.extensionRegistry.dispose();this.committedSources.close();this.graphShadow?.dispose();this.graphShadow=null;this.db.close(); }
  list(): { campaigns: Campaign[]; activeId: string | null } {
    return { campaigns: this.db.prepare('SELECT c.id,c.name,c.revision FROM campaign c JOIN campaign_lifecycle l ON l.campaign_id=c.id WHERE l.trashed=0 ORDER BY c.name,c.id').all(), activeId: this.db.prepare("SELECT value FROM settings WHERE key='active'").get()?.value ?? null };
  }
  create(name: string, rooms: Room[] = [], source?: Buffer): Campaign {
    if (typeof name !== 'string' || !name.trim() || name.length > 1000) throw new Error('Bitte einen Kampagnennamen eingeben.');
    const campaign = { id: randomUUID(), name, revision: 0 };
    this.db.transaction(() => {
      this.db.prepare('INSERT INTO campaign(id,name) VALUES(?,?)').run(campaign.id, name);noteCampaignCreated(this.db,campaign.id);
      this.db.prepare('INSERT INTO campaign_lifecycle VALUES(?,0,0)').run(campaign.id);
      ensureLiveOwners(this.db, campaign.id);createCampaignAtlas(this.db,campaign.id);
      const scopes = new Set(rooms.map(r => r.scopeId)); scopes.add('local');
      for (const id of scopes) this.db.prepare('INSERT INTO scope VALUES(?,?,?)').run(campaign.id, id, 'Dungeon');
      this.db.prepare("UPDATE scope SET name='Neue Zeichnung' WHERE campaign_id=? AND id='local'").run(campaign.id);
      this.db.prepare("INSERT INTO drawing_floor VALUES(?,'local','ground','Erdgeschoss',0)").run(campaign.id);
      if (source) {
        const document = JSON.parse(source.toString('utf8'));
        this.db.prepare('UPDATE scope SET name=? WHERE campaign_id=? AND id=?').run(document.settings.name, campaign.id, document.id);
        for (const floor of document.floors) this.db.prepare('INSERT INTO drawing_floor VALUES(?,?,?,?,?)').run(campaign.id, document.id, floor.id, floor.name, floor.elevation);
      }
      for (const room of rooms) this.db.prepare('INSERT OR IGNORE INTO drawing_floor VALUES(?,?,?,?,0)').run(campaign.id, room.scopeId, room.floorId, 'Geschoss');
      for (const scopeId of scopes)this.db.prepare('INSERT INTO atlas_binding VALUES(?,?,?,?,?,?,?,?,?,?)').run(campaign.id,randomUUID(),'dungeon',scopeId,'world',null,0,0,0,1);
      for (const room of rooms) { validateRoom(room); this.insertRoom(campaign.id, room); }
      if (source) this.db.prepare('INSERT INTO source VALUES(?,?,?)').run(campaign.id, source, hash(source));
    }).immediate();
    return campaign;
  }
  private insertRoom(campaignId: string, room: Room) {
    const payload = json({ polygons: room.polygons, sections: room.sections });
    this.db.prepare('INSERT INTO room VALUES(?,?,?,?,?,?,?,?,?)').run(campaignId, room.id, room.scopeId, room.number, room.name, 0, payload, hash(payload), room.floorId);
  }
  activate(campaignId: string): Workspace {this.activateShell(campaignId);return this.workspace();}
  activateShell(campaignId:string):WorkspaceShell {this.chronicleRead?.close();this.chronicleRead=null;
    if(this.graphShadow&&this.graphShadow.campaignId!==campaignId)throw new Error('Offene Graphvorschau zuerst übernehmen oder Ursprung wiederherstellen.');
    if (!this.db.prepare('SELECT c.id FROM campaign c JOIN campaign_lifecycle l ON l.campaign_id=c.id WHERE c.id=? AND l.trashed=0').get(campaignId)) throw new Error('Kampagne nicht gefunden.');
    this.active = { campaignId, token: randomUUID() };
    this.db.transaction(()=>{this.db.prepare("INSERT INTO settings VALUES('active',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(campaignId);noteCampaignOpened(this.db,campaignId);}).immediate();
    return this.workspaceShell();
  }
  private guard(token: string, campaignId = this.active?.campaignId) {
    if (!this.active || token !== this.active.token || campaignId !== this.active.campaignId) throw new Error('Diese Eingabe gehört zu einer früheren Kampagnenaktivierung.');
    if(!this.db.prepare('SELECT campaign_id FROM campaign_lifecycle WHERE campaign_id=? AND trashed=0').get(this.active.campaignId))throw new Error('Kampagne befindet sich im Papierkorb.');
    return this.active.campaignId;
  }
  private decode(row: Row): Room {
    if (hash(row.payload) !== row.checksum) throw new Error(`Raum ${row.number}: Datenprüfung fehlgeschlagen. Originaldaten bleiben erhalten.`);
    const content = JSON.parse(row.payload);
    if (!content || typeof content !== 'object' || Array.isArray(content) || Object.keys(content).length !== 2 || !Object.hasOwn(content, 'polygons') || !Object.hasOwn(content, 'sections')) throw new Error('Raumpayload hat ein unbekanntes Format. Originaldaten bleiben erhalten.');
    validateRoom({ name: row.name, ...content });
    return { id: row.id, scopeId: row.scope_id, floorId: row.floor_id, number: row.number, name: row.name, revision: row.revision, ...content };
  }
  private checkedHistory(entry: Row, room: Pick<Room, 'id' | 'scopeId' | 'floorId' | 'number'>): { before: Room; after: Room } {
    if (!entry || entry.room_id !== room.id || !Number.isSafeInteger(entry.ordinal) || entry.ordinal < 1 || !Number.isSafeInteger(entry.guard_revision) || entry.guard_revision < 0) throw new Error('Raumhistory ist beschädigt. Originaldaten bleiben erhalten.');
    const before = JSON.parse(entry.before_json) as Room, after = JSON.parse(entry.after_json) as Room;
    for (const value of [before, after]) {
      // Display keys may change independently of this geometry/text snapshot.
      // Identity belongs to the room ID and its scope, never its current number.
      if (!value || value.id !== room.id || value.scopeId !== room.scopeId || value.floorId !== room.floorId || typeof value.number !== 'string' || !Number.isSafeInteger(value.revision) || value.revision < 0) throw new Error('Raumhistory zeigt nicht auf ihren ursprünglichen Raum. Originaldaten bleiben erhalten.');
      validateRoom(value);
    }
    if (after.revision !== before.revision + 1) throw new Error('Raumhistory besitzt keine gültige Revisionsfolge.');
    return { before, after };
  }
  private decodeRoomDraft(row: Row): WorkingRoomDraft {
    if (hash(row.payload) !== row.checksum) throw new Error('Arbeitsentwurf ist beschädigt. Originalbytes bleiben erhalten.');
    const draft = JSON.parse(row.payload) as WorkingRoomDraft;
    if (!draft || draft.room?.id !== row.room_id || typeof draft.room.scopeId !== 'string' || typeof draft.room.floorId !== 'string' || typeof draft.room.number !== 'string' || !Number.isSafeInteger(draft.room.revision) || draft.room.revision < 0 || typeof draft.room.name !== 'string' || !Array.isArray(draft.room.polygons) || !Array.isArray(draft.room.sections) || typeof draft.points !== 'string' || typeof draft.pointsChanged !== 'boolean' || !Object.hasOwn(draft, 'failedEdit')) throw new Error('Arbeitsentwurf hat einen ungültigen Ziel-/Feldvertrag. Originalbytes bleiben erhalten.');
    if (draft.failedEdit !== null && (!draft.failedEdit || draft.failedEdit.campaignId !== row.campaign_id || draft.failedEdit.roomId !== row.room_id || typeof draft.failedEdit.commandId !== 'string' || !draft.failedEdit.commandId || !Number.isSafeInteger(draft.failedEdit.expectedRevision) || draft.failedEdit.expectedRevision < 0)) throw new Error('Arbeitsentwurf enthält einen fremden Änderungsauftrag.');
    try {
      validateRoomDraftContent(draft.room);
      if (draft.failedEdit !== null) {
        if (typeof draft.failedEdit.token !== 'string') throw new Error('Aktivierungsbindung fehlt.');
        validateRoom(draft.failedEdit);
      }
    } catch (error) { throw new Error('Arbeitsentwurf enthält ungültige Raumdaten. Originalbytes bleiben erhalten: ' + (error as Error).message); }
    return draft;
  }
  private decodePreparationDraft(row: Row): PreparationDraft {
    if (hash(row.payload) !== row.checksum) throw new Error('Vorbereitungsentwurf ist beschädigt. Originalbytes bleiben erhalten.');
    const draft = checkedPreparationDraft(JSON.parse(row.payload)), target = preparationTarget(draft.change);
    if (target.kind !== row.kind || target.id !== row.target_id || draft.failedCommand && draft.failedCommand.campaignId !== row.campaign_id) throw new Error('Vorbereitungsentwurf gehört zu einem anderen Ziel.');
    return draft;
  }
  private preparationDraftTable(kind: PreparationEdit['kind']) {
    if (!['note', 'plan', 'location'].includes(kind)) throw new Error('Unbekanntes Entwurfsziel.');
    return kind === 'note' ? 'world_note' : kind;
  }
  preparationDraft(token: string, kind: PreparationEdit['kind'], id: string): PreparationDraft | null {
    const campaignId = this.guard(token); this.preparationDraftTable(kind);
    const row = this.db.prepare('SELECT * FROM preparation_draft WHERE campaign_id=? AND kind=? AND target_id=?').get(campaignId, kind, id);
    return row ? this.decodePreparationDraft(row) : null;
  }
  keepPreparationDrafts(token: string, drafts: PreparationDraft[]) {
    if (!Array.isArray(drafts)) throw new Error('Ungültige Entwurfsliste.');
    this.db.transaction(() => {
      const campaignId = this.guard(token), targets = new Set<string>();
      for (const value of drafts) {
        const draft = checkedPreparationDraft(value), target = preparationTarget(draft.change), table = this.preparationDraftTable(target.kind);
        const key = json(target);
        if (targets.has(key)) throw new Error('Doppeltes Entwurfsziel.'); targets.add(key);
        if (!this.db.prepare(`SELECT 1 FROM ${table} WHERE campaign_id=? AND id=?`).get(campaignId, target.id)) throw new Error('Entwurfsziel nicht vorhanden.');
        const old = this.db.prepare('SELECT * FROM preparation_draft WHERE campaign_id=? AND kind=? AND target_id=?').get(campaignId, target.kind, target.id);
        if (old) {
          const existing = this.decodePreparationDraft(old);
          if(draft.change.kind==='note'&&draft.change.excerpt&&existing.writeId!==draft.writeId&&(!draft.failedCommand||existing.failedCommand?.commandId!==draft.failedCommand.commandId))throw new Error('Ein anderer Arbeitsentwurf dieses Originals bleibt erhalten.');
          if (existing.writeId === draft.writeId && json(existing) !== json(draft)) throw new Error('Entwurfskennung bereits anders verwendet.');
        }
        const payload = json(draft), checksum = hash(payload);
        this.decodePreparationDraft({ campaign_id: campaignId, kind: target.kind, target_id: target.id, payload, checksum });
        this.db.prepare('INSERT INTO preparation_draft(campaign_id,kind,target_id,payload,checksum) VALUES(?,?,?,?,?) ON CONFLICT(campaign_id,kind,target_id) DO UPDATE SET payload=excluded.payload,checksum=excluded.checksum').run(campaignId, target.kind, target.id, payload, checksum);
      }
    }).immediate();
  }
  discardPreparationDraft(token: string, kind: PreparationEdit['kind'], id: string, writeId: string) {
    this.db.transaction(() => {
      const campaignId = this.guard(token); this.preparationDraftTable(kind);
      const row = this.db.prepare('SELECT * FROM preparation_draft WHERE campaign_id=? AND kind=? AND target_id=?').get(campaignId, kind, id);
      if (!row) return;
      if (typeof writeId !== 'string' || this.decodePreparationDraft(row).writeId !== writeId) throw new Error('Der Entwurf wurde inzwischen geändert.');
      this.db.prepare('DELETE FROM preparation_draft WHERE campaign_id=? AND kind=? AND target_id=?').run(campaignId, kind, id);
    }).immediate();
  }
  private decodeLocation(row: Row, checksumError = 'Ortsprüfung fehlgeschlagen.') {
    if (hash(row.payload) !== row.checksum) throw new Error(checksumError);
    const document=checkedLocationDocument(JSON.parse(row.payload));
    if(document.id!==row.id||!Number.isSafeInteger(row.revision)||row.revision<1)throw new Error("Ortszuordnung widersprüchlich.");
    return document;
  }
  workspaceShell():WorkspaceShell {
    if(this.graphShadow&&!this.graphRouting)return this.withGraph(()=>this.workspaceShell());
    if(!this.active)throw new Error('Bitte eine Kampagne öffnen.');
    const {campaignId,token}=this.active;this.guard(token);
    return this.db.transaction(()=>{
      const campaign=this.db.prepare('SELECT * FROM campaign WHERE id=?').get(campaignId);
      const valid=this.db.prepare(`SELECT r.id FROM room r WHERE ${visibleRoomWhere} AND r.id=?`).get(campaignId,campaign.selected_id);
      let first=valid;
      if(!first){
        // This internal cache also runs inside write transactions and must see uncommitted edits.
        const stamp=JSON.stringify([this.db.prepare('SELECT total_changes() n').get().n,this.db.pragma('data_version',{simple:true})]),cached=this.shellFirstRoom.get(this.db);
        if(cached?.campaignId===campaignId&&cached.stamp===stamp)first=cached.id?{id:cached.id}:null;
        else{for(const row of this.db.prepare(`SELECT r.id,r.number FROM room r WHERE ${visibleRoomWhere}`).iterate(campaignId))if(!first||roomOrder(row,first)<0)first=row;this.shellFirstRoom.set(this.db,{campaignId,stamp,id:first?.id??null});}
      }
      return{graphPreview:this.graphShadow?.state(),campaign:{id:campaign.id,name:campaign.name,revision:campaign.revision},token,selectedId:first?.id??null,
        canUndo:!!this.db.prepare('SELECT 1 FROM history WHERE campaign_id=? AND ordinal=?').get(campaignId,campaign.cursor),
        canRedo:!!this.db.prepare('SELECT 1 FROM history WHERE campaign_id=? AND ordinal=?').get(campaignId,campaign.cursor+1)};
    })();
  }
  workspaceGeometry(token:string):WorkspaceGeometry {
    if(this.graphShadow&&!this.graphRouting)return this.withGraph(()=>this.workspaceGeometry(token));
    const cam=this.guard(token);
    return this.db.transaction(()=>({...this.workspaceShell(),...roomGeometries(this.db,cam),floors:this.db.prepare(`SELECT f.id,f.scope_id scopeId,f.name,f.source_elevation sourceElevation FROM drawing_floor f WHERE f.campaign_id=? AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=f.campaign_id AND h.id=f.id AND h.scope_id=f.scope_id AND h.kind='floor' AND h.hidden=1) ORDER BY source_elevation,id`).all(cam)}))();
  }
  roomReadSource(token:string,q?:RoomDirectoryQuery):{filename:string;campaignId:string;token:string;fence:string}{
    if(this.graphShadow&&!this.graphRouting)return this.withGraph(()=>this.roomReadSource(token,q));
    const campaignId=this.guard(token),filename=this.db.name;
    const fence=hash(JSON.stringify([filename,this.committedSources.version(this.db),this.graphShadow?.state()??null]));
    if(q){roomDirectoryQuery(q);if(q.cursor&&(q.cursor.token!==token||q.cursor.fence!==fence))throw new Error('Raumsuche inzwischen geändert. Suche erneut beginnen.');}
    return{filename,campaignId,token,fence};
  }
  workspace(): Workspace {
    if(this.graphShadow&&!this.graphRouting)return this.withGraph(()=>this.workspace());
    if (!this.active) throw new Error('Bitte eine Kampagne öffnen.');
    return this.db.transaction(() => {
      const active = this.active!;
      const campaign = this.db.prepare('SELECT * FROM campaign WHERE id=?').get(active.campaignId);
      const rooms: Room[] = [], problems: Workspace['problems'] = [];
      for (const row of this.db.prepare(`SELECT r.* FROM room r WHERE r.campaign_id=? AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=r.campaign_id AND h.id=r.id AND h.kind='room' AND h.hidden=1) AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=r.campaign_id AND h.id=r.floor_id AND h.scope_id=r.scope_id AND h.kind='floor' AND h.hidden=1) ORDER BY number,id`).all(active.campaignId)) {
        try { rooms.push(this.decode(row)); } catch (error) { problems.push({ id: row.id, number: row.number, message: (error as Error).message }); }
      }
      rooms.sort((a,b)=>roomNumberOrder.compare(a.number,b.number)||a.id.localeCompare(b.id));
      const floors = this.db.prepare(`SELECT f.id,f.scope_id AS scopeId,f.name,f.source_elevation AS sourceElevation FROM drawing_floor f WHERE f.campaign_id=? AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=f.campaign_id AND h.id=f.id AND h.scope_id=f.scope_id AND h.kind='floor' AND h.hidden=1) ORDER BY source_elevation,id`).all(active.campaignId);
      return { graphPreview:this.graphShadow?.state(),campaign: { id: campaign.id, name: campaign.name, revision: campaign.revision }, token: active.token, rooms, problems, floors, selectedId: rooms.some(r => r.id === campaign.selected_id) ? campaign.selected_id : rooms[0]?.id ?? null,
        canUndo: !!this.db.prepare('SELECT 1 FROM history WHERE campaign_id=? AND ordinal=?').get(campaign.id, campaign.cursor),
        canRedo: !!this.db.prepare('SELECT 1 FROM history WHERE campaign_id=? AND ordinal=?').get(campaign.id, campaign.cursor + 1) };
    })();
  }
  select(token: string, id: string) {
    if(this.graphShadow&&!this.graphRouting)return this.withGraph<void>(()=>this.select(token,id));
    const campaignId = this.guard(token);
    if (!this.db.prepare('SELECT 1 FROM room WHERE campaign_id=? AND id=?').get(campaignId, id)) throw new Error('Raum nicht gefunden.');
    this.db.prepare('UPDATE campaign SET selected_id=? WHERE id=?').run(id, campaignId);
  }
  addRoom(token: string,atlasInternal=false): Workspace {
    if(!atlasInternal){const cam=this.guard(token);return this.executeAtlas({commandId:randomUUID(),token,campaignId:cam,action:{kind:'room-default'}}).atlas.workspace;}
    if(this.graphShadow&&!this.graphRouting)return this.withGraph(()=>this.addRoom(token));
    this.db.transaction(() => {
      const campaignId = this.guard(token);
      const n = this.db.prepare('SELECT count(*) n FROM room WHERE campaign_id=?').get(campaignId).n + 1;
      const current=this.workspace(),selected=current.rooms.find(r=>r.id===current.selectedId);
      const scopeId=selected?.scopeId??this.db.prepare('SELECT value FROM settings WHERE key=?').get('default-scope:'+campaignId)?.value??'local',floorId=selected?.floorId??this.db.prepare('SELECT id FROM drawing_floor WHERE campaign_id=? AND scope_id=? ORDER BY rowid LIMIT 1').get(campaignId,scopeId)?.id??'ground';
      // A default room is immediately usable geometry, not an overlapping placeholder.
      const bounds=(r:Room)=>{let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const p of r.polygons)for(const v of p.outer){minX=Math.min(minX,v.x);minY=Math.min(minY,v.y);maxX=Math.max(maxX,v.x);maxY=Math.max(maxY,v.y);}return{minX,minY,maxX,maxY};};
      const grid=1.524,width=4*grid,height=3*grid,anchor=selected?bounds(selected):null,y=anchor?Math.round(anchor.minY/grid)*grid:0;
      let x=anchor?Math.ceil((anchor.maxX+grid)/grid-1e-8)*grid:0;
      const occupied=current.rooms.filter(r=>r.scopeId===scopeId&&r.floorId===floorId).map(bounds).sort((a,b)=>a.minX-b.minX);
      for(const b of occupied)if(y<b.maxY+grid&&y+height>b.minY-grid&&x<b.maxX+grid&&x+width>b.minX-grid)x=Math.ceil((b.maxX+grid)/grid-1e-8)*grid;
      const room: Room = { id: randomUUID(), scopeId, floorId, name: 'Neuer Raum', number: String(n), revision: 0, polygons: [{ outer: [{ x, y }, { x:x+width, y }, { x:x+width, y:y+height }, { x, y:y+height }], holes: [] }], sections: [{ id: randomUUID(), kind: 'markdown', markdown: '' }] };
      validateRoom(room);
      if(atlasBindings(this.db,campaignId).some(b=>b.ownerId===scopeId&&b.parent==='building')){this.insertRoom(campaignId,room);this.db.prepare('UPDATE campaign SET selected_id=? WHERE id=?').run(room.id,campaignId);}
      else this.executeDrawing({commandId:randomUUID(),token,campaignId,action:{kind:'create-room',scopeId,floorId,name:room.name,polygons:room.polygons}});
    }).immediate();
    return this.workspace();
  }
  edit(edit: Edit): RoomCommit {
    if(this.graphShadow&&!this.graphRouting)return this.withGraph(()=>this.edit(edit));
    validateRoom(edit);
    if (typeof edit.commandId !== 'string' || !edit.commandId || !Number.isSafeInteger(edit.expectedRevision)) throw new Error('Ungültiger Änderungsauftrag.');
    const fingerprint = commandFingerprint(edit);
    this.db.transaction(() => {
      const campaignId = this.guard(edit.token, edit.campaignId);
      const receipt = this.db.prepare('SELECT * FROM receipt WHERE command_id=?').get(edit.commandId);
      if (receipt) { if (receipt.campaign_id !== campaignId || !matchesReceipt(receipt, edit)) throw new Error('Änderungskennung bereits anders verwendet.'); return; }
      const before = this.decode(this.db.prepare('SELECT * FROM room WHERE campaign_id=? AND id=?').get(campaignId, edit.roomId) ?? {});
      if (before.revision !== edit.expectedRevision) throw new Error('Konflikt: Der Raum wurde inzwischen geändert. Entwurf bleibt offen.');
      if (json(before.sections.map(s => [s.id, s.kind, s.doorId])) !== json(edit.sections.map(s => [s.id, s.kind, s.doorId]))) throw new Error('Abschnittsbindungen dürfen bei Textbearbeitung nicht geändert werden.');
      const after = { ...before, name: edit.name, polygons: edit.polygons, sections: edit.sections, revision: before.revision + 1 };
      const cursor = this.db.prepare('SELECT cursor FROM campaign WHERE id=?').get(campaignId).cursor;
      this.writeRoom(campaignId, after);
      this.db.prepare('DELETE FROM history WHERE campaign_id=? AND ordinal>?').run(campaignId, cursor);
      this.db.prepare('INSERT INTO history VALUES(?,?,?,?,?,?)').run(campaignId, cursor + 1, before.id, json(before), json(after), after.revision);
      this.db.prepare('UPDATE campaign SET cursor=? WHERE id=?').run(cursor + 1, campaignId);
      this.db.prepare('INSERT INTO receipt VALUES(?,?,?,?,?)').run(edit.commandId, fingerprint, campaignId, before.id, after.revision);
      this.db.prepare('DELETE FROM room_draft WHERE campaign_id=? AND room_id=?').run(campaignId, before.id);
    }).immediate();
    return this.db.transaction(() => {
      const campaignId = this.guard(edit.token, edit.campaignId), cursor = this.db.prepare('SELECT cursor FROM campaign WHERE id=?').get(campaignId).cursor;
      return { room: this.decode(this.db.prepare('SELECT * FROM room WHERE campaign_id=? AND id=?').get(campaignId, edit.roomId)), token: edit.token,
        canUndo: !!this.db.prepare('SELECT 1 FROM history WHERE campaign_id=? AND ordinal=?').get(campaignId, cursor),
        canRedo: !!this.db.prepare('SELECT 1 FROM history WHERE campaign_id=? AND ordinal=?').get(campaignId, cursor + 1) };
    })();
  }
  private writeRoom(campaignId: string, room: Room) {
    const payload = json({ polygons: room.polygons, sections: room.sections });
    this.db.prepare('UPDATE room SET name=?,revision=?,payload=?,checksum=? WHERE campaign_id=? AND id=?').run(room.name, room.revision, payload, hash(payload), campaignId, room.id);
  }
  history(token: string, direction: 'undo' | 'redo'): Workspace {
    if(this.graphShadow&&!this.graphRouting)return this.withGraph(()=>this.history(token,direction));
    if (direction !== 'undo' && direction !== 'redo') throw new Error('Ungültige Historyaktion.');
    this.db.transaction(() => {
      const campaignId = this.guard(token), cursor = this.db.prepare('SELECT cursor FROM campaign WHERE id=?').get(campaignId).cursor;
      const ordinal = direction === 'undo' ? cursor : cursor + 1;
      const entry = this.db.prepare('SELECT * FROM history WHERE campaign_id=? AND ordinal=?').get(campaignId, ordinal);
      if (!entry) return;
      if(drawingHistory(this.db,campaignId,ordinal,direction)){this.db.prepare('UPDATE campaign SET cursor=? WHERE id=?').run(direction==='undo'?cursor-1:cursor+1,campaignId);return;}
      const row = this.db.prepare('SELECT * FROM room WHERE campaign_id=? AND id=?').get(campaignId, entry.room_id);
      if (!row) throw new Error('Raumhistory enthält ein fehlendes Ziel. Originaldaten bleiben erhalten.');
      const current = this.decode(row);
      if (current.revision !== entry.guard_revision) throw new Error('Undo-Konflikt: Raumrevision stimmt nicht mehr.');
      const values = this.checkedHistory(entry, current);
      const target = direction === 'undo' ? values.before : values.after;
      validateRoom(target); target.revision = current.revision + 1; this.writeRoom(campaignId, target);
      this.db.prepare('UPDATE history SET guard_revision=? WHERE campaign_id=? AND ordinal=?').run(target.revision, campaignId, ordinal);
      rebaseDrawingRoomHistory(this.db,campaignId,current.id,ordinal,direction);
      // Earlier/later deltas of the same causal group now expect this monotonically newer revision.
      const neighbor = this.db.prepare(`SELECT ordinal FROM history WHERE campaign_id=? AND room_id=? AND ordinal ${direction === 'undo' ? '<' : '>'} ? ORDER BY ordinal ${direction === 'undo' ? 'DESC' : 'ASC'} LIMIT 1`).get(campaignId, entry.room_id, ordinal);
      if (neighbor) this.db.prepare('UPDATE history SET guard_revision=? WHERE campaign_id=? AND ordinal=?').run(target.revision, campaignId, neighbor.ordinal);
      this.db.prepare('UPDATE campaign SET cursor=?,selected_id=? WHERE id=?').run(direction === 'undo' ? cursor - 1 : cursor + 1, current.id, campaignId);
    }).immediate();
    return this.workspace();
  }
  private validateDatabase(db: any) {
    if(db.pragma('user_version',{simple:true})>=51&&!db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='scene_opponent_group'").get())throw Error('Szenengegner-Zuordnung fehlt.');
    validateCampaignAtlases(db);
    for(const row of db.prepare("SELECT value FROM settings WHERE key LIKE 'session-recap:%'").iterate())checkedSessionRecapDraft(JSON.parse(row.value));
    for(const row of db.prepare('SELECT campaign_id,scene_id FROM live_moment_draft').iterate())readLiveMomentDraft(db,row.campaign_id,row.scene_id);
    validateExtensionSettings(db);
    validateCapabilityBytes(db);
    validateCampaignOrigins(db);
    if (db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length) throw new Error('Wiederherstellungskopie ist strukturell beschädigt.');
    for (const row of db.prepare('SELECT * FROM room').iterate()) this.decode(row);
    const headers = new Map<string, Pick<Room, 'id' | 'scopeId' | 'floorId' | 'number'>>();
    for (const entry of db.prepare('SELECT * FROM history').iterate()) {
      if(db.prepare('SELECT 1 FROM drawing_history WHERE campaign_id=? AND ordinal=?').get(entry.campaign_id,entry.ordinal))continue;
      const key = json([entry.campaign_id, entry.room_id]);
      let header = headers.get(key);
      if (!header) {
        const row = db.prepare('SELECT id,scope_id AS scopeId,floor_id AS floorId,number FROM room WHERE campaign_id=? AND id=?').get(entry.campaign_id, entry.room_id);
        if (!row) throw new Error('Raumhistory enthält ein fehlendes Ziel.');
        header = row; headers.set(key, header!);
      }
      this.checkedHistory(entry, header!);
    }
    for (const row of db.prepare('SELECT * FROM room_draft').iterate()) this.decodeRoomDraft(row);
    for (const row of db.prepare('SELECT * FROM preparation_draft').iterate()) {
      const draft = this.decodePreparationDraft(row), target = preparationTarget(draft.change), table = this.preparationDraftTable(target.kind);
      if (!db.prepare(`SELECT 1 FROM ${table} WHERE campaign_id=? AND id=?`).get(row.campaign_id, target.id)) throw new Error('Vorbereitungsentwurf hat ein fehlendes Ziel.');
    }
    validateNoteSourceHistory(db);
    for (const row of db.prepare('SELECT * FROM world_note').iterate()) checkedWorldNoteRow(row, 'Beschädigte Notiz im Backupkandidaten.');
    for (const row of db.prepare('SELECT * FROM location').iterate()) this.decodeLocation(row, 'Beschädigter Ort im Backupkandidaten.');
    for (const row of db.prepare('SELECT campaign_id,id FROM plan').iterate()) this.readPlan(row.campaign_id, row.id, db);
    for (const row of db.prepare('SELECT id FROM campaign').all()) validateLiveBackup(db, row.id);
    validateCombatBackup(db);validateCombatDrafts(db);validateChaseBackup(db);validateChaseDrafts(db);validateMaskReconciliations(db);validateRuleReferences(db);validateSceneChecks(db);
    validateProgressBackup(db);validateNarrativeBackup(db);validateFinishDrafts(db);validateSceneDesk(db);validateTreasuryDrafts(db);validateGroups(db);validateNpcRecords(db);validateNpcRecovery(db);
    validateItemsBackup(db);
    validateWorldBackup(db);validateWorldRelationPairs(db);
    validateCities(db);
    validatePlayer(db);
    validateDungeonPlay(db);
    validateAutonomy(db);
    validateDrawing(db);
    validateMusicBackup(db);
    validateGenerationBackup(db);validateSessionRuns(db);
    for (const row of db.prepare('SELECT payload,checksum FROM live_receipt').iterate()) if (hash(row.payload) !== row.checksum) throw new Error('Beschädigtes Live-Commitreceipt im Backupkandidaten.');
    for (const row of db.prepare('SELECT * FROM source').iterate()) if (hash(row.bytes) !== row.checksum) throw new Error('Beschädigte Quellbytes im Backupkandidaten.');
    // Every stored payload envelope receives the same byte/JSON check.
    // Domain decoders above additionally verify their semantic invariants.
    // New feature tables cannot silently fall outside backup integrity.
    for (const { name } of db.prepare("SELECT name FROM sqlite_schema WHERE type='table'").all()) {
      const columns = db.prepare('SELECT name,type FROM pragma_table_info(?)').all(name);
      const payloadColumn = columns.find((column: Row) => column.name === 'payload');
      if (!payloadColumn || !columns.some((column: Row) => column.name === 'checksum')) continue;
      const table = '"' + name.replace(/"/g, '""') + '"';
      for (const row of db.prepare(`SELECT payload,checksum FROM ${table}`).iterate()) {
        if (hash(row.payload) !== row.checksum) throw new Error(`Beschädigte Nutzdaten im Backup: ${name}.`);
        if (payloadColumn.type === 'TEXT') JSON.parse(row.payload);
      }
    }
  }
  async backup(filename:string){
    const epoch=this.backupEpoch,candidate = filename + '.candidate-' + randomUUID();
    try {
      await this.db.backup(candidate);
      const db = new Database(candidate, { readonly: true, fileMustExist: true });
      try {
        this.validateDatabase(db);
        if(db.pragma('user_version',{simple:true})>=50)validateRoomGroups(db);
      } finally { db.close(); }
      const fd = openSync(candidate, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
      if(epoch!==this.backupEpoch)throw new Error('Wiederherstellungskopie durch Löschung überholt.');
      renameSync(candidate, filename);
      const directory = openSync(dirname(filename), 'r'); try { fsyncSync(directory); } finally { closeSync(directory); }
    } catch (error) { rmSync(candidate, { force: true }); throw error; }
    finally {
      // Read-only validation of a WAL-mode copy can create these sidecars too.
      // The unique candidate is closed and never shared with another connection.
      for (const suffix of ['-wal', '-shm']) rmSync(candidate + suffix, { force: true });
    }
  }
  reconcile(edit: Edit, token = edit.token): { outcome: 'applied' | 'not-applied' | 'conflict'; targetChanged: boolean; workspace: Workspace } {
    if(this.graphShadow&&!this.graphRouting)return this.withGraph(()=>this.reconcile(edit,token));
    return this.db.transaction(() => {
      const campaignId = this.guard(token, edit.campaignId);
      const receipt = this.db.prepare('SELECT * FROM receipt WHERE command_id=?').get(edit.commandId);
      if (receipt && (receipt.campaign_id !== campaignId || !matchesReceipt(receipt, edit))) throw new Error('Änderungskennung bereits anders verwendet.');
      const current = this.db.prepare('SELECT revision FROM room WHERE campaign_id=? AND id=?').get(campaignId, edit.roomId);
      if (!current) throw new Error('Raum nicht verfügbar.');
      const workspace = this.workspace();
      return { outcome: receipt ? 'applied' : current.revision === edit.expectedRevision ? 'not-applied' : 'conflict',
        targetChanged: current.revision !== (receipt?.revision ?? edit.expectedRevision) || !workspace.rooms.some(room => room.id === edit.roomId), workspace };
    })();
  }
  captureKeyNote(c:KeyNoteCaptureCommand){return captureKeyNote(this.db,c,()=>{this.guard(c.token,c.campaignId);},(note,expectedRevision)=>this.commitPreparation({commandId:c.commandId+'|note',campaignId:c.campaignId,token:c.token,change:{kind:'note',expectedRevision,note}}));}
  noteThread(token:string,id:string,offset=0,active=true,history=false){return readNoteThread(this.db,this.guard(token),id,offset,active,history);}
  checkNoteThread(token:string,selection:import('../note-thread-contracts').NoteThreadSelection){return checkNoteThread(this.db,this.guard(token),selection);}
  keyNoteChoices(token:string,query:string){const cam=this.guard(token);return this.db.transaction(()=>readKeyNoteChoices(this.db,cam,query))();}
  keyNoteCaptureStatus(c:KeyNoteCaptureCommand,token=c.token){return keyNoteCaptureStatus(this.db,c,()=>{this.guard(token,c.campaignId);});}
  noteRoomUses(token:string,id:string,offset=0):import('../preparation-contracts').NoteRoomUsesPage {
    if(typeof id!=='string'||!id||id.length>1000)throw new Error('Ungültiges Notizziel.');
    const cam=this.guard(token);
    return this.db.transaction(()=>{const row=this.db.prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?').get(cam,id);
      if(!row)throw new Error('Notiz nicht verfügbar.');const note=checkedWorldNoteRow(row);
      return readNoteRoomUses(this.db,cam,note,offset);
    })();
  }
  noteMergePreview(token:string,sourceId:string,targetId:string){
    const cam=this.guard(token);return this.db.transaction(()=>{
      const preview=noteMergeWork(this.db,cam,sourceId,targetId).preview;
      if(this.graphShadow)preview.blockers.push('Die offene Dungeonvorschau zuerst abschließen.');
      return preview;
    })();
  }
  preparation(token: string, search = ''): Preparation {
    if (typeof search !== 'string' || search.length > 1000) throw new Error('Ungültige Suchanfrage.');
    return this.db.transaction(() => {
      const campaignId = this.guard(token), problems: string[] = [];
      const nonce = randomUUID(), marks = {start:`⟦${nonce}:hit⟧`,end:`⟦${nonce}:end⟧`,clip:`⟦${nonce}:clip⟧`};
      const rows = search.trim()
        ? this.db.prepare('SELECT n.*, snippet(note_search,3,?,?,?,24) AS search_preview FROM world_note n JOIN note_search s ON s.campaign_id=n.campaign_id AND s.note_id=n.id WHERE n.campaign_id=? AND note_search MATCH ? ORDER BY n.id').all(marks.start,marks.end,marks.clip,campaignId,noteSearchQuery(search))
        : this.db.prepare('SELECT * FROM world_note WHERE campaign_id=? ORDER BY id').all(campaignId);
      const notes: Preparation['notes'] = [];
      for (const row of rows) {
        try {
          const note = checkedWorldNoteRow(row), searchPreview = noteSearchPreview(row.search_preview,note,marks);
          notes.push({ note, trashed: !!row.trashed, ...(searchPreview ? {searchPreview} : {}) });
        } catch { problems.push(`Notiz ${row.id} ist gesperrt. Originalbytes bleiben erhalten.`); }
      }
      notes.sort((a,b) => noteTitleOrder.compare(a.note.title,b.note.title) || a.note.id.localeCompare(b.note.id));
      const plans: ManualPlan[] = [];
      for (const row of this.db.prepare('SELECT * FROM plan WHERE campaign_id=? ORDER BY name,id').all(campaignId)) {
        try { plans.push(this.readPlan(campaignId, row.id)); }
        catch { problems.push(`Plan ${row.id} ist gesperrt. Originalbytes bleiben erhalten.`); }
      }
      const locations: Preparation['locations'] = [];
      for (const row of this.db.prepare('SELECT * FROM location WHERE campaign_id=? ORDER BY id').all(campaignId)) {
        try {
          locations.push({ document: this.decodeLocation(row), revision: row.revision, trashed: !!row.trashed });
        } catch { problems.push(`Ort ${row.id} ist gesperrt. Originalbytes bleiben erhalten.`); }
      }
      let selection: PreparationSelection = { noteId: null, planId: null, sceneId: null };
      const saved = this.db.prepare('SELECT value FROM settings WHERE key=?').get(`preparation:${campaignId}`);
      if (saved) { try { selection = JSON.parse(saved.value); } catch { problems.push('Auswahlcheckpoint ist beschädigt.'); } }
      return { notes, plans, locations, maps: this.db.prepare('SELECT id,name FROM scope WHERE campaign_id=? ORDER BY name,id').all(campaignId), problems, selection };
    })();
  }
  locationActivities(token:string,q:import('../location-activity-contracts').LocationActivityQuery):import('../location-activity-contracts').LocationActivityPage{const cam=this.guard(token);return this.db.transaction(()=>readLocationActivities(this.db,cam,q))();}
  locationMaterials(token:string,q:import('../location-notebook-contracts').LocationMaterialsQuery){const cam=this.guard(token);return this.db.transaction(()=>readLocationMaterials(this.db,cam,q))();}
  worldLinks(token:string,q:import('../world-links-contracts').WorldLinksQuery):import('../world-links-contracts').WorldLinksPage{const cam=this.guard(token);return this.db.transaction(()=>readWorldLinks(this.db,cam,q))();}
  npcCast(token:string,q:import('../npc-cast-contracts').NpcCastQuery):import('../npc-cast-contracts').NpcCastPage{const cam=this.guard(token);return this.db.transaction(()=>readNpcCast(this.db,cam,q))();}
  npcBuildingChoices(token:string,id:string,q:import('../npc-places-contracts').NpcBuildingQuery):import('../npc-places-contracts').NpcBuildingChoices{const cam=this.guard(token);return this.db.transaction(()=>readNpcBuildingChoices(this.db,cam,id,q))();}
  npcPlaces(token:string,id:string,offset:number):import('../npc-places-contracts').NpcPlaces{const cam=this.guard(token);return this.db.transaction(()=>readNpcPlaces(this.db,cam,id,offset))();}
  npcPlanCalendar(token:string){return readNpcPlanCalendar(this.db,this.guard(token));}
  npcDossier(token:string,sceneId:string,id:string):import('../npc-cast-contracts').NpcDossier{const cam=this.guard(token);return this.db.transaction(()=>readNpcDossier(this.db,cam,sceneId,id))();}
  npcDrafts(token:string){return npcDrafts(this.db,this.guard(token));}
  npcDraft(token:string,id:string){return npcDraft(this.db,this.guard(token),id);}
  keepNpcDraft(token:string,d:NpcDraft,expected:string|null){return keepNpcDraft(this.db,this.guard(token),d,expected);}
  discardNpcDraft(token:string,id:string,writeId:string){return discardNpcDraft(this.db,this.guard(token),id,writeId);}
  npcs(token:string,q:NpcQuery){return readNpcs(this.db,this.guard(token),q);}
  npc(token:string,id:string){return readNpc(this.db,this.guard(token),id);}
  reconcileNpc(c:NpcCommand,token:string){return reconcileNpc(this.db,c,()=>{this.guard(token,c.campaignId);});}
  executeNpc(c:NpcCommand){return executeNpc(this.db,c,()=>{this.guard(c.token,c.campaignId);});}
  generationSources(token:string){return readWorldSources(this.db,this.guard(token));}
  sceneVisits(token:string,sceneId:string,after:string|null){return readSceneVisits(this.db,this.guard(token),sceneId,after);}
  sessionProgress(token:string,planId:string,sceneId?:string){return readSessionProgress(this.db,this.guard(token),planId,sceneId);}
  sessionPacket(token:string,planId:string){return readSessionPacket(this.db,this.guard(token),planId);}
  session(token: string,planId: string) { return readSession(this.db,this.guard(token),planId); }
  executeSession(command: SessionCommand) { return executeSession(this.db,command,()=>{this.guard(command.token,command.campaignId);},(plan,expectedRevision)=>{this.commitPreparation({commandId:command.commandId+'|timeline',campaignId:command.campaignId,token:command.token,change:{kind:'plan',plan,expectedRevision}});}); }
  generateSession(token: string,request: SessionGenerationRequest) { return generateSession(this.db,this.guard(token),request); }
  regenerateSessionReward(token:string,runId:string,index:number,seed:string){return regenerateSessionReward(this.db,this.guard(token),runId,index,seed);}
  regenerateSessionProposal(token: string,runId: string,index: number,seed: string) { return regenerateSessionProposal(this.db,this.guard(token),runId,index,seed); }
  sessionRuns(token: string,planId: string) { return readSessionRuns(this.db,this.guard(token),planId); }
  sessionRun(token: string,id: string) { return readSessionRun(this.db,this.guard(token),id); }
  sceneEncounterSelection(token:string,sceneId:string){return readSceneEncounterSelection(this.db,this.guard(token),sceneId);}
  scenePreparation(token: string,sceneId: string) { return scenePreparation(this.db,this.guard(token),sceneId); }
  sceneRules(token:string,sceneId:string){return readSceneRules(this.db,this.guard(token),sceneId);}
  executeSceneRule(command:SceneRuleCommand){return executeSceneRule(this.db,command,()=>this.guard(command.token,command.campaignId));}
  sceneChecks(token:string,sceneId:string){return readSceneChecks(this.db,this.guard(token),sceneId);}
  executeSceneCheck(command:SceneCheckCommand){return executeSceneCheck(this.db,command,()=>this.guard(command.token,command.campaignId));}
  encounterTables(token: string, includeTrashed: boolean) { return readEncounterTables(this.db,this.guard(token),includeTrashed); }
  lootTables(token: string, includeTrashed: boolean) { return readLootTables(this.db,this.guard(token),includeTrashed); }
  presetRegistry(campaignId:string|null){return readPresetRegistry(this.db,campaignId);}
  presetCommand(command:import('../generation-contracts').PresetCommand){return executePresetCommand(this.db,command);}
  presetOutcome(command:import('../generation-contracts').PresetCommand){return readPresetOutcome(this.db,command);}
  generatorRegistry(token: string) { return readGeneratorRegistry(this.db,this.guard(token)); }
  executeGeneration(command: GenerationCommand) { return executeGeneration(this.db,command,()=>{this.guard(command.token,command.campaignId);}); }
  generateEncounters(token: string, request: GenerationRequest) { return generateEncounters(this.db,this.guard(token),request); }
  acceptGeneration(command: Parameters<typeof acceptGeneration>[1]) { return acceptGeneration(this.db,command,()=>{this.guard(command.token,command.campaignId);}); }
  generationRuns(token: string) { return readGenerationRuns(this.db,this.guard(token)); }
  generationRun(token: string, id: string) { return readGenerationRun(this.db,this.guard(token),id); }
  rollLoot(command: LootRollCommand) { return rollLoot(this.db,command,()=>{this.guard(command.token,command.campaignId);}); }
  encounterPlans(token: string, search: string, limit?:number) { return readEncounterPlans(this.db,this.guard(token),search,limit); }
  encounterPlan(token: string, id: string) { return readEncounterPlan(this.db,this.guard(token),id); }
  saveEncounterPlan(command: EncounterPlanCommand) { return saveEncounterPlan(this.db,command,()=>{this.guard(command.token,command.campaignId);}); }
  progressHistory(token: string, characterId: string, after: string | null) { return readProgressHistory(this.db, this.guard(token), characterId, after); }
  keepChaseDraft(token:string,draft:import('../chase-draft-contracts').ChaseWorkingDraft,expected:string|null){return keepChaseDraft(this.db,this.guard(token),draft,expected);}
  maskHistory(token:string,sceneId:string,query:import('../mask-history-contracts').MaskHistoryQuery){return readMaskHistory(this.db,this.guard(token),sceneId,query);}
  chase(token:string,sceneId:string,id?:string){return readChase(this.db,this.guard(token),sceneId,id);}
  executeChase(c:ChaseCommand){return executeChase(this.db,c,()=>this.guard(c.token,c.campaignId),chase=>{
    // The Chase transaction owns both the round and the existing Scene-time writer.
    // Receipt replay returns before this port; downstream World faults roll back both.
    const scene=readLiveScene(this.db,c.campaignId,chase.sceneId);
    this.executeLive({commandId:c.commandId+':clock',token:c.token,campaignId:c.campaignId,action:{kind:'advance-clock',sceneId:scene.id,expectedRevision:scene.clock.revision,amount:6,unit:'seconds',calendarVersion:'relative-v1',reason:'Verfolgung · '+chase.title+' · Runde '+chase.round}});
  });}
  chroniclePage(token:string,category:import('../chronicle-contracts').ChronicleCategory|'all',search:string,cursor:import('../chronicle-contracts').ChronicleCursor|null){const cam=this.guard(token);if(!cursor){this.chronicleRead?.close();this.chronicleRead=new ChronicleReadSession(this.filename,cam);}if(!this.chronicleRead||this.chronicleRead.campaignId!==cam||cursor&&cursor.snapshotId!==this.chronicleRead.id)throw new Error('Chronik-Lesestand nicht mehr verfügbar. Aktualisieren.');return this.chronicleRead.read(category,search,cursor);}
  closeChroniclePage(token:string,id:string){this.guard(token);if(this.chronicleRead?.id===id){this.chronicleRead.close();this.chronicleRead=null;}}
  chronicleExportSnapshot(token:string){return new ChronicleReadSession(this.filename,this.guard(token));}
  chronicle(token:string,category:import('../chronicle-contracts').ChronicleCategory|'all'='all',search=''){return readChronicle(this.db,this.guard(token),category,search);}
  progress(token: string) { return readProgress(this.db, this.guard(token)); }
  lootBalance(token:string){return readLootBalance(this.db,this.guard(token));}
  treasures(token: string, after: string | null,query?:import('../treasury-contracts').TreasureQuery) { return readTreasures(this.db, this.guard(token), after,query); }
  treasure(token: string, id: string) { return readTreasure(this.db, this.guard(token), id); }
  ledger(token: string, query: LedgerQuery) { return readLedger(this.db, this.guard(token), query); }
  ledgerInventory(token:string,query:LedgerInventoryQuery){return readLedgerInventory(this.db,this.guard(token),query);}
  ledgerItem(token: string, id: string) { return readLedgerDetail(this.db, this.guard(token), id); }
  commitStatus(ref:CommitReference,token:string):CommitOutcome{checkedCommitReference(ref);this.guard(token,ref.campaignId);return readCommitReceipt(this.db,ref);}
  ledgerParties(token:string){const cam=this.guard(token),rows:any[]=[];for(const kind of ['npc','faction'])rows.push(...this.db.prepare("SELECT id,json_extract(payload,'$.title') name FROM world_note WHERE campaign_id=? AND trashed=0 AND json_extract(payload,'$.kind')=? ORDER BY name LIMIT 2000").all(cam,kind).map((r:any)=>({...r,kind})));rows.push(...this.db.prepare("SELECT id,json_extract(payload,'$.name') name FROM location WHERE campaign_id=? AND trashed=0 ORDER BY name LIMIT 2000").all(cam).map((r:any)=>({...r,kind:'location'})));rows.push(...this.db.prepare("SELECT id,json_extract(payload,'$.name') name FROM shop WHERE campaign_id=? AND coalesce(json_extract(payload,'$.trashed'),0)=0 ORDER BY name LIMIT 2000").all(cam).map((r:any)=>({...r,kind:'shop'})));return rows;}
  preparedGroups(token:string,search:string,after:string|null){return preparedGroups(this.db,this.guard(token),search,after);}
  groupView(token:string,id:string){return groupView(this.db,this.guard(token),id);}
  groupDraft(token:string,id:string){return groupDraft(this.db,this.guard(token),id);}
  keepGroupDraft(token:string,draft:import('../groups-contracts').GroupDraft,expected:string|null){return keepGroupDraft(this.db,this.guard(token),draft,expected);}
  discardGroupDraft(token:string,id:string,writeId:string){return discardGroupDraft(this.db,this.guard(token),id,writeId);}
  treasuryDraft(token:string,id:string){return readTreasuryDraft(this.db,this.guard(token),id);}
  keepTreasuryDraft(token:string,draft:import('../treasury-contracts').TreasuryDraft,expected:string|null){return keepTreasuryDraft(this.db,this.guard(token),draft,expected);}
  discardTreasuryDraft(token:string,id:string,writeId:string){return discardTreasuryDraft(this.db,this.guard(token),id,writeId);}
  treasureHistory(token:string,id:string,after:string|null){return treasureHistory(this.db,this.guard(token),id,after);}
  sceneDesk(token:string,id:string){return readSceneDesk(this.db,this.guard(token),id);}
  searchDesk(token:string,kind:string,search:string,offset:number){return searchDesk(this.db,this.guard(token),kind,search,offset);}
  deskContent(token:string,ref:import('../scene-desk-contracts').DeskRef){return deskContent(this.db,this.guard(token),ref);}
  pinSceneDesk(token:string,id:string,revision:number,ref:import('../scene-desk-contracts').DeskRef,pin:boolean){return pinSceneDesk(this.db,this.guard(token),id,revision,ref,pin);}
  sceneCreationDraft(token:string,sceneId:string){return readSceneCreationDraft(this.db,this.guard(token),sceneId);}
  keepSceneCreationDraft(token:string,sceneId:string,draft:import('../scene-desk-contracts').SceneCreationDraft|null,expected:string|null){return keepSceneCreationDraft(this.db,this.guard(token),sceneId,draft,expected);}
  keepDeskDraft(token:string,draft:PreparationDraft,expected:string|null){return this.db.transaction(()=>{const target=preparationTarget(draft.change),old=this.preparationDraft(token,target.kind,target.id);if((old?.writeId??null)!==expected)throw new Error('Notizeingabe inzwischen an anderer Stelle geändert.');this.keepPreparationDrafts(token,[draft]);}).immediate();}
  finishDraft(token:string,owner:import('../finish-draft-contracts').FinishOwner){return readFinishDraft(this.db,this.guard(token),owner);}
  keepFinishDraft(token:string,draft:import('../finish-draft-contracts').FinishDraft,expected:string|null){return keepFinishDraft(this.db,this.guard(token),draft,expected);}
  discardFinishDraft(token:string,owner:import('../finish-draft-contracts').FinishOwner,writeId:string){return discardFinishDraft(this.db,this.guard(token),owner,writeId);}
  keepNarrativeDraft(token:string,draft:import('../narrative-contracts').NarrativeDraft,expected:string|null){return keepNarrativeDraft(this.db,this.guard(token),draft,expected);}
  discardNarrativeDraft(token:string,id:string,writeId:string){return discardNarrativeDraft(this.db,this.guard(token),id,writeId);}
  narrativeJournal(token:string,query:import('../narrative-journal-contracts').NarrativeJournalQuery){return readNarrativeJournal(this.db,this.guard(token),query);}
  narrative(token:string,id:string){return this.db.transaction(()=>readNarrative(this.db,this.guard(token),id))();}
  adventuringDay(token:string,request:import('../adventuring-day-contracts').DayRequest):import('../adventuring-day-contracts').DayView{return this.db.transaction(()=>readDay(this.db,this.guard(token),request))();}
  executeProgress(command: ProgressCommand) { return this.db.transaction(() => {
    this.guard(command.token,command.campaignId);
    const a=command.action,guard=()=>{this.guard(command.token,command.campaignId);};
    if(a.kind!=='rest'||!a.scene||this.db.prepare('SELECT 1 FROM progress_receipt WHERE command_id=?').get(command.commandId))return executeProgress(this.db,command,guard);
    const current=readLive(this.db,command.campaignId),scene=current.scene;
    if(!scene||scene.id!==a.scene.id||current.focusRevision!==a.scene.expectedFocusRevision||scene.membershipRevision!==a.scene.expectedMembershipRevision||scene.clock.revision!==a.scene.expectedClockRevision||scene.retired)throw new Error('Rastgruppe oder Szenenzeit geändert. Aktuellen Spieltisch laden.');
    if(!a.recipients.every(r=>scene.members.includes(r.characterId)))throw new Error('Rast nur mit Figuren dieser Szene.');
    if((a.scene.amount===undefined)!==(a.scene.unit===undefined))throw new Error('Rastdauer und Zeiteinheit gemeinsam angeben.');
    // Scene ownership is required even when the user deliberately keeps time.
    if(a.scene.amount===undefined)return executeProgress(this.db,command,guard);
    if(this.db.prepare("SELECT 1 FROM chase WHERE campaign_id=? AND scene_id=? AND status='running'").get(command.campaignId,scene.id))throw new Error('Verfolgung vor der zeitgebundenen Rast abschließen.');
    const result=executeProgress(this.db,command,guard),clock=this.executeLive({commandId:command.commandId+'|rest-clock',campaignId:command.campaignId,token:command.token,action:{kind:'advance-clock',sceneId:scene.id,expectedRevision:a.scene.expectedClockRevision,amount:a.scene.amount,unit:a.scene.unit,calendarVersion:'relative-v1',reason:(a.rest==='long'?'Lange':'Kurze')+' Rast · '+a.recipients.length+' Figuren'}});
    result.restScene=clock.scene;const payload=json(result);this.db.prepare('UPDATE progress_receipt SET payload=?,checksum=? WHERE command_id=?').run(payload,hash(payload),command.commandId);
    return result;
  }).immediate(); }
  preparedGroup(token:string,id:string){return readPreparedGroup(this.db,this.guard(token),id);}
  drawingMap(token:string,roomId?:string,elementId?:string):import('../drawing-contracts').DrawingMapView{
    if(this.graphShadow&&!this.graphRouting)return this.withGraph(()=>this.drawingMap(token,roomId,elementId));const cam=this.guard(token);
    if(roomId===undefined)return drawingView(this.db,cam,true);
    const checked=(r:any)=>{if(hash(r.payload)!==r.checksum)throw new Error('Zeichnungsdaten beschädigt.');return JSON.parse(r.payload);};
    const style=roomMapStyle(this.db,cam,roomId),styles=style?[style]:[];
    const volume=roomId?readDungeonVolume(this.db,cam,roomId):undefined,volumes=volume?[volume]:[];
    const features=elementId?this.db.prepare('SELECT payload,checksum FROM dungeon_feature_state WHERE campaign_id=? AND id=?').all(cam,elementId).map(checked):[];
    return{coverage:'selected',elements:[],styles,volumes,hiddenRooms:[],hiddenFloors:[],features};
  }
  drawingElement(token:string,id:string):import('../drawing-contracts').DrawingElement{if(this.graphShadow&&!this.graphRouting)return this.withGraph(()=>this.drawingElement(token,id));return drawingElement(this.db,this.guard(token),id);}
  /** Authoring needs canonical geometry/content, never live travel or perception. */
  dungeonAuthoring(token:string):import('../dungeon-contracts').DungeonGeometry{
    if(this.graphShadow&&!this.graphRouting)return this.withGraph(()=>this.dungeonAuthoring(token));
    const cam=this.guard(token);
    return this.db.transaction(()=>{
      const geometry=dungeonGeometry(this.db,cam),preserved=new Map(geometry.drawing.hiddenRooms.map(r=>[r.id,r]));
      // Archiving a floor hides its map, not the authored room contents.
      for(const row of this.db.prepare("SELECT r.id FROM room r JOIN drawing_hidden h ON h.campaign_id=r.campaign_id AND h.scope_id=r.scope_id AND h.id=r.floor_id AND h.kind='floor' AND h.hidden=1 WHERE r.campaign_id=?").iterate(cam))if(!preserved.has(row.id))preserved.set(row.id,drawingRoom(this.db,cam,row.id));
      geometry.drawing.hiddenRooms=[...preserved.values()];
      if(this.graphShadow)geometry.drawing.graphPreview=this.graphShadow.state();
      return geometry;
    })();
  }
  dungeon(token:string){const cam=this.guard(token),view=dungeonView(this.db,cam);return this.graphShadow?{...view,...dungeonGeometry(this.graphShadow.db,cam),drawing:{...drawingView(this.graphShadow.db,cam),graphPreview:this.graphShadow.state()}}:view;}
  dungeonCommandState(command:DungeonCommand){this.guard(command.token,command.campaignId);return dungeonCommandState(this.db,command);}
  previewDungeon(token:string,r:DungeonRequest){return previewDungeon(this.db,this.guard(token),r);}
  executeDungeon(c:DungeonCommand){if(this.graphShadow)throw new Error('Graphvorschau zuerst übernehmen oder Ursprung wiederherstellen. Dungeon-Leiten nutzt die bestätigte Geometrie.');return executeDungeon(this.db,c,()=>{this.guard(c.token,c.campaignId);},command=>this.executeLive(command),command=>this.executeCombat(command),command=>this.executeProgress(command));}
  previewPath(token:string,p:DungeonPath):PathPreview{if(this.graphShadow&&!this.graphRouting)return this.withGraph(()=>this.previewPath(token,p));const cam=this.guard(token);return previewDungeonPath(this.db,cam,p,dungeonGeometry(this.db,cam));}
  drawing(token:string):DrawingView{if(this.graphShadow&&!this.graphRouting)return this.withGraph(()=>this.drawing(token));return{...drawingView(this.db,this.guard(token)),graphPreview:this.graphShadow?.state()};}
  executeDrawing(c:DrawingCommand):{workspace:Workspace;view:DrawingView}{if(c.action.kind==='graph-commit')throw new Error('Graphübernahme ist nur über die geschützte Vorschau möglich.');if(this.graphShadow&&!this.graphRouting){if(c.action.kind==='element')validateDungeonPlacement(this.db,c.campaignId,c.action.element,this.graphShadow.scopeId);return this.withGraph(()=>this.executeDrawing(c));}executeDrawing(this.db,c,()=>{this.guard(c.token,c.campaignId);});return{workspace:this.workspace(),view:{...drawingView(this.db,c.campaignId),graphPreview:this.graphShadow?.state()}};}
  activateFeature(token:string,id:string,sceneId:string,expected:number,action:'activate'|'reset'|'correct',charges:number|null,commandId:string){if(this.graphShadow)throw new Error('Graphvorschau zuerst übernehmen oder Ursprung wiederherstellen.');const cam=this.guard(token);activateDungeonFeature(this.db,cam,id,sceneId,expected,action,charges,commandId);return drawingView(this.db,cam);}
  graph(token:string,scopeId:string):GraphView{const cam=this.guard(token);if(this.graphShadow&&(this.graphShadow.campaignId!==cam||this.graphShadow.scopeId!==scopeId))throw new Error('Zuerst die offene Graphvorschau übernehmen oder wiederherstellen.');const view=graphView(this.graphShadow?.db??this.db,cam,scopeId,this.graphShadow?.state()??null);return{...view,budget:dungeonBudgetView(this.db,cam,scopeId,view)};}
  executeGraph(c:GraphCommand):{workspace:Workspace;view:GraphView}{const cam=this.guard(c.token,c.campaignId);if(this.graphShadow&&(this.graphShadow.campaignId!==cam||this.graphShadow.scopeId!==c.scopeId))throw new Error('Eine Dungeonvorschau gleichzeitig bearbeiten.');const a=c.action;
    if(a.kind==='select'){this.select(c.token,a.roomId);return{workspace:this.workspace(),view:this.graph(c.token,c.scopeId)};}
    if(a.kind==='restore'){if(this.graphShadow)this.committedSources.forget(this.graphShadow.db);this.graphShadow?.dispose();this.graphShadow=null;return{workspace:this.workspace(),view:this.graph(c.token,c.scopeId)};}
    if(a.kind==='accept'){const shadow=this.graphShadow;if(!shadow||shadow.phase!=='raster')throw new Error('Zur Rastervorschau wechseln, dort korrigieren und anschließend übernehmen.');const changes=shadow.changes(),selected=shadow.db.prepare('SELECT selected_id FROM campaign WHERE id=?').get(cam)?.selected_id;this.db.transaction(()=>{if(changes.length)executeDrawing(this.db,{commandId:c.commandId,token:c.token,campaignId:cam,action:{kind:'graph-commit',changes}},()=>{this.guard(c.token,cam);});if(selected&&selected!==this.db.prepare('SELECT selected_id FROM campaign WHERE id=?').get(cam)?.selected_id)this.db.prepare('UPDATE campaign SET selected_id=? WHERE id=?').run(selected,cam);}).immediate();this.committedSources.forget(shadow.db);shadow.dispose();this.graphShadow=null;return{workspace:this.workspace(),view:this.graph(c.token,c.scopeId)};}
    if(!this.graphShadow)this.graphShadow=new GraphShadow(this.db,cam,c.scopeId);const shadow=this.graphShadow;
    const draw=(action:DrawingCommand['action'])=>this.withGraph(()=>{executeDrawing(this.db,{commandId:randomUUID(),token:c.token,campaignId:cam,action},()=>{this.guard(c.token,cam);});});
    const saveLayout=(layout:import('../graph-contracts').GraphLayout)=>{const current=shadow.db.prepare('SELECT revision FROM dungeon_graph_layout WHERE campaign_id=? AND id=?').get(cam,c.scopeId);draw({kind:'graph-layout',layout,expectedRevision:current?.revision??null});};
    const connect=(intent:import('../graph-contracts').GraphIntent)=>{let layout=graphLayout(shadow.db,cam,c.scopeId);const at=layout.intents.findIndex(i=>i.id===intent.id);if(at>=0)layout.intents[at]=intent;else layout.intents.push(intent);if(!intent.fromRoomId||!intent.toRoomId){intent.problem='Gruppenverbindung ist Planungsabsicht. Beide konkreten Endräume wählen.';saveLayout(layout);return;}const fromId=intent.fromRoomId,toId=intent.toRoomId;try{shadow.db.transaction(()=>{
      let g=dungeonGeometry(shadow.db,cam);
      const ends=[fromId,toId].map(id=>g.rooms.find(r=>r.id===id));
      if(ends.some(r=>!r||r.scopeId!==c.scopeId))throw new Error('Beide Endräume derselben Dungeonzeichnung wählen.');
      for(const room of ends)if(!g.drawing.volumes?.some(v=>v.roomId===room!.id))draw({kind:'volume-initialize',roomId:room!.id,expectedRoomRevision:room!.revision,expectedVolumeRevision:null,heightSteps:2});
      g=dungeonGeometry(shadow.db,cam);const old=g.drawing.paths?.find(p=>p.id===intent.id),path:DungeonPath=old?{...old,from:old.from.roomId===fromId?old.from:{roomId:fromId,volumeId:null,pinned:false,local:null},to:old.to.roomId===toId?old.to:{roomId:toId,volumeId:null,pinned:false,local:null}}:{id:intent.id,revision:0,scopeId:c.scopeId,name:intent.name,notes:'',from:{roomId:fromId,volumeId:null,pinned:false,local:null},to:{roomId:toId,volumeId:null,pinned:false,local:null},waypoints:[],segments:[{form:intent.form,widthSteps:1,heightSteps:2,factor:1}],medium:'air',mode:'path',roomId:null,volumeId:null,fromPassageId:randomUUID(),toPassageId:randomUUID(),basis:'',route:[]};const preview=previewDungeonPath(shadow.db,cam,path,g);draw({kind:'path-publish',preview,expectedRevision:old?.revision??null});layout=graphLayout(shadow.db,cam,c.scopeId);layout.intents=layout.intents.filter(i=>i.id!==intent.id);saveLayout(layout);}).immediate();}catch(e){intent.problem=(e as Error).message;saveLayout(layout);}}
    if(a.kind==='raster')shadow.phase='raster';else if(a.kind==='connect')connect(structuredClone(a.intent));else if(a.kind==='resolve'){const intent=graphLayout(shadow.db,cam,c.scopeId).intents.find(i=>i.id===a.intentId);if(!intent)throw new Error('Verbindungsplanung fehlt.');connect({...intent,fromRoomId:a.fromRoomId,toRoomId:a.toRoomId});}else if(a.kind==='reroute'){for(const path of drawingView(shadow.db,cam).paths??[]){if(path.mode==='area'||path.status==='ready')continue;connect({id:path.id,fromRoomId:path.from.roomId,toRoomId:path.to.roomId,fromGroupId:null,toGroupId:null,form:path.segments[0]!.form,name:path.name,problem:''});}}else{draw(a);if(a.kind==='graph-move'||a.kind==='graph-duplicate'){for(const path of drawingView(shadow.db,cam).paths??[]){if(path.mode==='area'||path.status==='ready')continue;connect({id:path.id,fromRoomId:path.from.roomId,toRoomId:path.to.roomId,fromGroupId:null,toGroupId:null,form:path.segments[0]!.form,name:path.name,problem:''});}}}
    return{workspace:this.workspace(),view:this.graph(c.token,c.scopeId)};
  }
  autonomyDecision(token:string,actorId:string){return autonomyDecision(this.db,this.guard(token),actorId);}
  autonomy(token:string){return autonomyView(this.db,this.guard(token));}
  executeAutonomy(c:AutonomyCommand){return executeAutonomy(this.db,c,()=>{this.guard(c.token,c.campaignId);});}
  playerView(token:string,query?:import('../player-contracts').PlayerMapQuery){return playerView(this.db,this.guard(token),query);}
  executePlayer(c:PlayerCommand){return executePlayer(this.db,c,()=>{this.guard(c.token,c.campaignId);});}
  registerPlayerAsset(token:string,a:PlayerAsset){const cam=this.guard(token);savePlayerAsset(this.db,cam,a);return playerView(this.db,cam);}
  playerWindowOpen(token:string,open:boolean){this.db.transaction(()=>setPlayerWindow(this.db,this.guard(token),open)).immediate();}
  closePlayerWindow(token:string){this.playerWindowOpen(token,false);}
  currentPlayerDisplay(){return this.db.transaction(()=>{
    if(!this.active)return null;
    const settings=this.currentPlayerSettings();if(!settings)return null;
    let frame:PlayerFrame={mode:'blank',title:'',reason:'GM hat die Anzeige ausgeblendet.'};
    if(settings.windowOpen&&!settings.blank)try{frame=projectPlayer(this.db,this.active.campaignId);}catch{frame={mode:'blank',title:'',reason:'Anzeige derzeit nicht verfügbar.'};}
    return{owner:{id:this.active.campaignId,token:this.active.token},settings,frame};
  })();}
  currentPlayerSettings(){if(!this.active)return null;const l=this.db.prepare('SELECT trashed FROM campaign_lifecycle WHERE campaign_id=?').get(this.active.campaignId);return l&&!l.trashed?playerSettings(this.db,this.active.campaignId):null;}
  currentPlayerFrame(){if(!this.currentPlayerSettings())return{mode:'blank' as const,title:''};return projectPlayer(this.db,this.active!.campaignId);}
  playerImageFile(id:string){if(!this.active)throw new Error('Keine Kampagne.');const a=playerAssets(this.db,this.active.campaignId).find(a=>a.id===id);if(!a)throw new Error('Bild fehlt.');return dirname(this.filename)+'/player-images/'+a.sha256+a.extension;}
  cities(token:string){return cityOverview(this.db,this.guard(token));}
  city(token:string,id:string){return readCity(this.db,this.guard(token),id);}
  cityActivities(token:string,q:import('../city-activity-contracts').CityActivityQuery):import('../city-activity-contracts').CityActivityPage{const cam=this.guard(token);return this.db.transaction(()=>readCityActivities(this.db,cam,q))();}
  cityBuildings(token:string,query:import('../city-contracts').CityBuildingQuery){const c=this.guard(token);return this.db.transaction(()=>readCityBuildingChoices(this.db,c,query))();}
  executeCity(command:CityCommand){return executeCity(this.db,command,()=>{this.guard(command.token,command.campaignId);});}
  campaignInstallationSettings(){const id=this.list().activeId;return{registry:readGeneratorRegistry(this.db,id??''),activeId:id};}
  campaignCatalogOutcome(command:CampaignCatalogCommand){return catalogOutcome(this.db,command);}
  campaignCatalog(command:CampaignCatalogCommand):CampaignCatalogReceipt{
    catalogCommand(command);const completed=catalogOutcome(this.db,command);if(completed)return completed;if(this.graphShadow&&(command.kind==='create'||command.kind==='open'&&this.graphShadow.campaignId!==command.id))throw new Error('Offene Graphvorschau zuerst übernehmen oder Ursprung wiederherstellen.');let changed=false;
    const result=this.db.transaction(()=>{
      const prior=catalogOutcome(this.db,command);if(prior)return prior;
      let campaign:Campaign;
      if(command.kind==='create')campaign=this.create(command.name.trim());
      else{const row=this.db.prepare('SELECT c.*,l.trashed,l.revision trashRevision FROM campaign c JOIN campaign_lifecycle l ON l.campaign_id=c.id WHERE c.id=?').get(command.id);if(!row)throw new Error('Kampagne fehlt.');campaign={id:row.id,name:row.name,revision:row.revision};
        if(command.kind==='open'&&row.trashed||command.kind==='rename'&&row.trashed)throw new Error('Kampagne zuerst wiederherstellen.');
        if(command.kind==='rename'){if(row.revision!==command.expectedRevision)throw new Error('Kampagnenname inzwischen geändert.');this.db.prepare('UPDATE campaign SET name=?,revision=revision+1 WHERE id=?').run(command.name.trim(),command.id);campaign.name=command.name.trim();}
        if(command.kind==='trash')trashCampaign(this.db,{commandId:command.commandId,id:command.id,expectedRevision:command.expectedRevision,trashed:command.trashed});
        if(command.kind==='erase')eraseCampaignRows(this.db,{commandId:command.commandId,id:command.id,expectedRevision:command.expectedRevision,confirmName:command.confirmName});
      }
      if(command.kind==='open'||command.kind==='create'){noteCampaignOpened(this.db,campaign.id);this.db.prepare("INSERT INTO settings VALUES('active',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(campaign.id);}
      if(command.kind==='trash'&&command.trashed)this.db.prepare("DELETE FROM settings WHERE key='active' AND value=?").run(campaign.id);
      const usage=this.db.prepare('SELECT created_at,last_opened_at FROM campaign_usage WHERE campaign_id=?').get(campaign.id);
      const receipt:CampaignCatalogReceipt={commandId:command.commandId,kind:command.kind,campaignId:campaign.id,name:command.kind==='erase'?'':campaign.name,createdAt:usage?.created_at??null,lastOpenedAt:usage?.last_opened_at??null};catalogReceipt(this.db,command,receipt);changed=true;return receipt;
    }).immediate();
    if(changed){if(command.kind==='open'||command.kind==='create'||(command.kind==='trash'&&command.trashed||command.kind==='erase')&&this.active?.campaignId===result.campaignId){this.active=null;this.chronicleRead?.close();this.chronicleRead=null;}this.backupEpoch++;}
    return result;
  }
  campaignCatalogWorkspace(commandId:string):Workspace;
  campaignCatalogWorkspace(commandId:string,projection:true):WorkspaceShell;
  campaignCatalogWorkspace(commandId:string,projection=false):Workspace|WorkspaceShell{
    const row=this.db.prepare('SELECT payload,checksum FROM campaign_catalog_receipt WHERE command_id=?').get(commandId);if(!row||hash(row.payload)!==row.checksum)throw new Error('Öffnungsbeleg fehlt.');const receipt=JSON.parse(row.payload) as CampaignCatalogReceipt;
    if(!['open','create'].includes(receipt.kind)||this.list().activeId!==receipt.campaignId||!this.list().campaigns.some(c=>c.id===receipt.campaignId))throw new Error('Die aktive Kampagne wurde inzwischen gewechselt. Kampagne ausdrücklich neu öffnen.');
    this.chronicleRead?.close();this.chronicleRead=null;this.active={campaignId:receipt.campaignId,token:randomUUID()};return projection?this.workspaceShell():this.workspace();
  }
  campaignOverview(){return this.db.transaction(()=>campaignOverview(this.db))();}
  campaignIdentity(token:string):Campaign{return this.db.prepare('SELECT id,name,revision FROM campaign WHERE id=?').get(this.guard(token));}
  campaignFence(id:string,revision:number){const r=this.db.prepare('SELECT revision,trashed FROM campaign_lifecycle WHERE campaign_id=?').get(id);if(!r||r.trashed||r.revision!==revision)throw new Error('Quellkampagne wurde gelöscht oder ihr Lebenszyklus geändert.');}
  async campaignSnapshot(token:string,filename:string){
    const id=this.guard(token),fence=this.db.prepare('SELECT revision FROM campaign_lifecycle WHERE campaign_id=?').get(id).revision,candidate=filename+'.snapshot-'+randomUUID();
    try{
      await this.db.backup(candidate);this.campaignFence(id,fence);
      const db=new Database(candidate,{fileMustExist:true});let snapshot;
      try{
        db.pragma('journal_mode=DELETE');pruneCampaignSnapshot(db,id);this.validateDatabase(db);
        const c:Pick<Campaign,'id'|'name'>=db.prepare('SELECT id,name FROM campaign').get();
        snapshot={...c,fence,schema:db.pragma('user_version',{simple:true}),counts:snapshotCounts(db),media:[...audioMediaFiles(db),...playerMediaFiles(db,id)]};
      }finally{db.close();}
      const fd=openSync(candidate,'r');try{fsyncSync(fd);}finally{closeSync(fd);}
      this.campaignFence(id,fence);renameSync(candidate,filename);
      const directory=openSync(dirname(filename),'r');try{fsyncSync(directory);}finally{closeSync(directory);}
      return snapshot;
    }finally{for(const suffix of ['','-wal','-shm'])rmSync(candidate+suffix,{force:true});}
  }
  private inspectCampaignDatabase(db:any){
    const schema=db.pragma('user_version',{simple:true});
    if(schema!==45&&schema!==46&&schema!==47&&schema!==48&&schema!==49&&schema!==50&&schema!==51&&schema!==52&&schema!==this.db.pragma('user_version',{simple:true}))throw new Error('Dieses Paket gehört zum alten Testformat. Eine Kampagne mit gemeinsamem Atlas verwenden.');

    if(schema<50&&db.prepare("SELECT 1 FROM city_unit WHERE kind='building' LIMIT 1").get())throw Error('Alter Haus-Testbestand: neue Kampagne anlegen. Originaldatei bleibt erhalten.');
    this.validateDatabase(db);
    if(db.pragma('user_version',{simple:true})>=50)validateRoomGroups(db);
    const rows=db.prepare('SELECT id,name FROM campaign').all();if(rows.length!==1)throw new Error('Paket muss genau eine Kampagne enthalten.');
    const c:Pick<Campaign,'id'|'name'>=rows[0];
    validateCampaignSnapshotSettings(db,c.id);
    return{...c,schema,counts:snapshotCounts(db),media:[...audioMediaFiles(db),...playerMediaFiles(db,rows[0].id)],conflicts:definitionConflicts(this.db,db)};
  }
  campaignPreview(filename:string){const db=new Database(filename,{readonly:true,fileMustExist:true});try{return this.inspectCampaignDatabase(db);}finally{db.close();}}
  campaignTransferOutcome(ticket:string,expected?:{name:string;choices:Record<string,ConflictChoice>}):Campaign|null{
    if(typeof ticket!=='string'||!ticket||ticket.length>128)throw new Error('Übernahmekennung fehlt.');
    const receipt=this.db.prepare('SELECT subject_id,fingerprint FROM campaign_management_receipt WHERE command_id=?').get(ticket);
    if(!receipt)return null;
    if(!receipt.fingerprint.startsWith('transfer:')||expected&&receipt.fingerprint!==this.transferFingerprint(expected.name,expected.choices))throw new Error('Verwaltungskennung anders verwendet.');
    return this.db.prepare('SELECT id,name,revision FROM campaign WHERE id=?').get(receipt.subject_id)??null;
  }
  private transferFingerprint(name:string,choices:Record<string,ConflictChoice>){return 'transfer:'+hash(canonicalJson({name,choices}));}
  acceptCampaignSnapshot(filename:string,name:string,choices:Record<string,ConflictChoice>,ticket?:string,expectedDigest?:string){
    if(!name.trim()||name.length>1000)throw new Error('Kampagnenname fehlt.');
    if(ticket!==undefined){const confirmed=this.campaignTransferOutcome(ticket,{name,choices});if(confirmed)return confirmed;}
    // Remapping must never consume or mutate the reviewed input, even when publication fails.
    const staging=mkdtempSync(filename+'.accept-'),candidate=staging+'/campaign.sqlite';
    let source:any;
    try{
      copyFileSync(filename,candidate);
      source=new Database(candidate,{fileMustExist:true});
      const sha256=snapshotDigest(candidate);
      if(expectedDigest!==undefined&&sha256!==expectedDigest)throw new Error('Geprüfte Paketdatenbank wurde verändert.');
      const c=this.inspectCampaignDatabase(source),original=Buffer.from(JSON.stringify({format:'Campaign provenance',version:1,campaignId:c.id,name:c.name,schema:c.schema,sha256})),plan=sharedPlan(this.db,source,choices);
      if([33,34,35,36,37,38,39,40,41,42,43].includes(c.schema)){installChaseSchema(source);installWorldSources(source);installNpcRecords(source);installCombatDraftSchema(source);installContentRuntime(source);installNarrative(source);installFinishDrafts(source);installSceneDesk(source);installTreasury(source);installGroups(source);installRuleReferenceSchema(source);installSceneCheckSchema(source);installCombatSchema(source);if(c.schema<41)migrateMaskHealth(source);source.pragma('user_version=44');}

      if(c.schema===45||c.schema===46||c.schema===47){source.transaction(()=>{installLandscape(source);source.pragma('user_version=48');})();}
      if(source.pragma('user_version',{simple:true})===48)source.transaction(()=>{installTerritories(source);source.pragma('user_version=49');})();
      installRoomGroups(source);installSessionSchema(source);installTravelHistory(source);source.pragma('user_version=53');installSceneCheckSchema(source);archiveSourceChoices(source,plan);const remap=remapSnapshot(source,c.id,name,plan.mapping,plan.history);this.validateDatabase(source);
      return publishSnapshot(this.db,source,remap,plan,original,c.id,c.name,ticket===undefined?undefined:{commandId:ticket,fingerprint:this.transferFingerprint(name,choices)});
    }finally{try{source?.close();}finally{rmSync(staging,{recursive:true,force:true});}}
  }

  trashCampaign(command:{commandId:string;id:string;expectedRevision:number;trashed:boolean}){trashCampaign(this.db,command);this.backupEpoch++;if(command.trashed&&this.active?.campaignId===command.id){this.active=null;this.db.prepare("DELETE FROM settings WHERE key='active'").run();}}
  eraseCampaign(command:{commandId:string;id:string;expectedRevision:number;confirmName:string}){this.backupEpoch++;eraseCampaignRows(this.db,command);if(this.active?.campaignId===command.id)this.active=null;this.db.exec("INSERT INTO note_search(note_search) VALUES('optimize')");this.db.pragma('wal_checkpoint(TRUNCATE)');}
  pendingCampaignErasures():string[]{return this.db.prepare("SELECT id FROM campaign_erasure WHERE phase='cleanup'").all().map((r:any)=>r.id);}
  finishCampaignErasure(id:string){this.db.prepare("UPDATE campaign_erasure SET phase='complete' WHERE id=?").run(id);}
  private get audioRoot(){return dirname(this.filename)+'/audio';}
  private updateMusic(campaignId:string){try{this.db.transaction(()=>refreshMusicContext(this.db,this.audioRoot,campaignId))();}catch{/* Music failure does not invalidate the core action. */}}
  audioAssets(query:AudioQuery){return readAudioAssets(this.db,this.audioRoot,query);}
  campaignMediaReferenced(name:string){
    // Unknown damaged metadata cannot authorize deletion of shared media bytes.
    if(!name.startsWith('audio/')&&!name.startsWith('images/'))return true;
    const image=name.startsWith('images/'),table=image?'player_asset':'audio_asset',prefix=image?'$':'$.media';
    if(this.db.prepare(`SELECT 1 FROM ${table} WHERE NOT json_valid(payload) LIMIT 1`).get())return true;
    return !!this.db.prepare(`SELECT 1 FROM ${table} WHERE json_extract(payload,'${prefix}.sha256')||json_extract(payload,'${prefix}.extension')=? LIMIT 1`).get(name.slice(name.indexOf('/')+1));
  }
  audioAsset(id:string){return readAudioAsset(this.db,this.audioRoot,id);}
  musicFavorites(token:string,after:string|null){return this.db.transaction(()=>readMusicFavorites(this.db,this.audioRoot,this.guard(token),after))();}
  music(token:string):MusicView{return this.db.transaction(()=>readMusic(this.db,this.audioRoot,this.guard(token)))();}
  musicSubject(token:string,kind:MusicSubject['kind'],id:string){return readMusicSubject(this.db,this.guard(token),kind,id);}
  executeMusic(command:MusicCommand){return executeMusic(this.db,this.audioRoot,command,()=>{this.guard(command.token,command.campaignId);});}
  musicPosition(token:string,playbackId:string,seconds:number){return saveMusicPosition(this.db,this.guard(token),playbackId,seconds);}
  ingestAudio(token:string,media:AudioAsset['media']){const cam=this.guard(token);const result=this.db.transaction(()=>ingestAudio(this.db,this.audioRoot,media)).immediate();this.updateMusic(cam);return result;}
  ingestAudios(token:string,medias:AudioAsset['media'][]):AudioAsset[]{const cam=this.guard(token),assets=this.db.transaction(()=>medias.map(media=>ingestAudio(this.db,this.audioRoot,media))).immediate();this.updateMusic(cam);return assets;}
  audioLibrary(token:string){this.guard(token);return this.db.transaction(()=>audioLibrarySnapshot(this.db,this.audioRoot))();}
  mergeAudioLibrary(token:string,library:ReturnType<typeof audioLibrarySnapshot>){const cam=this.guard(token),ids=mergeAudioLibrary(this.db,this.audioRoot,library);this.updateMusic(cam);return ids;}
  audioFile(id:string){const asset=readAudioAsset(this.db,this.audioRoot,id);if(!asset.available)throw new Error('Mediendatei fehlt oder wurde verändert.');return audioFile(this.audioRoot,asset);}
  agenda(token:string,query:import('../agenda-contracts').AgendaQuery){return this.db.transaction(()=>readAgenda(this.db,this.guard(token),query))();}
  world(token:string){return this.db.transaction(()=>readWorld(this.db,this.guard(token)))();}
  sceneWorld(token:string,id:string){return this.db.transaction(()=>readSceneWorld(this.db,this.guard(token),id))();}
  previewTravel(token:string,request:TravelRequest){return this.db.transaction(()=>previewTravel(this.db,this.guard(token),request))();}
  reconcileWorld(command:WorldCommand,token:string){return this.db.transaction(()=>{this.guard(token,command.campaignId);return reconcileWorld(this.db,command);})();}
  private consumeSceneTime(cam:string,commandId:string,before:LiveScene,after:LiveScene,basis:ReturnType<typeof captureAutonomyBasis>){
    if(after.clock.instantMs===before.clock.instantMs)return;
    advanceDungeonFeatures(this.db,cam,after.clock.epochId,after.clock.instantMs);
    recordAutonomyTime(this.db,cam,commandId,after.id,after.clock.epochId,before.clock.instantMs,after.clock.instantMs,basis);
    const locations=new Set([before.locationId,after.locationId].filter((id):id is string=>id!==null));
    if(locations.size){const active=autonomyView(this.db,cam).actors.filter(a=>a.enabled&&!a.paused&&a.locationId!==null&&locations.has(a.locationId)).map(a=>a.id);if(active.length)catchUpAutonomy(this.db,cam,active,12,{epochId:after.clock.epochId,instantMs:after.clock.instantMs});}
    const spatialScenes=this.db.prepare("SELECT scene_id FROM scene_position WHERE campaign_id=? AND json_extract(payload,'$.dungeon.roomId') IS NOT NULL").all(cam);if(spatialScenes.length){const geometry=dungeonGeometry(this.db,cam);for(const row of spatialScenes)evaluateDungeonSenses(this.db,cam,row.scene_id,geometry);}
  }
  executeWorld(command:WorldCommand){if(command.action.kind==='map'){const root=this.db.prepare('SELECT map_id FROM campaign_atlas WHERE campaign_id=?').get(command.campaignId);if(root&&command.action.map.id!==root.map_id)throw new Error('Pro Kampagne gibt es genau einen Atlas.');if(root&&command.action.map.hexMeters!==4828.032)throw new Error('Die kleinste Hexgröße ist 3 Meilen Kante zu Kante.');}return this.db.transaction(()=>{
    const ack=executeWorld(this.db,command,()=>{this.guard(command.token,command.campaignId);},{
      capture:()=>captureAutonomyBasis(this.db,command.campaignId),
      confirm:(commandId,before,after,basis)=>this.consumeSceneTime(command.campaignId,commandId,before.scene,after.scene,basis),
      validateHistory:(_sceneId,tables)=>{
        // Validate the restored runtime with its owning decoders before commit.
        // A forged historical payload must never bypass today's domain rules.
        validateLiveBackup(this.db,command.campaignId);validateWorldBackup(this.db);
        if(tables.some(t=>t.startsWith('autonomy_')||t.startsWith('npc_')))validateAutonomy(this.db);
        if(tables.some(t=>t==='shop'||t==='shop_event'))validateItemsBackup(this.db);
        if(tables.includes('dungeon_feature_state'))validateFeatureStates(this.db);
        if(tables.some(t=>t.startsWith('dungeon_')))validateDungeonPlay(this.db);
        if(tables.some(t=>t==='player_hex_memory'))validatePlayer(this.db);
        if(tables.includes('world_actor'))for(const row of this.db.prepare('SELECT id FROM world_actor WHERE campaign_id=?').all(command.campaignId))readWorldActor(this.db,command.campaignId,row.id);
      },
    });
    this.updateMusic(command.campaignId);return ack;
  }).immediate();}
  itemDefinitions(query:ItemQuery){return readItemDefinitions(this.db,query);}
  itemDefinition(id:string,revision?:number){return readItemDefinition(this.db,id,revision);}
  shops(token:string,includeTrashed:boolean){return readShops(this.db,this.guard(token),includeTrashed);}
  shop(token:string,id:string){return readShop(this.db,this.guard(token),id);}
  shopHistory(token:string,id:string,after:string|null){return readShopHistory(this.db,this.guard(token),id,after);}
  sceneShops(token:string,id:string){return sceneShops(this.db,this.guard(token),id);}
  executeItemShop(command:ItemShopCommand){return executeItemShop(this.db,command,()=>{this.guard(command.token,command.campaignId);});}
  combatResolution(token:string,sceneId:string,id:string,after:string|null){return readCombatResolution(this.db,this.guard(token),sceneId,id,after);}
  combat(token: string, sceneId: string, id?: string) { return readCombat(this.db, this.guard(token), sceneId, id); }
  combatDraft(token:string,combatId:string,kind:CombatDraftKind,targetId:string){return this.db.transaction(()=>readCombatDraft(this.db,this.guard(token),combatId,kind,targetId))();}
  combatDrafts(token:string,combatId:string,after:string|null){return this.db.transaction(()=>combatDrafts(this.db,this.guard(token),combatId,after))();}
  keepCombatDraft(token:string,draft:CombatWorkingDraft,expected:string|null){keepCombatDraft(this.db,this.guard(token),draft,expected);}
  discardCombatDraft(token:string,combatId:string,kind:CombatDraftKind,targetId:string,writeId:string){discardCombatDraft(this.db,this.guard(token),combatId,kind,targetId,writeId);}
  executeCombat(command: CombatCommand) { return this.db.transaction(()=>{const ack=executeCombat(this.db, command, () => { this.guard(command.token, command.campaignId); });this.updateMusic(command.campaignId);return ack;}).immediate(); }
  archivedRoster(token:string,after:string|null,search:string){return readArchivedRoster(this.db,this.guard(token),after,search);}
  previewTime(token:string,request:import('../time-plan-contracts').TimeRequest){return this.db.transaction(()=>previewSceneTime(this.db,this.guard(token),request))();}
  live(token: string):import('../live-contracts').LiveView {
    const cam=this.guard(token),live=readLive(this.db,cam);
    try{return {...live,recapDraft:this.readSessionRecapDraft(cam)};}
    catch{return {...live,recapDraftError:'Rückblickentwurf nicht lesbar. Gespeicherte Texte bleiben erhalten. Erneut laden oder eine intakte Sicherung verwenden.'};}
  }
  private readSessionRecapDraft(cam:string):import('../live-contracts').SessionRecapDraft|null {
    const value=this.db.prepare('SELECT value FROM settings WHERE key=?').get('session-recap:'+cam)?.value;
    if(value===undefined)return null;
    const draft=JSON.parse(value);checkedSessionRecapDraft(draft);return draft;
  }
  keepLiveMomentDraft(token:string,sceneId:string,draft:import('../live-moment-drafts').LiveMomentDraft|null,expected:import('../live-moment-drafts').LiveMomentDraft|null){return this.db.transaction(()=>{const cam=this.guard(token),scene=readLiveScene(this.db,cam,sceneId);if(scene.retired)throw new Error('Momententwurf gehört zu einer früheren Scene.');keepMomentDraft(this.db,cam,sceneId,draft,expected);}).immediate();}
  keepSessionRecapDraft(token:string,draft:import('../live-contracts').SessionRecapDraft,expected:import('../live-contracts').SessionRecapDraft|null){
    checkedSessionRecapDraft(draft);if(expected!==null)checkedSessionRecapDraft(expected);
    return this.db.transaction(()=>{const cam=this.guard(token),current=this.readSessionRecapDraft(cam),same=(a:any,b:any)=>a===null?b===null:!!b&&a.summary===b.summary&&a.handoff===b.handoff;
      if(same(current,draft))return;
      if(!same(current,expected))throw new Error('Rückblick wurde inzwischen an anderer Stelle geändert. Eigene Eingaben bleiben offen.');
      this.db.prepare('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('session-recap:'+cam,json(draft));
    }).immediate();
  }
  liveScene(token: string, id: string) { return this.db.transaction(() => readLiveScene(this.db, this.guard(token), id))(); }
  liveArchives(token: string, after: string | null) { return readArchives(this.db, this.guard(token), after); }
  executeLive(command: LiveCommand) { return this.db.transaction(() => {
    const replay=!!this.db.prepare('SELECT 1 FROM live_receipt WHERE command_id=?').get(command.commandId);
    const basis=command.action.kind==='advance-clock'&&!replay?captureAutonomyBasis(this.db,command.campaignId):null,oldScene=command.action.kind==='advance-clock'||command.action.kind==='scene-content'&&!replay?readLiveScene(this.db,command.campaignId,command.action.sceneId):null;
    const ack = executeLive(this.db, command, () => {this.guard(command.token, command.campaignId);});
    if(!replay&&command.action.kind==='live-moment'&&command.action.followUp){const a=command.action,followUp=a.followUp!,noteId=campaignLocalId(followUp.id),scene=ack.scene;if(!scene||scene.id!==a.sceneId)throw new Error('Folgespur konnte nicht an die laufende Gruppe gebunden werden.');this.commitPreparation({commandId:command.commandId+'|follow-up',campaignId:command.campaignId,token:command.token,change:{kind:'note',expectedRevision:null,note:{version:1,id:noteId,revision:1,kind:followUp.kind,title:a.title.trim(),readAloud:'',gmNotes:a.summary,relations:[],creatureId:null,deleted:false}}});const locationId=scene.locationId&&this.db.prepare('SELECT 1 FROM location WHERE campaign_id=? AND id=? AND trashed=0').get(command.campaignId,scene.locationId)?scene.locationId:null,state={noteId,revision:1,status:'open' as const,locationId,contributors:scene.members,poolXp:0,items:[],awardId:null};validateNarrativeState(this.db,command.campaignId,state);saveNarrative(this.db,command.campaignId,state);}
    if(basis&&oldScene&&ack.scene)this.consumeSceneTime(command.campaignId,command.commandId,oldScene,ack.scene,basis);
    if(command.action.kind==='advance-clock'&&!replay)restockDue(this.db,command.campaignId,ack.scene!.clock.instantMs);
    if(!replay){
      const a=command.action;
      if(a.kind==='scene-roster'){const ids=ack.session?.members.filter(m=>!m.active).map(m=>m.id)??[],retired=new Set(ack.session?.retired.map(s=>s.id)??[]);removePartyFromMasks(this.db,command.campaignId,ids,command.commandId,retired);reconcileChaseParticipants(this.db,command.campaignId,ids,command.commandId,retired);}
      if(a.kind==='move'||a.kind==='membership'&&!a.active||a.kind==='archive-character'&&a.archived){const ids=a.kind==='move'?a.memberIds:[a.characterId],retired=new Set(ack.session?.retired.map(scene=>scene.id)??[]);removePartyFromMasks(this.db,command.campaignId,ids,command.commandId,retired);reconcileChaseParticipants(this.db,command.campaignId,ids,command.commandId,retired);}
      if(a.kind==='move'&&ack.session?.createdScene)inheritScenePosition(this.db,command.campaignId,a.sceneId,ack.session.createdScene.id);
      // Title/notes alone have no World consequence; broken optional weather cannot veto their save.
      const sceneId=a.kind==='advance-clock'||a.kind==='apply-visit'||a.kind==='scene-content'&&oldScene?.locationId!==ack.scene?.locationId?a.sceneId:a.kind==='initialize'?ack.scene?.id:a.kind==='move'?ack.session?.createdScene?.id:null;
      if(sceneId)syncSceneWorld(this.db,command.campaignId,sceneId);
    }
    if (command.action.kind === 'create-character' && ack.character) createProgress(this.db, command.campaignId, ack.character.id);
    if(!replay)this.updateMusic(command.campaignId);
    return ack;
  }).immediate(); }
  liveStatus(command: LiveCommand, token: string) { this.guard(token, command.campaignId); return liveStatus(this.db, command); }
  private readPlan(campaignId: string, id: string, db = this.db): ManualPlan {
    const row = db.prepare('SELECT * FROM plan WHERE campaign_id=? AND id=?').get(campaignId, id);
    if (!row) throw new Error('Plan nicht gefunden.');
    const scenes = db.prepare('SELECT * FROM planned_visit WHERE campaign_id=? AND plan_id=? ORDER BY ordinal').all(campaignId, id).map((visit: Row) => {
      if (hash(visit.payload) !== visit.checksum) throw new Error('Szenenprüfung fehlgeschlagen.');
      return JSON.parse(visit.payload);
    });
    return manualPlan({ version: 1, id: row.id, revision: row.revision, name: row.name, scenes });
  }
  changePreparation(command: PreparationCommand): Preparation {this.commitPreparation(command);return this.preparation(command.token);}
  changePreparationPlan(command:PreparationCommand):ManualPlan {
    if(command.change.kind!=='plan')throw new Error('Gezielte Planänderung benötigt einen Spielabendplan.');
    const id=command.change.plan.id;
    return this.db.transaction(()=>{
      this.commitPreparation(command);
      return this.readPlan(this.guard(command.token),id);
    }).immediate();
  }
  reconcilePreparationPlan(command:PreparationCommand,token=command.token):import('../preparation-contracts').PlanReconciliation {
    if(command.change.kind!=='plan')throw new Error('Gezielte Planklärung benötigt einen Spielabendplan.');
    const change=command.change;
    return this.db.transaction(()=>{
      const cam=this.guard(token,command.campaignId??this.active?.campaignId);
      const prior=this.db.prepare('SELECT fingerprint,campaign_id,revision FROM receipt WHERE command_id=?').get(command.commandId);
      if(prior&&(prior.campaign_id!==cam||!matchesReceipt(prior,command)))throw new Error('Änderungskennung bereits anders verwendet.');
      if(!prior&&command.campaignId===undefined&&command.token!==token)throw new Error('Der alte Auftrag besitzt keine eindeutige Kampagnenbindung.');
      const row=this.db.prepare('SELECT revision FROM plan WHERE campaign_id=? AND id=?').get(cam,change.plan.id);
      const unchanged=change.expectedRevision===null?!row:row?.revision===change.expectedRevision;
      let plan:ManualPlan|null=null;
      if(row)try{plan=this.readPlan(cam,change.plan.id);}catch{/* Keep unreadable original bytes and the unresolved draft. */}
      return{outcome:prior?'applied':unchanged?'not-applied':'conflict',targetChanged:(prior?row?.revision!==prior.revision:!unchanged)||!!row&&!plan,plan};
    })();
  }
  changePreparationContent(command:PreparationCommand){if(command.change.kind!=='note'&&command.change.kind!=='location')throw new Error('Gezielte Änderung benötigt Notiz oder Ort.');this.commitPreparation(command);const cam=this.guard(command.token);return deskContent(this.db,cam,command.change.kind==='note'?{kind:'note',id:command.change.note.id}:{kind:'location',id:command.change.document.id});}
  reconcilePreparationContent(command:PreparationCommand,token:string){const cam=this.guard(token,command.campaignId),target=preparationTarget(command.change),r=this.db.prepare('SELECT * FROM receipt WHERE command_id=?').get(command.commandId),table=target.kind==='note'?'world_note':target.kind==='location'?'location':'plan',current=this.db.prepare(`SELECT revision FROM ${table} WHERE campaign_id=? AND id=?`).get(cam,target.id);if(r){if(r.campaign_id!==cam||!matchesReceipt(r,command))throw new Error('Änderungskennung anders verwendet.');return{outcome:'applied' as const,targetChanged:current?.revision!==r.revision};}const changed=(current?.revision??null)!==command.change.expectedRevision;return{outcome:changed?'conflict' as const:'not-applied' as const,targetChanged:changed};}
  executeWorldRelationPair(command:WorldRelationPairCommand){return executeWorldRelationPair(this.db,command,()=>{this.guard(command.token,command.campaignId);});}
  reconcileWorldRelationPair(command:WorldRelationPairCommand,token:string){return reconcileWorldRelationPair(this.db,command,this.guard(token,command.campaignId));}
  worldRelationPairDraft(token:string,sourceId:string){return readWorldRelationPairDraft(this.db,this.guard(token),sourceId);}
  keepWorldRelationPairDraft(token:string,draft:WorldRelationPairDraft,expected:string|null){keepWorldRelationPairDraft(this.db,this.guard(token,draft.command.campaignId),draft,expected);}
  discardWorldRelationPairDraft(token:string,sourceId:string,writeId:string){discardWorldRelationPairDraft(this.db,this.guard(token),sourceId,writeId);}
  worldRelationPairHistory(token:string){return readWorldRelationPairHistory(this.db,this.guard(token));}
  executeWorldRelationPairHistory(command:WorldRelationPairHistoryCommand){return executeWorldRelationPairHistory(this.db,command,()=>{this.guard(command.token,command.campaignId);});}
  reconcileWorldRelationPairHistory(command:WorldRelationPairHistoryCommand,token:string){return reconcileWorldRelationPairHistory(this.db,command,this.guard(token,command.campaignId));}
  private commitPreparation(command: PreparationCommand): void {
    if (typeof command.commandId !== 'string' || !command.commandId) throw new Error('Änderungskennung fehlt.');
    const change = validatePreparation(command.change), fingerprint = commandFingerprint(command);
    this.db.transaction(() => {
      const campaignId = this.guard(command.token, command.campaignId ?? this.active?.campaignId);
      const prior = this.db.prepare('SELECT fingerprint,campaign_id FROM receipt WHERE command_id=?').get(command.commandId);
      if (prior) { if (prior.campaign_id !== campaignId || !matchesReceipt(prior, command)) throw new Error('Änderungskennung bereits anders verwendet.'); return; }
      let targetId: string, revision: number;
      if(change.kind==='note-merge'){
        if(this.graphShadow)throw new Error('Die offene Dungeonvorschau zuerst abschließen.');
        const work=noteMergeWork(this.db,campaignId,change.id,change.targetId),p=work.preview;
        if(work.source.revision!==change.expectedRevision||work.target.revision!==change.expectedTargetRevision||p.basis!==change.basis)throw new Error('Zusammenführungskonflikt: Originale oder Verweise wurden geändert. Vorschau erneut prüfen.');
        if(p.blockers.length)throw new Error(p.blockers.join(' '));
        let index=0;const nested=(next:PreparationChange)=>this.commitPreparation({commandId:command.commandId+'|merge:'+index++,campaignId,token:command.token,change:next});
        nested({kind:'note',expectedRevision:work.target.revision,note:{...work.target,readAloud:work.remap(change.readAloud),gmNotes:work.remap(change.gmNotes),relations:work.targetRelations}});
        for(const note of work.notes)nested({kind:'note',expectedRevision:note.revision,note});
        for(const location of work.locations)nested({kind:'location',...location});
        for(const {key,refs} of work.keys)executeDrawing(this.db,{commandId:command.commandId+'|merge:key:'+key.id,campaignId,token:command.token,action:{kind:'key-content',expectedRevision:key.revision,content:{...key,references:refs}}},()=>{this.guard(command.token,campaignId);});
        for(const v of work.visits)this.executeSession({commandId:command.commandId+'|merge:visit:'+v.detail.visitId,campaignId,token:command.token,action:{kind:'visit',planId:v.planId,expectedRevision:v.detail.revision,detail:{...v.detail,noteIds:[...new Set(v.detail.noteIds.map(id=>id===change.id?change.targetId:id))]}}});
        nested({kind:'note-trash',id:change.id,expectedRevision:work.source.revision,trashed:true});
        targetId=change.id;revision=work.source.revision+1;
      } else if (change.kind === 'note') {
        targetId = change.note.id;
        const old = this.db.prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?').get(campaignId, targetId);
        if (change.expectedRevision === null ? !!old : !old || old.revision !== change.expectedRevision || old.trashed) throw new Error('Notizkonflikt: Der gespeicherte Stand hat sich geändert.');
        const oldNote = old ? checkedWorldNoteRow(old, 'Beschädigte Notiz darf nicht überschrieben werden.') : null;
        const source=change.excerpt;
        let sourceNote:Note|null=null;
        if(source){
          const row=this.db.prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?').get(campaignId,source.id);
          if(!row||row.trashed||row.revision!==source.revision)throw new Error('Auszugskonflikt: Die Quelle wurde geändert oder ist nicht verfügbar.');
          sourceNote=checkedWorldNoteRow(row,'Beschädigte Quelle bleibt unverändert.');
          const selected=sourceNote[source.field].slice(source.start,source.end),other=source.field==='gmNotes'?'readAloud':'gmNotes';
          if(source.end>sourceNote[source.field].length||!selected.trim())throw new Error('Der Auszug stimmt nicht mit der markierten Quelle überein.');
          if(oldNote){
            if(this.db.prepare("SELECT 1 FROM preparation_draft WHERE campaign_id=? AND kind='note' AND target_id=?").get(campaignId,oldNote.id))throw new Error('Dieses Original hat einen offenen Arbeitsentwurf. Erst im Originaleditor aufklären.');
            const expected=worldNoteDocument(appendNoteExcerpt(oldNote,sourceNote,source.field,selected));
            if(json(expected)!==json(change.note))throw new Error('Die Ergänzung stimmt nicht mit Original und markierter Quelle überein.');
          }else{
            if(change.note[source.field]!==selected||change.note[other]!==''||change.note.relations.length!==1||change.note.relations[0]?.targetId!==source.id||change.note.relations[0]?.label!=='Quelle'||change.note.relations[0]?.familyKind!==undefined)throw new Error('Der Auszug stimmt nicht mit der markierten Quelle überein.');
            if(!source.allowSameTitle&&hasNoteTitle(this.db,campaignId,change.note.title))throw new Error('Diesen Namen gibt es bereits. Vorhandene Notiz wählen oder ausdrücklich eigenständig neu anlegen.');
          }
        }
        if (oldNote && oldNote.kind !== change.note.kind) throw new Error('Die Notizart bleibt an ihrer Identität gebunden.');
        if(oldNote?.relations.some(relation=>relation.familyKind&&!change.note.relations.some(next=>next.targetId===relation.targetId&&next.label===relation.label&&next.familyKind===relation.familyKind)))throw new Error('Familienbeziehungen werden nur als vollständiges Paar geändert.');
        for (const relation of change.note.relations) {
          const target = this.db.prepare('SELECT trashed FROM world_note WHERE campaign_id=? AND id=?').get(campaignId, relation.targetId);
          const retained = oldNote?.relations.some(r => r.targetId === relation.targetId && r.label === relation.label && r.familyKind === relation.familyKind);
          if(relation.familyKind&&!retained)throw new Error('Familienbeziehungen werden atomar im Zusammenhangsplan angelegt.');
          if (!target || target.trashed && !retained) throw new Error('Beziehung zeigt nicht auf eine verfügbare Notiz.');
        }
        revision = (old?.revision ?? 0) + 1;
        const note: Note = { ...change.note, revision }, payload = json(note);
        rememberSourceUnlink(this.db,campaignId,command.commandId,oldNote,note);
        this.db.prepare('INSERT INTO world_note VALUES(?,?,?,0,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum').run(campaignId, targetId, revision, payload, hash(payload));
        this.db.prepare('DELETE FROM note_search WHERE campaign_id=? AND note_id=?').run(campaignId, targetId);
        this.db.prepare('INSERT INTO note_search(campaign_id,note_id,title,body) VALUES(?,?,?,?)').run(campaignId, targetId, note.title, note.readAloud + '\n' + note.gmNotes);
        if(sourceNote&&!sourceNote.relations.some(r=>r.targetId===note.id&&r.label==='Auszug')){
          // Reuse the canonical writer inside this transaction: index, checksum,
          // receipt and both directions either all publish or all roll back.
          this.commitPreparation({commandId:command.commandId+'|excerpt-source',campaignId,token:command.token,change:{kind:'note',expectedRevision:sourceNote.revision,note:{...sourceNote,relations:[...sourceNote.relations,{targetId:note.id,label:'Auszug'}]}}});
        }
        if(oldNote?.kind==='npc'&&oldNote.title!==note.title)syncOpenMaskHealth(this.db,campaignId,undefined,new Map([[targetId,{before:oldNote.title,after:note.title}]]));
      } else if (change.kind === 'note-trash') {
        targetId = change.id;
        const old = this.db.prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?').get(campaignId, targetId);
        if (!old || old.revision !== change.expectedRevision || !!old.trashed === change.trashed) throw new Error('Papierkorbkonflikt: Notizstand hat sich geändert.');
        const note = checkedWorldNoteRow(old, 'Beschädigte Notiz bleibt gesperrt.'); revision = old.revision + 1;
        if(change.trashed&&note.kind==='npc'&&this.db.prepare(`SELECT 1 FROM city_unit WHERE campaign_id=? AND (EXISTS(SELECT 1 FROM json_each(city_unit.payload,'$.residentIds') WHERE value=?) OR EXISTS(SELECT 1 FROM json_each(city_unit.payload,'$.workerIds') WHERE value=?)) LIMIT 1`).get(campaignId,targetId,targetId))throw new Error('NPC ist noch als Stadtbewohner oder Arbeitsplatzbindung verwendet. Bindung zuerst am Haus lösen.');
        const payload = json({ ...note, revision });
        this.db.prepare('UPDATE world_note SET trashed=?,revision=?,payload=?,checksum=? WHERE campaign_id=? AND id=?').run(Number(change.trashed), revision, payload, hash(payload), campaignId, targetId);
      } else if (change.kind === 'location') {
        targetId = change.document.id;
        const old = this.db.prepare('SELECT * FROM location WHERE campaign_id=? AND id=?').get(campaignId, targetId);
        if (change.expectedRevision === null ? !!old : !old || old.revision !== change.expectedRevision || old.trashed) throw new Error('Ortskonflikt: Der gespeicherte Stand hat sich geändert.');
        if (old) this.decodeLocation(old, 'Beschädigter Ort darf nicht überschrieben werden.');
        for (const map of change.document.detailMaps) {
          if (map.kind !== 'dungeon' || !this.db.prepare('SELECT 1 FROM scope WHERE campaign_id=? AND id=?').get(campaignId, map.documentId)) throw new Error('Die gewählte Karte gehört nicht zu dieser Kampagne.');
          const bound = this.db.prepare('SELECT location_id FROM location_map WHERE campaign_id=? AND scope_id=?').get(campaignId, map.documentId);
          if (bound && bound.location_id !== targetId) throw new Error('Diese Dungeonzeichnung gehört bereits zu einem anderen Ort. Bindung zuerst dort ausdrücklich lösen.');
        }
        revision = (old?.revision ?? 0) + 1;
        const payload = json(change.document);
        this.db.prepare('INSERT INTO location VALUES(?,?,?,0,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum').run(campaignId, targetId, revision, payload, hash(payload));
        this.db.prepare('DELETE FROM location_map WHERE campaign_id=? AND location_id=?').run(campaignId, targetId);
        for (const map of change.document.detailMaps) this.db.prepare('INSERT INTO location_map VALUES(?,?,?)').run(campaignId, map.documentId, targetId);
      } else if (change.kind === 'location-trash') {
        targetId = change.id;
        const old = this.db.prepare('SELECT * FROM location WHERE campaign_id=? AND id=?').get(campaignId, targetId);
        if (!old || old.revision !== change.expectedRevision || !!old.trashed === change.trashed) throw new Error('Orts-Papierkorbkonflikt: Stand hat sich geändert.');
        this.decodeLocation(old, 'Beschädigter Ort bleibt gesperrt.');
        revision = old.revision + 1;
        this.db.prepare('UPDATE location SET trashed=?,revision=? WHERE campaign_id=? AND id=?').run(Number(change.trashed), revision, campaignId, targetId);
      } else {
        targetId = change.plan.id;
        const old = this.db.prepare('SELECT revision FROM plan WHERE campaign_id=? AND id=?').get(campaignId, targetId);
        if (change.expectedRevision === null ? !!old : !old || old.revision !== change.expectedRevision) throw new Error('Plankonflikt: Der gespeicherte Stand hat sich geändert.');
        const beforePlan = old ? this.readPlan(campaignId, targetId) : null;
        const beforeVisits=new Map(beforePlan?.scenes.map(scene=>[scene.id,scene]));
        const nextIds=new Set(change.plan.scenes.map(scene=>scene.id));
        const locationState=this.db.prepare('SELECT trashed FROM location WHERE campaign_id=? AND id=?');
        for (const scene of change.plan.scenes) if (scene.locationId !== null) {
          const location = locationState.get(campaignId, scene.locationId);
          const retained = beforeVisits.get(scene.id)?.locationId === scene.locationId;
          if (!location || location.trashed && !retained) throw new Error('Szenenort ist nicht verfügbar. Wähle einen aktuellen Ort oder lasse die Szene ortlos.');
        }
        revision = (old?.revision ?? 0) + 1;
        this.db.prepare('INSERT INTO plan VALUES(?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET revision=excluded.revision,name=excluded.name').run(campaignId, targetId, revision, change.plan.name);
        const existing = this.db.prepare('SELECT * FROM planned_visit WHERE campaign_id=? AND plan_id=?').all(campaignId, targetId) as Row[];
        const existingVisits=new Map(existing.map(visit=>[visit.id,visit]));
        for (const visit of existing) if (!nextIds.has(visit.id)) this.db.prepare('DELETE FROM planned_visit WHERE campaign_id=? AND id=?').run(campaignId, visit.id);
        change.plan.scenes.forEach((scene, ordinal) => {
          const foreign = this.db.prepare('SELECT plan_id FROM planned_visit WHERE campaign_id=? AND id=?').get(campaignId, scene.id);
          if (foreign && foreign.plan_id !== targetId) throw new Error('Szenenidentität gehört zu einem anderen Plan.');
          const payload = json(scene), before = existingVisits.get(scene.id);
          if (!before || before.ordinal !== ordinal || before.payload !== payload) this.db.prepare('INSERT INTO planned_visit VALUES(?,?,?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET ordinal=excluded.ordinal,payload=excluded.payload,checksum=excluded.checksum').run(campaignId, targetId, scene.id, ordinal, payload, hash(payload));
        });
      }
      if(change.kind==='plan')cleanSessionVisits(this.db,campaignId,change.plan.id,change.plan.scenes.map(s=>s.id));
      if(change.kind==='plan'&&change.opening){const o=change.opening;if(o.noteThread!==undefined){checkNoteThread(this.db,campaignId,o.noteThread);const ids=[...o.noteThread.entries.map(e=>e.id),...(o.noteThread.includeRoot?[o.noteThread.rootId]:[])];if(ids.some(id=>!o.noteIds.includes(id)))throw new Error('Notizmappenauswahl passt nicht zum neuen Besuch.');}
        this.executeSession({commandId:command.commandId+'|opening',campaignId,token:command.token,action:{kind:'visit',planId:change.plan.id,expectedRevision:0,detail:{visitId:o.visitId,revision:0,readAloud:o.readAloud,noteIds:o.noteIds,groupIds:[],reward:null}}});
      }
      applySceneCreation(this.db,campaignId,command);
      this.db.prepare('INSERT INTO receipt VALUES(?,?,?,?,?)').run(command.commandId, fingerprint, campaignId, targetId, revision);
      const target = preparationTarget(command.change), savedDraft = this.db.prepare('SELECT * FROM preparation_draft WHERE campaign_id=? AND kind=? AND target_id=?').get(campaignId, target.kind, target.id);
      if (savedDraft && this.decodePreparationDraft(savedDraft).writeId === command.draftWriteId) this.db.prepare('DELETE FROM preparation_draft WHERE campaign_id=? AND kind=? AND target_id=?').run(campaignId, target.kind, target.id);
    }).immediate();
  }
  selectPreparation(token: string, selection: PreparationSelection): void {
    this.db.transaction(() => {
      const campaignId = this.guard(token);
      if (selection.noteId !== null && !this.db.prepare('SELECT 1 FROM world_note WHERE campaign_id=? AND id=?').get(campaignId, selection.noteId)) throw new Error('Notizauswahl ist nicht verfügbar.');
      if (selection.planId !== null && !this.db.prepare('SELECT 1 FROM plan WHERE campaign_id=? AND id=?').get(campaignId, selection.planId)) throw new Error('Planauswahl ist nicht verfügbar.');
      if (selection.sceneId !== null && !this.db.prepare('SELECT 1 FROM planned_visit WHERE campaign_id=? AND plan_id=? AND id=?').get(campaignId, selection.planId, selection.sceneId)) throw new Error('Szenenauswahl gehört nicht zu diesem Plan.');
      if (selection.locationId != null && !this.db.prepare('SELECT 1 FROM location WHERE campaign_id=? AND id=?').get(campaignId, selection.locationId)) throw new Error('Ortsauswahl gehört nicht zur Kampagne.');
      this.db.prepare('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(`preparation:${campaignId}`, json(selection));
    }).immediate();
  }
  reconcilePreparation(command: PreparationCommand, token = command.token): { outcome: 'applied' | 'not-applied' | 'conflict'; targetChanged: boolean; data: Preparation } {
    return this.db.transaction(() => {
      const campaignId = this.guard(token, command.campaignId ?? this.active?.campaignId), change = command.change;
      const prior = this.db.prepare('SELECT fingerprint,campaign_id,revision FROM receipt WHERE command_id=?').get(command.commandId);
      if (prior && (prior.campaign_id !== campaignId || !matchesReceipt(prior, command))) throw new Error('Änderungskennung bereits anders verwendet.');
      if (!prior && command.campaignId === undefined && command.token !== token) throw new Error('Der alte Auftrag besitzt keine eindeutige Kampagnenbindung.');
      const targetId = change.kind === 'plan' ? change.plan.id : change.kind === 'note' ? change.note.id : change.kind === 'location' ? change.document.id : change.id;
      const table = change.kind === 'plan' ? 'plan' : change.kind === 'location' || change.kind === 'location-trash' ? 'location' : 'world_note';
      const current = this.db.prepare(`SELECT revision FROM ${table} WHERE campaign_id=? AND id=?`).get(campaignId, targetId);
      const expected = change.expectedRevision;
      let unchanged = expected === null ? !current : current?.revision === expected;
      let mergeTargetChanged=false;
      if(change.kind==='note-merge'){
        const target=this.db.prepare('SELECT revision FROM world_note WHERE campaign_id=? AND id=?').get(campaignId,change.targetId);
        mergeTargetChanged=target?.revision!==change.expectedTargetRevision+(prior?1:0);
        if(!prior){try{unchanged=unchanged&&!mergeTargetChanged&&noteMergeWork(this.db,campaignId,change.id,change.targetId).preview.basis===change.basis;}catch{unchanged=false;}}
      }
      const data = this.preparation(token);
      const readable = table === 'plan' ? data.plans.some(plan => plan.id === targetId) :
        table === 'location' ? data.locations.some(row => row.document.id === targetId) : data.notes.some(row => row.note.id === targetId);
      return { outcome: prior ? 'applied' : unchanged ? 'not-applied' : 'conflict',
        targetChanged: mergeTargetChanged || (prior ? current?.revision !== prior.revision : !unchanged) || !!current && !readable, data };
    })();
  }
  keepRoomDraft(token: string, roomId: string, draft: WorkingRoomDraft | null) {
    if(this.graphShadow&&!this.graphRouting)return this.withGraph<void>(()=>this.keepRoomDraft(token,roomId,draft));
    const campaignId = this.guard(token);
    if (draft === null) { this.db.prepare('DELETE FROM room_draft WHERE campaign_id=? AND room_id=?').run(campaignId, roomId); return; }
    if (!this.db.prepare('SELECT 1 FROM room WHERE campaign_id=? AND id=?').get(campaignId, roomId)) throw new Error('Entwurf gehört nicht zum aktuellen Raum.');
    const existing = this.db.prepare('SELECT * FROM room_draft WHERE campaign_id=? AND room_id=?').get(campaignId, roomId);
    if (existing) this.decodeRoomDraft(existing);
    const payload = json(draft);
    if (payload.length > 64 * 1024 * 1024) throw new Error('Dieser Entwurf ist für den ersten Anschluss zu groß.');
    const checksum = hash(payload);
    // Validate the persisted envelope without treating unfinished text as author truth.
    this.decodeRoomDraft({ campaign_id: campaignId, room_id: roomId, payload, checksum });
    this.db.prepare('INSERT INTO room_draft VALUES(?,?,?,?) ON CONFLICT(campaign_id,room_id) DO UPDATE SET payload=excluded.payload,checksum=excluded.checksum').run(campaignId, roomId, payload, checksum);
  }
  roomDraft(token: string, roomId: string): WorkingRoomDraft | null {
    if(this.graphShadow&&!this.graphRouting)return this.withGraph(()=>this.roomDraft(token,roomId));
    const campaignId = this.guard(token), row = this.db.prepare('SELECT * FROM room_draft WHERE campaign_id=? AND room_id=?').get(campaignId, roomId);
    if (!row) return null;
    return this.decodeRoomDraft(row);
  }
  tutorial(state?: 'shown' | 'finished' | 'skipped'): TutorialRun {
    if (state !== undefined && !['shown', 'finished', 'skipped'].includes(state)) throw new Error('Ungültiger Tutorialstatus.');
    return this.db.transaction(() => {
      const key = `tutorial:app:${this.applicationVersion}`, saved = this.db.prepare('SELECT value FROM settings WHERE key=?').get(key);
      const prior: TutorialRun | null = saved ? checkedTutorialRun(JSON.parse(saved.value), this.applicationVersion) : null;
      // Onboarding belongs to an installed app version. Edited help stays available
      // without resetting this version's completed or dismissed run.
      const run: TutorialRun = prior ?? { version: this.applicationVersion, lessonRevision: tutorialLessonRevision, runId: randomUUID(), state: 'new' };
      if (state && run.state !== 'finished' && run.state !== 'skipped') run.state = state;
      this.db.prepare('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, json(run));
      return run;
    }).immediate();
  }
  renameCampaign(command: CampaignRename): Campaign {
    if (!command.commandId || typeof command.name !== 'string' || !command.name.trim() || command.name.length > 1000 || !Number.isSafeInteger(command.expectedRevision)) throw new Error('Ungültige Kampagnenumbenennung.');
    this.db.transaction(() => {
      const campaignId = this.guard(command.token, command.campaignId), fingerprint = commandFingerprint(command);
      const receipt = this.db.prepare('SELECT fingerprint,campaign_id FROM receipt WHERE command_id=?').get(command.commandId);
      if (receipt) { if (receipt.campaign_id !== campaignId || !matchesReceipt(receipt, command)) throw new Error('Änderungskennung bereits anders verwendet.'); return; }
      const current = this.db.prepare('SELECT revision FROM campaign WHERE id=?').get(campaignId);
      if (current.revision !== command.expectedRevision) throw new Error('Kampagnenname wurde inzwischen geändert.');
      this.db.prepare('UPDATE campaign SET name=?,revision=revision+1 WHERE id=?').run(command.name, campaignId);
      this.db.prepare('INSERT INTO receipt VALUES(?,?,?,?,?)').run(command.commandId, fingerprint, campaignId, campaignId, current.revision + 1);
    }).immediate();
    return this.db.prepare('SELECT id,name,revision FROM campaign WHERE id=?').get(command.campaignId);
  }
}
