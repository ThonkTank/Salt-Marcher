import {readNarrativeJournal} from './narrative-journal';
import {readSessionProgress} from './visit-outcomes';
import {readSessionPacket} from './session-packet';
import {readMaskHistory,installMaskHistoryIndexes} from './mask-history';
import {keepChaseDraft,validateChaseDrafts} from './chase-drafts';
import {readDay} from './adventuring-day';
import {installNpcRecords} from './npc-record';
import {readNpc,readNpcs,executeNpc,npcDraft,npcDrafts,keepNpcDraft,discardNpcDraft} from './npcs';
import type {NpcCommand,NpcQuery,NpcDraft} from '../npc-contracts';
import {readWorldSources,installWorldSources} from './world-sources';
import {migrateMaskHealth,syncOpenMaskHealth} from './mask-health';
import {installGroups,groupView,preparedGroups,groupDraft,keepGroupDraft,discardGroupDraft} from './groups';
import {installTreasury,readTreasuryDraft,keepTreasuryDraft,discardTreasuryDraft,treasureHistory} from './treasury';
import {installSceneDesk,readSceneDesk,searchDesk,deskContent,pinSceneDesk} from './scene-desk';
import {installFinishDrafts,readFinishDraft,keepFinishDraft,discardFinishDraft} from './finish-drafts';
import {installNarrative,readNarrative,keepNarrativeDraft,discardNarrativeDraft,validateNarrativeBackup} from './narrative';
import {readPreparedGroup} from './session';
import {installCombatDraftSchema,validateCombatDrafts,readCombatDraft,combatDrafts,keepCombatDraft,discardCombatDraft} from './combat-drafts';
import type {CombatDraftKind,CombatWorkingDraft} from '../combat-draft-contracts';
import {installContentRuntime} from './content-runtime';
import {installTriggers} from './triggers';
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
import {installVolumeSchema} from './volume';
import {installDungeonSenses,evaluateDungeonSenses} from './dungeon-senses';
import {installAutonomyResources} from './autonomy-resources';
import {installNpcDungeonSchema} from './npc-dungeon';
import {installAutonomyDungeonSchema} from './autonomy-dungeon';
import {installDungeonPlaySchema,dungeonView,previewDungeon,executeDungeon,validateDungeonPlay,dungeonGeometry} from './dungeon-play';
import type {DungeonCommand,DungeonRequest} from '../dungeon-contracts';
import {installDrawingSchema,drawingView,executeDrawing,drawingHistory,rebaseDrawingRoomHistory,activateDungeonFeature,advanceDungeonFeatures,validateDrawing} from './drawing';
import type {DrawingCommand} from '../drawing-contracts';
import {installNpcWorldSchema} from './npc-world';
import {installAutonomySchema,autonomyView,executeAutonomy,captureAutonomyBasis,recordAutonomyTime,catchUpAutonomy,validateAutonomy} from './autonomy';
import type {AutonomyCommand} from '../autonomy-contracts';
import {installPlayerSchema,playerSettings,playerView,projectPlayer,executePlayer,savePlayerAsset,playerAssets,playerMediaFiles,setPlayerWindow,validatePlayer} from './player';
import type {PlayerCommand,PlayerAsset,PlayerFrame} from '../player-contracts';
import {installCitySchema,cityOverview,readCity,executeCity,validateCities} from './city';
import type {CityCommand} from '../city-contracts';
import {installCampaignSchema,validateCapabilityBytes,validateCampaignSnapshotSettings,campaignOverview,pruneCampaignSnapshot,snapshotCounts,definitionConflicts,sharedPlan,archiveSourceChoices,remapSnapshot,publishSnapshot,trashCampaign,eraseCampaignRows} from './campaign-data';
import {openSync as openSnapshot, readSync, closeSync as closeSnapshot} from 'node:fs';
import type {ConflictChoice} from '../campaign-contracts';
import {canonicalJson} from '../generation/canonical-json';
import {installMusicSchema,readAudioAssets,readAudioAsset,readMusic,readMusicFavorites,readMusicSubject,executeMusic,saveMusicPosition,refreshMusicContext,ingestAudio,audioLibrarySnapshot,mergeAudioLibrary,audioFile,validateMusicBackup,audioMediaFiles} from './music';
import type {AudioQuery,MusicSubject,MusicCommand,AudioAsset} from '../music-contracts';
import {installWorldSchema,readWorld,readSceneWorld,previewTravel,executeWorld,reconcileWorld,syncSceneWorld,inheritScenePosition,validateWorldBackup} from './world';
import type {TravelRequest,WorldCommand} from '../world-contracts';
import {installItemsSchema,readShop,readShops,sceneShops,executeItemShop,restockDue,validateItemsBackup} from './items';
import {readItemDefinition,readItemDefinitions} from './item-definitions';
import type {ItemQuery,ItemShopCommand} from '../items-contracts';
import { createHash, randomUUID } from 'node:crypto';
import { noteSearchQuery } from './note-search-query';
import { noteSearchPreview } from './note-search-preview';
import { mkdirSync, mkdtempSync, copyFileSync, openSync, closeSync, fsyncSync, renameSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { validateRoom, validateRoomDraftContent, type Campaign, type CampaignRename, type Edit, type Room, type RoomCommit, type WorkingRoomDraft, type Workspace } from '../contracts';
import { validatePreparation, checkedPreparationDraft, preparationTarget, type PreparationDraft, type PreparationEdit, type Preparation, type PreparationCommand, type PreparationSelection, type Note } from '../preparation-contracts';
import { manualPlan, type ManualPlan } from '../../features/planner/manual-planner';
import { worldNoteDocument } from '../../features/world/world-notes';
import {campaignLocalId} from '../../features/campaign/campaign-contracts';
import { checkedLocationDocument } from '../../features/location/location-schema';
import { tutorialLessonRevision, checkedTutorialRun, type TutorialRun } from '../tutorial';
import { installLiveSchema, migrateLiveClock, ensureLiveOwners, readLive, readLiveScene, readArchives, readArchivedRoster, validateLiveBackup, executeLive, liveStatus } from './live';
import type { LiveCommand, LiveScene } from '../live-contracts';
import { reconcileCombatParticipants, installCombatSchema, readCombat, executeCombat, validateCombatBackup } from './combat';


import {installChaseSchema,readChase,executeChase,reconcileChaseParticipants,validateChaseBackup} from './chase';
import {installMaskReconciliationSchema,validateMaskReconciliations} from './mask-reconciliation';
import {installRuleReferenceSchema,readSceneRules,executeSceneRule,validateRuleReferences} from './rule-references';
import type {SceneRuleCommand} from '../rule-reference-contracts';
import {installSceneCheckSchema,readSceneChecks,executeSceneCheck,validateSceneChecks} from './scene-checks';
import type {SceneCheckCommand} from '../scene-check-contracts';
import type {ChaseCommand} from '../chase-contracts';
import type { CombatCommand } from '../combat-contracts';
import { installProgressSchema, createProgress, migrateProgress, readProgress, readProgressHistory, readLootBalance, readTreasures, readTreasure, readLedger, readLedgerInventory, readLedgerItem, executeProgress, validateProgressBackup } from './progression';
import type { ProgressCommand, LedgerQuery, LedgerInventoryQuery } from '../progression';
import {readChronicle} from './chronicle';
import { installEncounterSchema, readEncounterPlan, readEncounterPlans, saveEncounterPlan } from './encounters';
import type { EncounterPlanCommand } from '../encounter-contracts';
import { installGenerationSchema, readEncounterTables, readLootTables, readGeneratorRegistry, executeGeneration, generateEncounters, acceptGeneration, readGenerationRuns, readGenerationRun, rollLoot, validateGenerationBackup } from './generation';
import type { GenerationCommand, GenerationRequest, LootRollCommand } from '../generation-contracts';
import { installSessionSchema, readSession, executeSession, generateSession, regenerateSessionProposal,regenerateSessionReward, readSessionRuns, readSessionRun, scenePreparation, cleanSessionVisits } from './session';
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
  private db: any;
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
    if(schema===44&&!this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='chase_working_draft'").get()){this.db.close();throw new Error('Verfolgungsentwurfsspeicher fehlt. Originaldaten bleiben erhalten.');}
    if (schema > 44) { this.db.close(); throw new Error('Diese Datenbank benötigt eine neuere Appversion.'); }
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
      installContentRuntime(this.db);installNarrative(this.db);installFinishDrafts(this.db);installSceneDesk(this.db);installTreasury(this.db);installGroups(this.db);
      if(schema<41)migrateMaskHealth(this.db);
      this.db.pragma('user_version=44');

    }).immediate();
  }
  extensionPreview(bytes:Buffer){return this.extensionRegistry.preview(bytes);}
  extensions(after:string|null){return this.extensionRegistry.list(after);}
  executeExtension(command:ExtensionCommand){return this.extensionRegistry.execute(command);}
  extensionOutcome(command:ExtensionCommand){return this.extensionRegistry.outcome(command);}
  close() { this.extensionRegistry.dispose();this.graphShadow?.dispose();this.graphShadow=null;this.db.close(); }
  list(): { campaigns: Campaign[]; activeId: string | null } {
    return { campaigns: this.db.prepare('SELECT c.id,c.name,c.revision FROM campaign c JOIN campaign_lifecycle l ON l.campaign_id=c.id WHERE l.trashed=0 ORDER BY c.name,c.id').all(), activeId: this.db.prepare("SELECT value FROM settings WHERE key='active'").get()?.value ?? null };
  }
  create(name: string, rooms: Room[] = [], source?: Buffer): Campaign {
    if (typeof name !== 'string' || !name.trim() || name.length > 1000) throw new Error('Bitte einen Kampagnennamen eingeben.');
    const campaign = { id: randomUUID(), name, revision: 0 };
    this.db.transaction(() => {
      this.db.prepare('INSERT INTO campaign(id,name) VALUES(?,?)').run(campaign.id, name);
      this.db.prepare('INSERT INTO campaign_lifecycle VALUES(?,0,0)').run(campaign.id);
      ensureLiveOwners(this.db, campaign.id);
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
      for (const room of rooms) { validateRoom(room); this.insertRoom(campaign.id, room); }
      if (source) this.db.prepare('INSERT INTO source VALUES(?,?,?)').run(campaign.id, source, hash(source));
    }).immediate();
    return campaign;
  }
  private insertRoom(campaignId: string, room: Room) {
    const payload = json({ polygons: room.polygons, sections: room.sections });
    this.db.prepare('INSERT INTO room VALUES(?,?,?,?,?,?,?,?,?)').run(campaignId, room.id, room.scopeId, room.number, room.name, 0, payload, hash(payload), room.floorId);
  }
  activate(campaignId: string): Workspace {
    if(this.graphShadow&&this.graphShadow.campaignId!==campaignId)throw new Error('Offene Graphvorschau zuerst übernehmen oder Ursprung wiederherstellen.');
    if (!this.db.prepare('SELECT c.id FROM campaign c JOIN campaign_lifecycle l ON l.campaign_id=c.id WHERE c.id=? AND l.trashed=0').get(campaignId)) throw new Error('Kampagne nicht gefunden.');
    this.active = { campaignId, token: randomUUID() };
    this.db.prepare("INSERT INTO settings VALUES('active',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(campaignId);
    return this.workspace();
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
      if (!value || value.id !== room.id || value.scopeId !== room.scopeId || value.floorId !== room.floorId || value.number !== room.number || !Number.isSafeInteger(value.revision) || value.revision < 0) throw new Error('Raumhistory zeigt nicht auf ihren ursprünglichen Raum. Originaldaten bleiben erhalten.');
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
  private decodeNote(row: Row, checksumError = 'Notizprüfung fehlgeschlagen.'): Note {
    if (hash(row.payload) !== row.checksum) throw new Error(checksumError);
    return worldNoteDocument(JSON.parse(row.payload));
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
    return checkedLocationDocument(JSON.parse(row.payload));
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
  addRoom(token: string): Workspace {
    if(this.graphShadow&&!this.graphRouting)return this.withGraph(()=>this.addRoom(token));
    this.db.transaction(() => {
      const campaignId = this.guard(token);
      const n = this.db.prepare('SELECT count(*) n FROM room WHERE campaign_id=?').get(campaignId).n + 1;
      const scopeId=this.db.prepare('SELECT value FROM settings WHERE key=?').get('default-scope:'+campaignId)?.value??'local',floorId=this.db.prepare('SELECT id FROM drawing_floor WHERE campaign_id=? AND scope_id=? ORDER BY rowid LIMIT 1').get(campaignId,scopeId)?.id??'ground';
      const room: Room = { id: randomUUID(), scopeId, floorId, name: 'Neuer Raum', number: String(n), revision: 0, polygons: [{ outer: [{ x: 0, y: 0 }, { x: 6.096, y: 0 }, { x: 6.096, y: 4.572 }, { x: 0, y: 4.572 }], holes: [] }], sections: [{ id: randomUUID(), kind: 'markdown', markdown: '## Beschreibung\n' }] };
      this.insertRoom(campaignId, room); this.db.prepare('UPDATE campaign SET selected_id=? WHERE id=?').run(room.id, campaignId);
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
  private validateDatabase(db: any,validateExtensions=true) {
    if(validateExtensions)validateExtensionSettings(db);
    validateCapabilityBytes(db);
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
    for (const row of db.prepare('SELECT * FROM world_note').iterate()) this.decodeNote(row, 'Beschädigte Notiz im Backupkandidaten.');
    for (const row of db.prepare('SELECT * FROM location').iterate()) this.decodeLocation(row, 'Beschädigter Ort im Backupkandidaten.');
    for (const row of db.prepare('SELECT campaign_id,id FROM plan').iterate()) this.readPlan(row.campaign_id, row.id, db);
    for (const row of db.prepare('SELECT id FROM campaign').all()) validateLiveBackup(db, row.id);
    validateCombatBackup(db);validateCombatDrafts(db);validateChaseBackup(db);validateChaseDrafts(db);validateMaskReconciliations(db);validateRuleReferences(db);validateSceneChecks(db);
    validateProgressBackup(db);validateNarrativeBackup(db);
    validateItemsBackup(db);
    validateWorldBackup(db);
    validateCities(db);
    validatePlayer(db);
    validateDungeonPlay(db);
    validateAutonomy(db);
    validateDrawing(db);
    validateMusicBackup(db);
    validateGenerationBackup(db);
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
  private async backupDatabase(filename:string,validateExtensions:boolean){
    const epoch=this.backupEpoch,candidate = filename + '.candidate-' + randomUUID();
    try {
      await this.db.backup(candidate);
      const db = new Database(candidate, { readonly: true, fileMustExist: true });
      try {
        this.validateDatabase(db,validateExtensions);
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
  async backup(filename:string){await this.backupDatabase(filename,true);}
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
          const note = this.decodeNote(row), searchPreview = noteSearchPreview(row.search_preview,note,marks);
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
  npcDrafts(token:string){return npcDrafts(this.db,this.guard(token));}
  npcDraft(token:string,id:string){return npcDraft(this.db,this.guard(token),id);}
  keepNpcDraft(token:string,d:NpcDraft,expected:string|null){return keepNpcDraft(this.db,this.guard(token),d,expected);}
  discardNpcDraft(token:string,id:string,writeId:string){return discardNpcDraft(this.db,this.guard(token),id,writeId);}
  npcs(token:string,q:NpcQuery){return readNpcs(this.db,this.guard(token),q);}
  npc(token:string,id:string){return readNpc(this.db,this.guard(token),id);}
  executeNpc(c:NpcCommand){return executeNpc(this.db,c,()=>{this.guard(c.token,c.campaignId);});}
  generationSources(token:string){return readWorldSources(this.db,this.guard(token));}
  sessionProgress(token:string,planId:string,sceneId?:string){return readSessionProgress(this.db,this.guard(token),planId,sceneId);}
  sessionPacket(token:string,planId:string){return readSessionPacket(this.db,this.guard(token),planId);}
  session(token: string,planId: string) { return readSession(this.db,this.guard(token),planId); }
  executeSession(command: SessionCommand) { return executeSession(this.db,command,()=>{this.guard(command.token,command.campaignId);},(plan,expectedRevision)=>{this.changePreparation({commandId:command.commandId+'|timeline',campaignId:command.campaignId,token:command.token,change:{kind:'plan',plan,expectedRevision}});}); }
  generateSession(token: string,request: SessionGenerationRequest) { return generateSession(this.db,this.guard(token),request); }
  regenerateSessionReward(token:string,runId:string,index:number,seed:string){return regenerateSessionReward(this.db,this.guard(token),runId,index,seed);}
  regenerateSessionProposal(token: string,runId: string,index: number,seed: string) { return regenerateSessionProposal(this.db,this.guard(token),runId,index,seed); }
  sessionRuns(token: string,planId: string) { return readSessionRuns(this.db,this.guard(token),planId); }
  sessionRun(token: string,id: string) { return readSessionRun(this.db,this.guard(token),id); }
  scenePreparation(token: string,sceneId: string) { return scenePreparation(this.db,this.guard(token),sceneId); }
  sceneRules(token:string,sceneId:string){return readSceneRules(this.db,this.guard(token),sceneId);}
  executeSceneRule(command:SceneRuleCommand){return executeSceneRule(this.db,command,()=>this.guard(command.token,command.campaignId));}
  sceneChecks(token:string,sceneId:string){return readSceneChecks(this.db,this.guard(token),sceneId);}
  executeSceneCheck(command:SceneCheckCommand){return executeSceneCheck(this.db,command,()=>this.guard(command.token,command.campaignId));}
  encounterTables(token: string, includeTrashed: boolean) { return readEncounterTables(this.db,this.guard(token),includeTrashed); }
  lootTables(token: string, includeTrashed: boolean) { return readLootTables(this.db,this.guard(token),includeTrashed); }
  generatorRegistry(token: string) { return readGeneratorRegistry(this.db,this.guard(token)); }
  executeGeneration(command: GenerationCommand) { return executeGeneration(this.db,command,()=>{this.guard(command.token,command.campaignId);}); }
  generateEncounters(token: string, request: GenerationRequest) { return generateEncounters(this.db,this.guard(token),request); }
  acceptGeneration(command: Parameters<typeof acceptGeneration>[1]) { return acceptGeneration(this.db,command,()=>{this.guard(command.token,command.campaignId);}); }
  generationRuns(token: string) { return readGenerationRuns(this.db,this.guard(token)); }
  generationRun(token: string, id: string) { return readGenerationRun(this.db,this.guard(token),id); }
  rollLoot(command: LootRollCommand) { return rollLoot(this.db,command,()=>{this.guard(command.token,command.campaignId);}); }
  encounterPlans(token: string, search: string) { return readEncounterPlans(this.db,this.guard(token),search); }
  encounterPlan(token: string, id: string) { return readEncounterPlan(this.db,this.guard(token),id); }
  saveEncounterPlan(command: EncounterPlanCommand) { return saveEncounterPlan(this.db,command,()=>{this.guard(command.token,command.campaignId);}); }
  progressHistory(token: string, characterId: string, after: string | null) { return readProgressHistory(this.db, this.guard(token), characterId, after); }
  keepChaseDraft(token:string,draft:import('../chase-draft-contracts').ChaseWorkingDraft,expected:string|null){return keepChaseDraft(this.db,this.guard(token),draft,expected);}
  maskHistory(token:string,sceneId:string,query:import('../mask-history-contracts').MaskHistoryQuery){return readMaskHistory(this.db,this.guard(token),sceneId,query);}
  chase(token:string,sceneId:string,id?:string){return readChase(this.db,this.guard(token),sceneId,id);}
  executeChase(c:ChaseCommand){return executeChase(this.db,c,()=>this.guard(c.token,c.campaignId));}
  chronicle(token:string,category:import('../chronicle-contracts').ChronicleCategory|'all'='all',search=''){return readChronicle(this.db,this.guard(token),category,search);}
  progress(token: string) { return readProgress(this.db, this.guard(token)); }
  lootBalance(token:string){return readLootBalance(this.db,this.guard(token));}
  treasures(token: string, after: string | null) { return readTreasures(this.db, this.guard(token), after); }
  treasure(token: string, id: string) { return readTreasure(this.db, this.guard(token), id); }
  ledger(token: string, query: LedgerQuery) { return readLedger(this.db, this.guard(token), query); }
  ledgerInventory(token:string,query:LedgerInventoryQuery){return readLedgerInventory(this.db,this.guard(token),query);}
  ledgerItem(token: string, id: string) { return readLedgerItem(this.db, this.guard(token), id); }
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
  keepDeskDraft(token:string,draft:PreparationDraft,expected:string|null){return this.db.transaction(()=>{const target=preparationTarget(draft.change),old=this.preparationDraft(token,target.kind,target.id);if((old?.writeId??null)!==expected)throw new Error('Notizeingabe inzwischen an anderer Stelle geändert.');this.keepPreparationDrafts(token,[draft]);}).immediate();}
  finishDraft(token:string,owner:import('../finish-draft-contracts').FinishOwner){return readFinishDraft(this.db,this.guard(token),owner);}
  keepFinishDraft(token:string,draft:import('../finish-draft-contracts').FinishDraft,expected:string|null){return keepFinishDraft(this.db,this.guard(token),draft,expected);}
  discardFinishDraft(token:string,owner:import('../finish-draft-contracts').FinishOwner,writeId:string){return discardFinishDraft(this.db,this.guard(token),owner,writeId);}
  keepNarrativeDraft(token:string,draft:import('../narrative-contracts').NarrativeDraft,expected:string|null){return keepNarrativeDraft(this.db,this.guard(token),draft,expected);}
  discardNarrativeDraft(token:string,id:string,writeId:string){return discardNarrativeDraft(this.db,this.guard(token),id,writeId);}
  narrativeJournal(token:string,query:import('../narrative-journal-contracts').NarrativeJournalQuery){return readNarrativeJournal(this.db,this.guard(token),query);}
  narrative(token:string,id:string){return readNarrative(this.db,this.guard(token),id);}
  adventuringDay(token:string,request:import('../adventuring-day-contracts').DayRequest){return this.db.transaction(()=>readDay(this.db,this.guard(token),request))();}
  executeProgress(command: ProgressCommand) { return this.db.transaction(() => {
    this.guard(command.token,command.campaignId);
    const a=command.action,guard=()=>{this.guard(command.token,command.campaignId);};
    if(a.kind!=='rest'||!a.scene||this.db.prepare('SELECT 1 FROM progress_receipt WHERE command_id=?').get(command.commandId))return executeProgress(this.db,command,guard);
    const current=readLive(this.db,command.campaignId),scene=readLiveScene(this.db,command.campaignId,a.scene.id);
    if(current.focusId!==scene.id||current.focusRevision!==a.scene.expectedFocusRevision||scene.membershipRevision!==a.scene.expectedMembershipRevision||scene.clock.revision!==a.scene.expectedClockRevision||scene.retired)throw new Error('Rastgruppe oder Szenenzeit geändert. Aktuellen Spieltisch laden.');
    if(this.db.prepare("SELECT 1 FROM chase WHERE campaign_id=? AND scene_id=? AND status='running'").get(command.campaignId,scene.id))throw new Error('Verfolgung vor der zeitgebundenen Rast abschließen.');
    if(!a.recipients.every(r=>scene.members.includes(r.characterId)))throw new Error('Zeitgebundene Rast nur mit Figuren dieser Szene.');
    const result=executeProgress(this.db,command,guard),clock=this.executeLive({commandId:command.commandId+'|rest-clock',campaignId:command.campaignId,token:command.token,action:{kind:'advance-clock',sceneId:scene.id,expectedRevision:a.scene.expectedClockRevision,amount:a.scene.amount,unit:a.scene.unit,calendarVersion:'relative-v1',reason:(a.rest==='long'?'Lange':'Kurze')+' Rast · '+a.recipients.length+' Figuren'}});
    result.restScene=clock.scene;const payload=json(result);this.db.prepare('UPDATE progress_receipt SET payload=?,checksum=? WHERE command_id=?').run(payload,hash(payload),command.commandId);
    return result;
  }).immediate(); }
  preparedGroup(token:string,id:string){return readPreparedGroup(this.db,this.guard(token),id);}
  dungeon(token:string){const cam=this.guard(token),view=dungeonView(this.db,cam);return this.graphShadow?{...view,...dungeonGeometry(this.graphShadow.db,cam),drawing:{...drawingView(this.graphShadow.db,cam),graphPreview:this.graphShadow.state()}}:view;}
  previewDungeon(token:string,r:DungeonRequest){return previewDungeon(this.db,this.guard(token),r);}
  executeDungeon(c:DungeonCommand){if(this.graphShadow)throw new Error('Graphvorschau zuerst übernehmen oder Ursprung wiederherstellen. Dungeon-Leiten nutzt die bestätigte Geometrie.');return executeDungeon(this.db,c,()=>{this.guard(c.token,c.campaignId);},command=>this.executeLive(command),command=>this.executeCombat(command),command=>this.executeProgress(command));}
  previewPath(token:string,p:DungeonPath):PathPreview{if(this.graphShadow&&!this.graphRouting)return this.withGraph(()=>this.previewPath(token,p));const cam=this.guard(token);return previewDungeonPath(this.db,cam,p,dungeonGeometry(this.db,cam));}
  drawing(token:string):DrawingView{if(this.graphShadow&&!this.graphRouting)return this.withGraph(()=>this.drawing(token));return{...drawingView(this.db,this.guard(token)),graphPreview:this.graphShadow?.state()};}
  executeDrawing(c:DrawingCommand):{workspace:Workspace;view:DrawingView}{if(c.action.kind==='graph-commit')throw new Error('Graphübernahme ist nur über die geschützte Vorschau möglich.');if(this.graphShadow&&!this.graphRouting){if(c.action.kind==='element')validateDungeonPlacement(this.db,c.campaignId,c.action.element,this.graphShadow.scopeId);return this.withGraph(()=>this.executeDrawing(c));}executeDrawing(this.db,c,()=>{this.guard(c.token,c.campaignId);});return{workspace:this.workspace(),view:{...drawingView(this.db,c.campaignId),graphPreview:this.graphShadow?.state()}};}
  activateFeature(token:string,id:string,sceneId:string,expected:number,action:'activate'|'reset'|'correct',charges:number|null,commandId:string){if(this.graphShadow)throw new Error('Graphvorschau zuerst übernehmen oder Ursprung wiederherstellen.');const cam=this.guard(token);activateDungeonFeature(this.db,cam,id,sceneId,expected,action,charges,commandId);return drawingView(this.db,cam);}
  graph(token:string,scopeId:string):GraphView{const cam=this.guard(token);if(this.graphShadow&&(this.graphShadow.campaignId!==cam||this.graphShadow.scopeId!==scopeId))throw new Error('Zuerst die offene Graphvorschau übernehmen oder wiederherstellen.');const view=graphView(this.graphShadow?.db??this.db,cam,scopeId,this.graphShadow?.state()??null);return{...view,budget:dungeonBudgetView(this.db,cam,scopeId,view)};}
  executeGraph(c:GraphCommand):{workspace:Workspace;view:GraphView}{const cam=this.guard(c.token,c.campaignId);if(this.graphShadow&&(this.graphShadow.campaignId!==cam||this.graphShadow.scopeId!==c.scopeId))throw new Error('Eine Dungeonvorschau gleichzeitig bearbeiten.');const a=c.action;
    if(a.kind==='select'){this.select(c.token,a.roomId);return{workspace:this.workspace(),view:this.graph(c.token,c.scopeId)};}
    if(a.kind==='restore'){this.graphShadow?.dispose();this.graphShadow=null;return{workspace:this.workspace(),view:this.graph(c.token,c.scopeId)};}
    if(a.kind==='accept'){const shadow=this.graphShadow;if(!shadow||shadow.phase!=='raster')throw new Error('Zur Rastervorschau wechseln, dort korrigieren und anschließend übernehmen.');const changes=shadow.changes(),selected=shadow.db.prepare('SELECT selected_id FROM campaign WHERE id=?').get(cam)?.selected_id;this.db.transaction(()=>{if(changes.length)executeDrawing(this.db,{commandId:c.commandId,token:c.token,campaignId:cam,action:{kind:'graph-commit',changes}},()=>{this.guard(c.token,cam);});if(selected&&selected!==this.db.prepare('SELECT selected_id FROM campaign WHERE id=?').get(cam)?.selected_id)this.db.prepare('UPDATE campaign SET selected_id=? WHERE id=?').run(selected,cam);}).immediate();shadow.dispose();this.graphShadow=null;return{workspace:this.workspace(),view:this.graph(c.token,c.scopeId)};}
    if(!this.graphShadow)this.graphShadow=new GraphShadow(this.db,cam,c.scopeId);const shadow=this.graphShadow;
    const draw=(action:DrawingCommand['action'])=>this.withGraph(()=>{executeDrawing(this.db,{commandId:randomUUID(),token:c.token,campaignId:cam,action},()=>{this.guard(c.token,cam);});});
    const saveLayout=(layout:import('../graph-contracts').GraphLayout)=>{const current=shadow.db.prepare('SELECT revision FROM dungeon_graph_layout WHERE campaign_id=? AND id=?').get(cam,c.scopeId);draw({kind:'graph-layout',layout,expectedRevision:current?.revision??null});};
    const connect=(intent:import('../graph-contracts').GraphIntent)=>{let layout=graphLayout(shadow.db,cam,c.scopeId);const at=layout.intents.findIndex(i=>i.id===intent.id);if(at>=0)layout.intents[at]=intent;else layout.intents.push(intent);if(!intent.fromRoomId||!intent.toRoomId){intent.problem='Gruppenverbindung ist Planungsabsicht. Beide konkreten Endräume wählen.';saveLayout(layout);return;}try{const g=dungeonGeometry(shadow.db,cam),old=g.drawing.paths?.find(p=>p.id===intent.id),path:DungeonPath=old?{...old,from:old.from.roomId===intent.fromRoomId?old.from:{roomId:intent.fromRoomId,volumeId:null,pinned:false,local:null},to:old.to.roomId===intent.toRoomId?old.to:{roomId:intent.toRoomId,volumeId:null,pinned:false,local:null}}:{id:intent.id,revision:0,scopeId:c.scopeId,name:intent.name,notes:'',from:{roomId:intent.fromRoomId,volumeId:null,pinned:false,local:null},to:{roomId:intent.toRoomId,volumeId:null,pinned:false,local:null},waypoints:[],segments:[{form:intent.form,widthSteps:1,heightSteps:2,factor:1}],medium:'air',mode:'path',roomId:null,volumeId:null,fromPassageId:randomUUID(),toPassageId:randomUUID(),basis:'',route:[]};const preview=previewDungeonPath(shadow.db,cam,path,g);draw({kind:'path-publish',preview,expectedRevision:old?.revision??null});layout=graphLayout(shadow.db,cam,c.scopeId);layout.intents=layout.intents.filter(i=>i.id!==intent.id);saveLayout(layout);}catch(e){intent.problem=(e as Error).message;saveLayout(layout);}}
    if(a.kind==='raster')shadow.phase='raster';else if(a.kind==='connect')connect(structuredClone(a.intent));else if(a.kind==='resolve'){const intent=graphLayout(shadow.db,cam,c.scopeId).intents.find(i=>i.id===a.intentId);if(!intent)throw new Error('Verbindungsplanung fehlt.');connect({...intent,fromRoomId:a.fromRoomId,toRoomId:a.toRoomId});}else if(a.kind==='reroute'){for(const path of drawingView(shadow.db,cam).paths??[]){if(path.mode==='area'||path.status==='ready')continue;connect({id:path.id,fromRoomId:path.from.roomId,toRoomId:path.to.roomId,fromGroupId:null,toGroupId:null,form:path.segments[0]!.form,name:path.name,problem:''});}}else{draw(a);if(a.kind==='graph-move'||a.kind==='graph-duplicate'){for(const path of drawingView(shadow.db,cam).paths??[]){if(path.mode==='area'||path.status==='ready')continue;connect({id:path.id,fromRoomId:path.from.roomId,toRoomId:path.to.roomId,fromGroupId:null,toGroupId:null,form:path.segments[0]!.form,name:path.name,problem:''});}}}
    return{workspace:this.workspace(),view:this.graph(c.token,c.scopeId)};
  }
  autonomy(token:string){return autonomyView(this.db,this.guard(token));}
  executeAutonomy(c:AutonomyCommand){return executeAutonomy(this.db,c,()=>{this.guard(c.token,c.campaignId);});}
  playerView(token:string){return playerView(this.db,this.guard(token));}
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
  executeCity(command:CityCommand){return executeCity(this.db,command,()=>{this.guard(command.token,command.campaignId);});}
  campaignOverview(){return this.db.transaction(()=>campaignOverview(this.db))();}
  campaignFence(id:string,revision:number){const r=this.db.prepare('SELECT revision,trashed FROM campaign_lifecycle WHERE campaign_id=?').get(id);if(!r||r.trashed||r.revision!==revision)throw new Error('Quellkampagne wurde gelöscht oder ihr Lebenszyklus geändert.');}
  async campaignSnapshot(token:string,filename:string){
    const id=this.guard(token),fence=this.db.prepare('SELECT revision FROM campaign_lifecycle WHERE campaign_id=?').get(id).revision,candidate=filename+'.snapshot-'+randomUUID();
    try{
      await this.backupDatabase(candidate,false);this.campaignFence(id,fence);
      const db=new Database(candidate,{fileMustExist:true});let snapshot;
      try{
        db.pragma('journal_mode=DELETE');pruneCampaignSnapshot(db,id);this.validateDatabase(db);
        const c:Pick<Campaign,'id'|'name'>=db.prepare('SELECT id,name FROM campaign').get();
        snapshot={...c,fence,schema:db.pragma('user_version',{simple:true}),counts:snapshotCounts(db),media:[...audioMediaFiles(db),...playerMediaFiles(db,id)]};
      }finally{db.close();}
      this.campaignFence(id,fence);renameSync(candidate,filename);return snapshot;
    }finally{for(const suffix of ['','-wal','-shm'])rmSync(candidate+suffix,{force:true});}
  }
  private inspectCampaignDatabase(db:any){
    const schema=db.pragma('user_version',{simple:true});
    if(schema!==this.db.pragma('user_version',{simple:true})&&!([33,34,35,36,37,38,39,40,41,42,43].includes(schema)&&this.db.pragma('user_version',{simple:true})===44))throw new Error('Kampagnenpaket benötigt einen anderen Formatstand.');

    this.validateDatabase(db);
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

      archiveSourceChoices(source,plan);const remap=remapSnapshot(source,c.id,name,plan.mapping,plan.history);this.validateDatabase(source);
      return publishSnapshot(this.db,source,remap,plan,original,c.id,c.name,ticket===undefined?undefined:{commandId:ticket,fingerprint:this.transferFingerprint(name,choices)});
    }finally{try{source?.close();}finally{rmSync(staging,{recursive:true,force:true});}}
  }

  trashCampaign(command:{commandId:string;id:string;expectedRevision:number;trashed:boolean}){trashCampaign(this.db,command);this.backupEpoch++;if(command.trashed&&this.active?.campaignId===command.id){this.active=null;this.db.prepare("DELETE FROM settings WHERE key='active'").run();}}
  eraseCampaign(command:{commandId:string;id:string;expectedRevision:number;confirmName:string}){this.backupEpoch++;eraseCampaignRows(this.db,command);if(this.active?.campaignId===command.id)this.active=null;this.db.exec("INSERT INTO note_search(note_search) VALUES('optimize')");this.db.pragma('wal_checkpoint(TRUNCATE)');}
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
  music(token:string){return this.db.transaction(()=>readMusic(this.db,this.audioRoot,this.guard(token)))();}
  musicSubject(token:string,kind:MusicSubject['kind'],id:string){return readMusicSubject(this.db,this.guard(token),kind,id);}
  executeMusic(command:MusicCommand){return executeMusic(this.db,this.audioRoot,command,()=>{this.guard(command.token,command.campaignId);});}
  musicPosition(token:string,playbackId:string,seconds:number){return saveMusicPosition(this.db,this.guard(token),playbackId,seconds);}
  ingestAudio(token:string,media:AudioAsset['media']){const cam=this.guard(token);const result=this.db.transaction(()=>ingestAudio(this.db,this.audioRoot,media)).immediate();this.updateMusic(cam);return result;}
  ingestAudios(token:string,medias:AudioAsset['media'][]):AudioAsset[]{const cam=this.guard(token),assets=this.db.transaction(()=>medias.map(media=>ingestAudio(this.db,this.audioRoot,media))).immediate();this.updateMusic(cam);return assets;}
  audioLibrary(token:string){this.guard(token);return this.db.transaction(()=>audioLibrarySnapshot(this.db,this.audioRoot))();}
  mergeAudioLibrary(token:string,library:ReturnType<typeof audioLibrarySnapshot>){const cam=this.guard(token),ids=mergeAudioLibrary(this.db,this.audioRoot,library);this.updateMusic(cam);return ids;}
  audioFile(id:string){const asset=readAudioAsset(this.db,this.audioRoot,id);if(!asset.available)throw new Error('Mediendatei fehlt oder wurde verändert.');return audioFile(this.audioRoot,asset);}
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
  executeWorld(command:WorldCommand){return this.db.transaction(()=>{
    const ack=executeWorld(this.db,command,()=>{this.guard(command.token,command.campaignId);},{
      capture:()=>captureAutonomyBasis(this.db,command.campaignId),
      confirm:(commandId,before,after,basis)=>this.consumeSceneTime(command.campaignId,commandId,before.scene,after.scene,basis),
    });
    this.updateMusic(command.campaignId);return ack;
  }).immediate();}
  itemDefinitions(query:ItemQuery){return readItemDefinitions(this.db,query);}
  itemDefinition(id:string,revision?:number){return readItemDefinition(this.db,id,revision);}
  shops(token:string,includeTrashed:boolean){return readShops(this.db,this.guard(token),includeTrashed);}
  shop(token:string,id:string){return readShop(this.db,this.guard(token),id);}
  sceneShops(token:string,id:string){return sceneShops(this.db,this.guard(token),id);}
  executeItemShop(command:ItemShopCommand){return executeItemShop(this.db,command,()=>{this.guard(command.token,command.campaignId);});}
  combat(token: string, sceneId: string, id?: string) { return readCombat(this.db, this.guard(token), sceneId, id); }
  combatDraft(token:string,combatId:string,kind:CombatDraftKind,targetId:string){return this.db.transaction(()=>readCombatDraft(this.db,this.guard(token),combatId,kind,targetId))();}
  combatDrafts(token:string,combatId:string,after:string|null){return this.db.transaction(()=>combatDrafts(this.db,this.guard(token),combatId,after))();}
  keepCombatDraft(token:string,draft:CombatWorkingDraft,expected:string|null){keepCombatDraft(this.db,this.guard(token),draft,expected);}
  discardCombatDraft(token:string,combatId:string,kind:CombatDraftKind,targetId:string,writeId:string){discardCombatDraft(this.db,this.guard(token),combatId,kind,targetId,writeId);}
  executeCombat(command: CombatCommand) { return this.db.transaction(()=>{const ack=executeCombat(this.db, command, () => { this.guard(command.token, command.campaignId); });this.updateMusic(command.campaignId);return ack;}).immediate(); }
  archivedRoster(token:string,after:string|null,search:string){return readArchivedRoster(this.db,this.guard(token),after,search);}
  live(token: string) { return readLive(this.db, this.guard(token)); }
  liveScene(token: string, id: string) { return this.db.transaction(() => readLiveScene(this.db, this.guard(token), id))(); }
  liveArchives(token: string, after: string | null) { return readArchives(this.db, this.guard(token), after); }
  executeLive(command: LiveCommand) { return this.db.transaction(() => {
    const replay=!!this.db.prepare('SELECT 1 FROM live_receipt WHERE command_id=?').get(command.commandId);
    const basis=command.action.kind==='advance-clock'&&!replay?captureAutonomyBasis(this.db,command.campaignId):null,oldScene=command.action.kind==='advance-clock'?readLiveScene(this.db,command.campaignId,command.action.sceneId):null;
    const ack = executeLive(this.db, command, () => {this.guard(command.token, command.campaignId);});
    if(!replay&&command.action.kind==='live-moment'&&command.action.followUp){const a=command.action,followUp=a.followUp!;this.changePreparation({commandId:command.commandId+'|follow-up',campaignId:command.campaignId,token:command.token,change:{kind:'note',expectedRevision:null,note:{version:1,id:campaignLocalId(followUp.id),revision:1,kind:followUp.kind,title:a.title.trim(),readAloud:'',gmNotes:a.summary,relations:[],creatureId:null,deleted:false}}});}
    if(basis&&oldScene&&ack.scene)this.consumeSceneTime(command.campaignId,command.commandId,oldScene,ack.scene,basis);
    if(command.action.kind==='advance-clock'&&!replay)restockDue(this.db,command.campaignId,ack.scene!.clock.instantMs);
    if(!replay){
      const a=command.action;
      if(a.kind==='move'||a.kind==='membership'&&!a.active||a.kind==='archive-character'&&a.archived){const ids=a.kind==='move'?a.memberIds:[a.characterId],retired=new Set(ack.session?.retired.map(scene=>scene.id)??[]);reconcileCombatParticipants(this.db,command.campaignId,ids,command.commandId,retired);reconcileChaseParticipants(this.db,command.campaignId,ids,command.commandId,retired);}
      if(a.kind==='move'&&ack.session?.createdScene)inheritScenePosition(this.db,command.campaignId,a.sceneId,ack.session.createdScene.id);
      const sceneId=a.kind==='advance-clock'||a.kind==='scene-content'||a.kind==='apply-visit'?a.sceneId:a.kind==='initialize'?ack.scene?.id:a.kind==='move'?ack.session?.createdScene?.id:null;
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
  changePreparation(command: PreparationCommand): Preparation {
    if (typeof command.commandId !== 'string' || !command.commandId) throw new Error('Änderungskennung fehlt.');
    const change = validatePreparation(command.change), fingerprint = commandFingerprint(command);
    this.db.transaction(() => {
      const campaignId = this.guard(command.token, command.campaignId ?? this.active?.campaignId);
      const prior = this.db.prepare('SELECT fingerprint,campaign_id FROM receipt WHERE command_id=?').get(command.commandId);
      if (prior) { if (prior.campaign_id !== campaignId || !matchesReceipt(prior, command)) throw new Error('Änderungskennung bereits anders verwendet.'); return; }
      let targetId: string, revision: number;
      if (change.kind === 'note') {
        targetId = change.note.id;
        const old = this.db.prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?').get(campaignId, targetId);
        if (change.expectedRevision === null ? !!old : !old || old.revision !== change.expectedRevision || old.trashed) throw new Error('Notizkonflikt: Der gespeicherte Stand hat sich geändert.');
        const oldNote = old ? this.decodeNote(old, 'Beschädigte Notiz darf nicht überschrieben werden.') : null;
        if (oldNote && oldNote.kind !== change.note.kind) throw new Error('Die Notizart bleibt an ihrer Identität gebunden.');
        for (const relation of change.note.relations) {
          const target = this.db.prepare('SELECT trashed FROM world_note WHERE campaign_id=? AND id=?').get(campaignId, relation.targetId);
          const retained = oldNote?.relations.some(r => r.targetId === relation.targetId && r.label === relation.label);
          if (!target || target.trashed && !retained) throw new Error('Beziehung zeigt nicht auf eine verfügbare Notiz.');
        }
        revision = (old?.revision ?? 0) + 1;
        const note: Note = { ...change.note, revision }, payload = json(note);
        this.db.prepare('INSERT INTO world_note VALUES(?,?,?,0,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum').run(campaignId, targetId, revision, payload, hash(payload));
        this.db.prepare('DELETE FROM note_search WHERE campaign_id=? AND note_id=?').run(campaignId, targetId);
        this.db.prepare('INSERT INTO note_search(campaign_id,note_id,title,body) VALUES(?,?,?,?)').run(campaignId, targetId, note.title, note.readAloud + '\n' + note.gmNotes);
        if(oldNote?.kind==='npc'&&oldNote.title!==note.title)syncOpenMaskHealth(this.db,campaignId,undefined,new Map([[targetId,{before:oldNote.title,after:note.title}]]));
      } else if (change.kind === 'note-trash') {
        targetId = change.id;
        const old = this.db.prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?').get(campaignId, targetId);
        if (!old || old.revision !== change.expectedRevision || !!old.trashed === change.trashed) throw new Error('Papierkorbkonflikt: Notizstand hat sich geändert.');
        const note = this.decodeNote(old, 'Beschädigte Notiz bleibt gesperrt.'); revision = old.revision + 1;
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
        for (const scene of change.plan.scenes) if (scene.locationId !== null) {
          const location = this.db.prepare('SELECT trashed FROM location WHERE campaign_id=? AND id=?').get(campaignId, scene.locationId);
          const retained = beforePlan?.scenes.some(s => s.id === scene.id && s.locationId === scene.locationId);
          if (!location || location.trashed && !retained) throw new Error('Szenenort ist nicht verfügbar. Wähle einen aktuellen Ort oder lasse die Szene ortlos.');
        }
        revision = (old?.revision ?? 0) + 1;
        this.db.prepare('INSERT INTO plan VALUES(?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET revision=excluded.revision,name=excluded.name').run(campaignId, targetId, revision, change.plan.name);
        const existing = this.db.prepare('SELECT * FROM planned_visit WHERE campaign_id=? AND plan_id=?').all(campaignId, targetId) as Row[];
        for (const visit of existing) if (!change.plan.scenes.some(s => s.id === visit.id)) this.db.prepare('DELETE FROM planned_visit WHERE campaign_id=? AND id=?').run(campaignId, visit.id);
        change.plan.scenes.forEach((scene, ordinal) => {
          const foreign = this.db.prepare('SELECT plan_id FROM planned_visit WHERE campaign_id=? AND id=?').get(campaignId, scene.id);
          if (foreign && foreign.plan_id !== targetId) throw new Error('Szenenidentität gehört zu einem anderen Plan.');
          const payload = json(scene), before = existing.find(s => s.id === scene.id);
          if (!before || before.ordinal !== ordinal || before.payload !== payload) this.db.prepare('INSERT INTO planned_visit VALUES(?,?,?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET ordinal=excluded.ordinal,payload=excluded.payload,checksum=excluded.checksum').run(campaignId, targetId, scene.id, ordinal, payload, hash(payload));
        });
      }
      if(change.kind==='plan')cleanSessionVisits(this.db,campaignId,change.plan.id,change.plan.scenes.map(s=>s.id));
      this.db.prepare('INSERT INTO receipt VALUES(?,?,?,?,?)').run(command.commandId, fingerprint, campaignId, targetId, revision);
      const target = preparationTarget(command.change), savedDraft = this.db.prepare('SELECT * FROM preparation_draft WHERE campaign_id=? AND kind=? AND target_id=?').get(campaignId, target.kind, target.id);
      if (savedDraft && this.decodePreparationDraft(savedDraft).writeId === command.draftWriteId) this.db.prepare('DELETE FROM preparation_draft WHERE campaign_id=? AND kind=? AND target_id=?').run(campaignId, target.kind, target.id);
    }).immediate();
    return this.preparation(command.token);
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
      const unchanged = expected === null ? !current : current?.revision === expected;
      const data = this.preparation(token);
      const readable = table === 'plan' ? data.plans.some(plan => plan.id === targetId) :
        table === 'location' ? data.locations.some(row => row.document.id === targetId) : data.notes.some(row => row.note.id === targetId);
      return { outcome: prior ? 'applied' : unchanged ? 'not-applied' : 'conflict',
        targetChanged: (prior ? current?.revision !== prior.revision : !unchanged) || !!current && !readable, data };
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
      const run: TutorialRun = prior?.lessonRevision === tutorialLessonRevision ? prior : { version: this.applicationVersion, lessonRevision: tutorialLessonRevision, runId: randomUUID(), state: 'new' };
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
