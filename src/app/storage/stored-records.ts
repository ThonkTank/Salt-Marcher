import {createHash} from 'node:crypto';
import {validateRoom,validateRoomDraftContent,type Room,type WorkingRoomDraft} from '../contracts';
import {checkedPreparationDraft,preparationTarget,type PreparationDraft,type PreparationEdit} from '../preparation-contracts';
import {manualPlan,type ManualPlan} from '../../features/planner/manual-planner';
import {checkedLocationDocument} from '../../features/location/location-schema';

const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
type Row = Record<string, any>;

/** Shared checks for stored payloads and snapshot validation. No active store state. */
export function decodeRoom(row: Row): Room {
  if (hash(row.payload) !== row.checksum) throw new Error(`Raum ${row.number}: Datenprüfung fehlgeschlagen. Originaldaten bleiben erhalten.`);
  const content = JSON.parse(row.payload);
  if (!content || typeof content !== 'object' || Array.isArray(content) || Object.keys(content).length !== 2 || !Object.hasOwn(content, 'polygons') || !Object.hasOwn(content, 'sections')) throw new Error('Raumpayload hat ein unbekanntes Format. Originaldaten bleiben erhalten.');
  validateRoom({ name: row.name, ...content });
  return { id: row.id, scopeId: row.scope_id, floorId: row.floor_id, number: row.number, name: row.name, revision: row.revision, ...content };
}

export function checkedRoomHistory(entry: Row, room: Pick<Room, 'id' | 'scopeId' | 'floorId' | 'number'>): { before: Room; after: Room } {
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

export function decodeRoomDraft(row: Row): WorkingRoomDraft {
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

export function decodePreparationDraft(row: Row): PreparationDraft {
  if (hash(row.payload) !== row.checksum) throw new Error('Vorbereitungsentwurf ist beschädigt. Originalbytes bleiben erhalten.');
  const draft = checkedPreparationDraft(JSON.parse(row.payload)), target = preparationTarget(draft.change);
  if (target.kind !== row.kind || target.id !== row.target_id || draft.failedCommand && draft.failedCommand.campaignId !== row.campaign_id) throw new Error('Vorbereitungsentwurf gehört zu einem anderen Ziel.');
  return draft;
}

export function preparationDraftTable(kind: PreparationEdit['kind']) {
  if (!['note', 'plan', 'location'].includes(kind)) throw new Error('Unbekanntes Entwurfsziel.');
  return kind === 'note' ? 'world_note' : kind;
}

export function decodeLocation(row: Row, checksumError = 'Ortsprüfung fehlgeschlagen.') {
  if (hash(row.payload) !== row.checksum) throw new Error(checksumError);
  const document=checkedLocationDocument(JSON.parse(row.payload));
  if(document.id!==row.id||!Number.isSafeInteger(row.revision)||row.revision<1)throw new Error("Ortszuordnung widersprüchlich.");
  return document;
}

export function readStoredPlan(db: any, campaignId: string, id: string): ManualPlan {
  const row = db.prepare('SELECT * FROM plan WHERE campaign_id=? AND id=?').get(campaignId, id);
  if (!row) throw new Error('Plan nicht gefunden.');
  const scenes = db.prepare('SELECT * FROM planned_visit WHERE campaign_id=? AND plan_id=? ORDER BY ordinal').all(campaignId, id).map((visit: Row) => {
    if (hash(visit.payload) !== visit.checksum) throw new Error('Szenenprüfung fehlgeschlagen.');
    return JSON.parse(visit.payload);
  });
  return manualPlan({ version: 1, id: row.id, revision: row.revision, name: row.name, scenes });
}
