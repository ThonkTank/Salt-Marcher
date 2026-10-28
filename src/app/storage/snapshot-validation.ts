import { checkedQuery, type SqliteDatabase } from './sqlite-connection';
import { validateSessionData } from './session-read';
import DATA_FORMAT from '../data-format.json';
import { checkedWorldNoteRow } from './world-note-row';
import { validateRoomGroups } from './room-groups';
import { readLiveMomentDraft } from './live-moment-drafts';
import { validateNoteSourceHistory } from './note-source-history';
import { validateCampaignAtlases } from './campaign-atlas';
import { checkedSessionRecapDraft } from '../runtime/live-contracts';
import { validateWorldRelationPairs } from './world-relation-pair';
import { validateChaseDrafts } from './chase-drafts';
import { validateNpcRecords } from './npc-record';
import { validateNpcRecovery } from './npcs';
import { validateGroups } from './groups';
import { validateTreasuryDrafts } from './treasury';
import { validateSceneDesk } from './scene-desk';
import { validateFinishDrafts } from './finish-drafts';
import { validateNarrativeBackup } from './narrative';
import { validateCombatDrafts } from './combat-drafts';
import { validateExtensionSettings } from './extensions';
import { validateDungeonPlay } from './dungeon-play';
import { validateDrawing } from './drawing';
import { validateAutonomy } from './autonomy';
import { validatePlayer } from './player';
import { validateCities } from './city';
import { validateCampaignOrigins, validateCapabilityBytes } from './campaign-data';
import { validateMusicBackup } from './music';
import { validateWorldBackup } from './world-validation';
import { validateItemsBackup } from './items';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { type Room } from '../shared/contracts';
import { preparationTarget } from '../campaign/preparation-contracts';
import { validateLiveBackup } from './live-validation';
import { validateCombatBackup } from './combat';
import { validateChaseBackup } from './chase';
import { validateMaskReconciliations } from './mask-reconciliation';
import { validateRuleReferences } from './rule-references';
import { validateSceneChecks } from './scene-checks';
import { validateProgressBackup } from './progression';
import { validateGenerationBackup } from './generation';
import { validateSessionRuns } from './session-result-read';
import {
  decodeRoom,
  checkedRoomHistory,
  decodeRoomDraft,
  decodePreparationDraft,
  preparationDraftTable,
  decodeLocation,
  readStoredPlan,
} from './stored-records';

const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');

const json = JSON.stringify;

