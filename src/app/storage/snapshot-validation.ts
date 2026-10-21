import {checkedWorldNoteRow} from "./world-note-row";
import {validateRoomGroups} from './room-groups';
import {readLiveMomentDraft} from './live-moment-drafts';
import {validateNoteSourceHistory} from './note-source-history';
import {validateCampaignAtlases} from './campaign-atlas';
import {checkedSessionRecapDraft} from '../live-contracts';
import {validateWorldRelationPairs} from './world-relation-pair';
import {validateChaseDrafts} from './chase-drafts';
import {validateNpcRecords} from './npc-record';
import {validateNpcRecovery} from './npcs';
import {validateGroups} from './groups';
import {validateTreasuryDrafts} from './treasury';
import {validateSceneDesk} from './scene-desk';
import {validateFinishDrafts} from './finish-drafts';
import {validateNarrativeBackup} from './narrative';
import {validateCombatDrafts} from './combat-drafts';
import {validateExtensionSettings} from './extensions';
import {validateDungeonPlay} from './dungeon-play';
import {validateDrawing} from './drawing';
import {validateAutonomy} from './autonomy';
import {validatePlayer} from './player';
import {validateCities} from './city';
import {validateCampaignOrigins,validateCapabilityBytes} from './campaign-data';
import {validateMusicBackup} from './music';
import {validateWorldBackup} from './world';
import {validateItemsBackup} from './items';
import {createHash} from 'node:crypto';
import Database from 'better-sqlite3';
import {type Room} from '../contracts';
import {preparationTarget} from '../preparation-contracts';
import {validateLiveBackup} from './live';
import {validateCombatBackup} from './combat';
import {validateChaseBackup} from './chase';
import {validateMaskReconciliations} from './mask-reconciliation';
import {validateRuleReferences} from './rule-references';
import {validateSceneChecks} from './scene-checks';
import {validateProgressBackup} from './progression';
import {validateGenerationBackup} from './generation';
import {validateSessionRuns} from './session';
import {decodeRoom,checkedRoomHistory,decodeRoomDraft,decodePreparationDraft,preparationDraftTable,decodeLocation,readStoredPlan} from './stored-records';

const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
type Row = Record<string, any>;
const json = JSON.stringify;

export function validateDatabase(db: any) {
  if(db.pragma('user_version',{simple:true})>=51&&!db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='scene_opponent_group'").get())throw Error('Szenengegner-Zuordnung fehlt.');
  validateCampaignAtlases(db);
  for(const row of db.prepare("SELECT value FROM settings WHERE key LIKE 'session-recap:%'").iterate())checkedSessionRecapDraft(JSON.parse(row.value));
  for(const row of db.prepare('SELECT campaign_id,scene_id FROM live_moment_draft').iterate())readLiveMomentDraft(db,row.campaign_id,row.scene_id);
  validateExtensionSettings(db);
  validateCapabilityBytes(db);
  validateCampaignOrigins(db);
  if (db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length) throw new Error('Wiederherstellungskopie ist strukturell beschädigt.');
  for (const row of db.prepare('SELECT * FROM room').iterate()) decodeRoom(row);
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
    checkedRoomHistory(entry, header!);
  }
  for (const row of db.prepare('SELECT * FROM room_draft').iterate()) decodeRoomDraft(row);
  for (const row of db.prepare('SELECT * FROM preparation_draft').iterate()) {
    const draft = decodePreparationDraft(row), target = preparationTarget(draft.change), table = preparationDraftTable(target.kind);
    if (!db.prepare(`SELECT 1 FROM ${table} WHERE campaign_id=? AND id=?`).get(row.campaign_id, target.id)) throw new Error('Vorbereitungsentwurf hat ein fehlendes Ziel.');
  }
  validateNoteSourceHistory(db);
  for (const row of db.prepare('SELECT * FROM world_note').iterate()) checkedWorldNoteRow(row, 'Beschädigte Notiz im Backupkandidaten.');
  for (const row of db.prepare('SELECT * FROM location').iterate()) decodeLocation(row, 'Beschädigter Ort im Backupkandidaten.');
  for (const row of db.prepare('SELECT campaign_id,id FROM plan').iterate()) readStoredPlan(db,row.campaign_id,row.id);
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

/** Validate an already copied candidate without opening or migrating the live store. */
export function validateBackupCandidate(filename: string): void {
const db = new Database(filename, {readonly:true,fileMustExist:true});
try {validateDatabase(db);if(db.pragma('user_version',{simple:true})>=50)validateRoomGroups(db);}
finally {db.close();}
}