export function validateDatabase(db: SqliteDatabase) {
  if (db.pragma('user_version', { simple: true }) !== DATA_FORMAT.schema)
    throw Error('Nicht unterstütztes Testdatenformat.');
  if (
    !checkedQuery(
      db,
      "SELECT 1 FROM sqlite_schema WHERE type='table' AND name='scene_opponent_group'",
      { '1': 'integer' },
    ).get()
  )
    throw Error('Szenengegner-Zuordnung fehlt.');
  validateCampaignAtlases(db);
  for (const row of checkedQuery(
    db,
    "SELECT value FROM settings WHERE key LIKE 'session-recap:%'",
    { value: 'text' },
  ).iterate())
    checkedSessionRecapDraft(JSON.parse(row.value));
  for (const row of checkedQuery(db, 'SELECT campaign_id,scene_id FROM live_moment_draft', {
    campaign_id: 'text',
    scene_id: 'text',
  }).iterate())
    readLiveMomentDraft(db, row.campaign_id, row.scene_id);
  validateExtensionSettings(db);
  validateCapabilityBytes(db);
  validateCampaignOrigins(db);
  const foreignKeys = db.pragma('foreign_key_check');
  if (
    db.pragma('integrity_check', { simple: true }) !== 'ok' ||
    !Array.isArray(foreignKeys) ||
    foreignKeys.length
  )
    throw new Error('Wiederherstellungskopie ist strukturell beschädigt.');
  for (const row of checkedQuery(db, 'SELECT * FROM room', {
    campaign_id: 'text',
    id: 'text',
    scope_id: 'text',
    number: 'text',
    name: 'text',
    revision: 'integer',
    payload: 'text',
    checksum: 'text',
    floor_id: 'text',
  }).iterate())
    decodeRoom(row);
  const headers = new Map<string, Pick<Room, 'id' | 'scopeId' | 'floorId' | 'number'>>();
  for (const entry of checkedQuery(db, 'SELECT * FROM history', {
    campaign_id: 'text',
    ordinal: 'integer',
    room_id: 'text',
    before_json: 'text',
    after_json: 'text',
    guard_revision: 'integer',
  }).iterate()) {
    if (
      checkedQuery(db, 'SELECT 1 FROM drawing_history WHERE campaign_id=? AND ordinal=?', {
        '1': 'integer',
      }).get(entry.campaign_id, entry.ordinal)
    )
      continue;
    const key = json([entry.campaign_id, entry.room_id]);
    let header = headers.get(key);
    if (!header) {
      const row = checkedQuery(
        db,
        'SELECT id,scope_id AS scopeId,floor_id AS floorId,number FROM room WHERE campaign_id=? AND id=?',
        { id: 'text', scopeId: 'text', floorId: 'text', number: 'text' },
      ).get(entry.campaign_id, entry.room_id);
      if (!row) throw new Error('Raumhistory enthält ein fehlendes Ziel.');
      header = row;
      headers.set(key, header!);
    }
    checkedRoomHistory(entry, header!);
  }
  for (const row of checkedQuery(db, 'SELECT * FROM room_draft', {
    campaign_id: 'text',
    room_id: 'text',
    payload: 'text',
    checksum: 'text',
  }).iterate())
    decodeRoomDraft(row);
  for (const row of checkedQuery(db, 'SELECT * FROM preparation_draft', {
    campaign_id: 'text',
    kind: 'text',
    target_id: 'text',
    payload: 'text',
    checksum: 'text',
  }).iterate()) {
    const draft = decodePreparationDraft(row),
      target = preparationTarget(draft.change),
      table = preparationDraftTable(target.kind);
    if (
      !db
        .prepare(`SELECT 1 FROM ${table} WHERE campaign_id=? AND id=?`)
        .get(row.campaign_id, target.id)
    )
      throw new Error('Vorbereitungsentwurf hat ein fehlendes Ziel.');
  }
  validateNoteSourceHistory(db);
  for (const row of checkedQuery(db, 'SELECT * FROM world_note', {
    campaign_id: 'text',
    id: 'text',
    revision: 'integer',
    trashed: 'integer',
    payload: 'text',
    checksum: 'text',
  }).iterate())
    checkedWorldNoteRow(row, 'Beschädigte Notiz im Backupkandidaten.');
  for (const row of checkedQuery(db, 'SELECT * FROM location', {
    campaign_id: 'text',
    id: 'text',
    revision: 'integer',
    trashed: 'integer',
    payload: 'text',
    checksum: 'text',
  }).iterate())
    decodeLocation(row, 'Beschädigter Ort im Backupkandidaten.');
  for (const row of checkedQuery(db, 'SELECT campaign_id,id FROM plan', {
    campaign_id: 'text',
    id: 'text',
  }).iterate())
    readStoredPlan(db, row.campaign_id, row.id);
  for (const row of checkedQuery(db, 'SELECT id FROM campaign', { id: 'text' }).all())
    validateLiveBackup(db, row.id);
  validateCombatBackup(db);
  validateCombatDrafts(db);
  validateChaseBackup(db);
  validateChaseDrafts(db);
  validateMaskReconciliations(db);
  validateRuleReferences(db);
  validateSceneChecks(db);
  validateProgressBackup(db);
  validateNarrativeBackup(db);
  validateFinishDrafts(db);
  validateSceneDesk(db);
  validateTreasuryDrafts(db);
  validateGroups(db);
  validateNpcRecords(db);
  validateNpcRecovery(db);
  validateItemsBackup(db);
  validateWorldBackup(db);
  validateWorldRelationPairs(db);
  validateCities(db);
  validatePlayer(db);
  validateDungeonPlay(db);
  validateAutonomy(db);
  validateDrawing(db);
  validateMusicBackup(db);
  validateGenerationBackup(db);
  validateSessionData(db);
  validateSessionRuns(db);
  for (const row of checkedQuery(db, 'SELECT payload,checksum FROM live_receipt', {
    payload: 'text',
    checksum: 'text',
  }).iterate())
    if (hash(row.payload) !== row.checksum)
      throw new Error('Beschädigtes Live-Commitreceipt im Backupkandidaten.');
  for (const row of checkedQuery(db, 'SELECT * FROM source', {
    campaign_id: 'text',
    bytes: 'blob',
    checksum: 'text',
  }).iterate())
    if (hash(row.bytes) !== row.checksum)
      throw new Error('Beschädigte Quellbytes im Backupkandidaten.');
  // Every stored payload envelope receives the same byte/JSON check.
  // Domain decoders above additionally verify their semantic invariants.
  // New feature tables cannot silently fall outside backup integrity.
  for (const { name } of checkedQuery(db, "SELECT name FROM sqlite_schema WHERE type='table'", {
    name: 'text',
  }).all()) {
    const columns = checkedQuery(db, 'SELECT name,type FROM pragma_table_info(?)', {
      name: 'text',
      type: 'text',
    }).all(name);
    const payloadColumn = columns.find((column) => column.name === 'payload');
    if (!payloadColumn || !columns.some((column) => column.name === 'checksum')) continue;
    const table = '"' + name.replace(/"/g, '""') + '"';
    for (const row of checkedQuery(db, `SELECT payload,checksum FROM ${table}`, {
      payload: 'text',
      checksum: 'text',
    }).iterate()) {
      if (hash(row.payload) !== row.checksum)
        throw new Error(`Beschädigte Nutzdaten im Backup: ${name}.`);
      if (payloadColumn.type === 'TEXT') JSON.parse(row.payload);
    }
  }
}

/** Validate an already copied candidate without opening or migrating the live store. */
export function validateBackupCandidate(filename: string): void {
  const db = new Database(filename, { readonly: true, fileMustExist: true });
  try {
    validateDatabase(db);
    validateRoomGroups(db);
  } finally {
    db.close();
  }
}
