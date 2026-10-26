import { type SqliteDatabase, checkedQuery, checkedRow } from './sqlite-connection';
import { commandFingerprint, matchesReceipt } from './command-fingerprint';
import { createHash, randomUUID } from 'node:crypto';
import {
  validateRoom,
  validateRoomDraftContent,
  type Edit,
  type Room,
  type WorkingRoomDraft,
} from '../shared/contracts';
import {
  checkedPreparationDraft,
  preparationTarget,
  type PreparationDraft,
  type PreparationEdit,
} from '../campaign/preparation-contracts';
import { manualPlan, type ManualPlan } from '../../features/planner/manual-planner';
import { checkedLocationDocument } from '../../features/location/location-schema';
import { atlasBindings } from './campaign-atlas';
import { drawingHistory, rebaseDrawingRoomHistory } from './drawing';
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

/** Shared checks for stored payloads and snapshot validation. No active store state. */
export function decodeRoom(value: unknown): Room {
  const row = checkedRow(value, {
    id: 'text',
    scope_id: 'text',
    floor_id: 'text',
    number: 'text',
    name: 'text',
    revision: 'integer',
    payload: 'text',
    checksum: 'text',
  });
  if (hash(row.payload) !== row.checksum)
    throw new Error(
      `Raum ${row.number}: Datenprüfung fehlgeschlagen. Originaldaten bleiben erhalten.`,
    );
  const content = JSON.parse(row.payload);
  if (
    !content ||
    typeof content !== 'object' ||
    Array.isArray(content) ||
    Object.keys(content).length !== 2 ||
    !Object.hasOwn(content, 'polygons') ||
    !Object.hasOwn(content, 'sections')
  )
    throw new Error('Raumpayload hat ein unbekanntes Format. Originaldaten bleiben erhalten.');
  validateRoom({ name: row.name, ...content });
  return {
    id: row.id,
    scopeId: row.scope_id,
    floorId: row.floor_id,
    number: row.number,
    name: row.name,
    revision: row.revision,
    ...content,
  };
}

export function checkedRoomHistory(
  value: unknown,
  room: Pick<Room, 'id' | 'scopeId' | 'floorId' | 'number'>,
): { before: Room; after: Room } {
  const entry = checkedRow(value, {
    room_id: 'text',
    ordinal: 'integer',
    guard_revision: 'integer',
    before_json: 'text',
    after_json: 'text',
  });
  if (
    !entry ||
    entry.room_id !== room.id ||
    !Number.isSafeInteger(entry.ordinal) ||
    entry.ordinal < 1 ||
    !Number.isSafeInteger(entry.guard_revision) ||
    entry.guard_revision < 0
  )
    throw new Error('Raumhistory ist beschädigt. Originaldaten bleiben erhalten.');
  const before = JSON.parse(entry.before_json) as Room,
    after = JSON.parse(entry.after_json) as Room;
  for (const value of [before, after]) {
    // Display keys may change independently of this geometry/text snapshot.
    // Identity belongs to the room ID and its scope, never its current number.
    if (
      !value ||
      value.id !== room.id ||
      value.scopeId !== room.scopeId ||
      value.floorId !== room.floorId ||
      typeof value.number !== 'string' ||
      !Number.isSafeInteger(value.revision) ||
      value.revision < 0
    )
      throw new Error(
        'Raumhistory zeigt nicht auf ihren ursprünglichen Raum. Originaldaten bleiben erhalten.',
      );
    validateRoom(value);
  }
  if (after.revision !== before.revision + 1)
    throw new Error('Raumhistory besitzt keine gültige Revisionsfolge.');
  return { before, after };
}

export function decodeRoomDraft(value: unknown): WorkingRoomDraft {
  const row = checkedRow(value, {
    room_id: 'text',
    campaign_id: 'text',
    payload: 'text',
    checksum: 'text',
  });
  if (hash(row.payload) !== row.checksum)
    throw new Error('Arbeitsentwurf ist beschädigt. Originalbytes bleiben erhalten.');
  const draft = JSON.parse(row.payload) as WorkingRoomDraft;
  if (
    !draft ||
    draft.room?.id !== row.room_id ||
    typeof draft.room.scopeId !== 'string' ||
    typeof draft.room.floorId !== 'string' ||
    typeof draft.room.number !== 'string' ||
    !Number.isSafeInteger(draft.room.revision) ||
    draft.room.revision < 0 ||
    typeof draft.room.name !== 'string' ||
    !Array.isArray(draft.room.polygons) ||
    !Array.isArray(draft.room.sections) ||
    typeof draft.points !== 'string' ||
    typeof draft.pointsChanged !== 'boolean' ||
    !Object.hasOwn(draft, 'failedEdit')
  )
    throw new Error(
      'Arbeitsentwurf hat einen ungültigen Ziel-/Feldvertrag. Originalbytes bleiben erhalten.',
    );
  if (
    draft.failedEdit !== null &&
    (!draft.failedEdit ||
      draft.failedEdit.campaignId !== row.campaign_id ||
      draft.failedEdit.roomId !== row.room_id ||
      typeof draft.failedEdit.commandId !== 'string' ||
      !draft.failedEdit.commandId ||
      !Number.isSafeInteger(draft.failedEdit.expectedRevision) ||
      draft.failedEdit.expectedRevision < 0)
  )
    throw new Error('Arbeitsentwurf enthält einen fremden Änderungsauftrag.');
  try {
    validateRoomDraftContent(draft.room);
    if (draft.failedEdit !== null) {
      if (typeof draft.failedEdit.token !== 'string') throw new Error('Aktivierungsbindung fehlt.');
      validateRoom(draft.failedEdit);
    }
  } catch (error) {
    throw new Error(
      'Arbeitsentwurf enthält ungültige Raumdaten. Originalbytes bleiben erhalten: ' +
        (error as Error).message,
    );
  }
  return draft;
}

export function decodePreparationDraft(value: unknown): PreparationDraft {
  const row = checkedRow(value, {
    campaign_id: 'text',
    kind: 'text',
    target_id: 'text',
    payload: 'text',
    checksum: 'text',
  });
  if (hash(row.payload) !== row.checksum)
    throw new Error('Vorbereitungsentwurf ist beschädigt. Originalbytes bleiben erhalten.');
  const draft = checkedPreparationDraft(JSON.parse(row.payload)),
    target = preparationTarget(draft.change);
  if (
    target.kind !== row.kind ||
    target.id !== row.target_id ||
    (draft.failedCommand && draft.failedCommand.campaignId !== row.campaign_id)
  )
    throw new Error('Vorbereitungsentwurf gehört zu einem anderen Ziel.');
  return draft;
}

export function preparationDraftTable(kind: PreparationEdit['kind']) {
  if (!['note', 'plan', 'location'].includes(kind)) throw new Error('Unbekanntes Entwurfsziel.');
  return kind === 'note' ? 'world_note' : kind;
}

export function decodeLocation(value: unknown, checksumError = 'Ortsprüfung fehlgeschlagen.') {
  const row = checkedRow(value, {
    id: 'text',
    revision: 'integer',
    payload: 'text',
    checksum: 'text',
  });
  if (hash(row.payload) !== row.checksum) throw new Error(checksumError);
  const document = checkedLocationDocument(JSON.parse(row.payload));
  if (document.id !== row.id || !Number.isSafeInteger(row.revision) || row.revision < 1)
    throw new Error('Ortszuordnung widersprüchlich.');
  return document;
}

export function readStoredPlan(db: SqliteDatabase, campaignId: string, id: string): ManualPlan {
  const row = checkedQuery(db, 'SELECT * FROM plan WHERE campaign_id=? AND id=?', {
    id: 'text',
    revision: 'integer',
    name: 'text',
  }).get(campaignId, id);
  if (!row) throw new Error('Plan nicht gefunden.');
  const scenes = checkedQuery(
    db,
    'SELECT * FROM planned_visit WHERE campaign_id=? AND plan_id=? ORDER BY ordinal',
    { id: 'text', ordinal: 'integer', payload: 'text', checksum: 'text' },
  )
    .all(campaignId, id)
    .map((visit) => {
      if (hash(visit.payload) !== visit.checksum) throw new Error('Szenenprüfung fehlgeschlagen.');
      return JSON.parse(visit.payload);
    });
  return manualPlan({ version: 1, id: row.id, revision: row.revision, name: row.name, scenes });
}

const json = (value: unknown) => JSON.stringify(value);

interface AddRoomContext {
  guard: (token: string, campaignId?: string | undefined) => string;
  workspace: () => import('./../shared/contracts').Workspace;
  insertRoom: (campaignId: string, room: import('./../shared/contracts').Room) => void;
  executeDrawing: (command: import('../atlas/drawing-contracts').DrawingCommand) => void;
}
export function storedAddRoom(
  db: SqliteDatabase,
  context: AddRoomContext,
  token: string,
): import('./../shared/contracts').Workspace {
  db.transaction(() => {
    const campaignId = context.guard(token);
    const n =
      checkedQuery(db, 'SELECT count(*) n FROM room WHERE campaign_id=?', {
        n: 'integer',
      }).required(campaignId).n + 1;
    const current = context.workspace(),
      selected = current.rooms.find((r) => r.id === current.selectedId);
    const scopeId =
        selected?.scopeId ??
        checkedQuery(db, 'SELECT value FROM settings WHERE key=?', { value: 'text' }).get(
          'default-scope:' + campaignId,
        )?.value ??
        'local',
      floorId =
        selected?.floorId ??
        checkedQuery(
          db,
          'SELECT id FROM drawing_floor WHERE campaign_id=? AND scope_id=? ORDER BY rowid LIMIT 1',
          { id: 'text' },
        ).get(campaignId, scopeId)?.id ??
        'ground';
    // A default room is immediately usable geometry, not an overlapping placeholder.
    const bounds = (r: Room) => {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const p of r.polygons)
        for (const v of p.outer) {
          minX = Math.min(minX, v.x);
          minY = Math.min(minY, v.y);
          maxX = Math.max(maxX, v.x);
          maxY = Math.max(maxY, v.y);
        }
      return { minX, minY, maxX, maxY };
    };
    const grid = 1.524,
      width = 4 * grid,
      height = 3 * grid,
      anchor = selected ? bounds(selected) : null,
      y = anchor ? Math.round(anchor.minY / grid) * grid : 0;
    let x = anchor ? Math.ceil((anchor.maxX + grid) / grid - 1e-8) * grid : 0;
    const occupied = current.rooms
      .filter((r) => r.scopeId === scopeId && r.floorId === floorId)
      .map(bounds)
      .sort((a, b) => a.minX - b.minX);
    for (const b of occupied)
      if (
        y < b.maxY + grid &&
        y + height > b.minY - grid &&
        x < b.maxX + grid &&
        x + width > b.minX - grid
      )
        x = Math.ceil((b.maxX + grid) / grid - 1e-8) * grid;
    const room: Room = {
      id: randomUUID(),
      scopeId,
      floorId,
      name: 'Neuer Raum',
      number: String(n),
      revision: 0,
      polygons: [
        {
          outer: [
            { x, y },
            { x: x + width, y },
            { x: x + width, y: y + height },
            { x, y: y + height },
          ],
          holes: [],
        },
      ],
      sections: [{ id: randomUUID(), kind: 'markdown', markdown: '' }],
    };
    validateRoom(room);
    if (
      atlasBindings(db, campaignId).some((b) => b.ownerId === scopeId && b.parent === 'building')
    ) {
      context.insertRoom(campaignId, room);
      db.prepare('UPDATE campaign SET selected_id=? WHERE id=?').run(room.id, campaignId);
    } else
      context.executeDrawing({
        commandId: randomUUID(),
        token,
        campaignId,
        action: {
          kind: 'create-room',
          scopeId,
          floorId,
          name: room.name,
          polygons: room.polygons,
        },
      });
  }).immediate();
  return context.workspace();
}
interface EditContext {
  guard: (token: string, campaignId?: string | undefined) => string;
  writeRoom: (campaignId: string, room: import('./../shared/contracts').Room) => void;
}
export function storedEdit(
  db: SqliteDatabase,
  context: EditContext,
  edit: Edit,
): import('./../shared/contracts').RoomCommit {
  validateRoom(edit);
  if (
    typeof edit.commandId !== 'string' ||
    !edit.commandId ||
    !Number.isSafeInteger(edit.expectedRevision)
  )
    throw new Error('Ungültiger Änderungsauftrag.');
  const fingerprint = commandFingerprint(edit);
  db.transaction(() => {
    const campaignId = context.guard(edit.token, edit.campaignId);
    const receipt = checkedQuery(db, 'SELECT * FROM receipt WHERE command_id=?', {
      campaign_id: 'text',
      fingerprint: 'text',
      revision: 'integer',
    }).get(edit.commandId);
    if (receipt) {
      if (receipt.campaign_id !== campaignId || !matchesReceipt(receipt, edit))
        throw new Error('Änderungskennung bereits anders verwendet.');
      return;
    }
    const before = decodeRoom(
      db.prepare('SELECT * FROM room WHERE campaign_id=? AND id=?').get(campaignId, edit.roomId) ??
        {},
    );
    if (before.revision !== edit.expectedRevision)
      throw new Error('Konflikt: Der Raum wurde inzwischen geändert. Entwurf bleibt offen.');
    if (
      json(before.sections.map((s) => [s.id, s.kind, s.doorId])) !==
      json(edit.sections.map((s) => [s.id, s.kind, s.doorId]))
    )
      throw new Error('Abschnittsbindungen dürfen bei Textbearbeitung nicht geändert werden.');
    const after = {
      ...before,
      name: edit.name,
      polygons: edit.polygons,
      sections: edit.sections,
      revision: before.revision + 1,
    };
    const cursor = checkedQuery(db, 'SELECT cursor FROM campaign WHERE id=?', {
      cursor: 'integer',
    }).required(campaignId).cursor;
    context.writeRoom(campaignId, after);
    db.prepare('DELETE FROM history WHERE campaign_id=? AND ordinal>?').run(campaignId, cursor);
    db.prepare('INSERT INTO history VALUES(?,?,?,?,?,?)').run(
      campaignId,
      cursor + 1,
      before.id,
      json(before),
      json(after),
      after.revision,
    );
    db.prepare('UPDATE campaign SET cursor=? WHERE id=?').run(cursor + 1, campaignId);
    db.prepare('INSERT INTO receipt VALUES(?,?,?,?,?)').run(
      edit.commandId,
      fingerprint,
      campaignId,
      before.id,
      after.revision,
    );
    db.prepare('DELETE FROM room_draft WHERE campaign_id=? AND room_id=?').run(
      campaignId,
      before.id,
    );
  }).immediate();
  return db.transaction(() => {
    const campaignId = context.guard(edit.token, edit.campaignId),
      cursor = checkedQuery(db, 'SELECT cursor FROM campaign WHERE id=?', {
        cursor: 'integer',
      }).required(campaignId).cursor;
    return {
      room: decodeRoom(
        db.prepare('SELECT * FROM room WHERE campaign_id=? AND id=?').get(campaignId, edit.roomId),
      ),
      token: edit.token,
      canUndo: !!db
        .prepare('SELECT 1 FROM history WHERE campaign_id=? AND ordinal=?')
        .get(campaignId, cursor),
      canRedo: !!db
        .prepare('SELECT 1 FROM history WHERE campaign_id=? AND ordinal=?')
        .get(campaignId, cursor + 1),
    };
  })();
}
interface HistoryContext {
  guard: (token: string, campaignId?: string | undefined) => string;
  writeRoom: (campaignId: string, room: import('./../shared/contracts').Room) => void;
  workspace: () => import('./../shared/contracts').Workspace;
}
export function storedHistory(
  db: SqliteDatabase,
  context: HistoryContext,
  token: string,
  direction: 'undo' | 'redo',
): import('./../shared/contracts').Workspace {
  if (direction !== 'undo' && direction !== 'redo') throw new Error('Ungültige Historyaktion.');
  db.transaction(() => {
    const campaignId = context.guard(token),
      cursor = checkedQuery(db, 'SELECT cursor FROM campaign WHERE id=?', {
        cursor: 'integer',
      }).required(campaignId).cursor;
    const ordinal = direction === 'undo' ? cursor : cursor + 1;
    const entry = checkedQuery(db, 'SELECT * FROM history WHERE campaign_id=? AND ordinal=?', {
      room_id: 'text',
      ordinal: 'integer',
      guard_revision: 'integer',
      before_json: 'text',
      after_json: 'text',
    }).get(campaignId, ordinal);
    if (!entry) return;
    if (drawingHistory(db, campaignId, ordinal, direction)) {
      db.prepare('UPDATE campaign SET cursor=? WHERE id=?').run(
        direction === 'undo' ? cursor - 1 : cursor + 1,
        campaignId,
      );
      return;
    }
    const row = db
      .prepare('SELECT * FROM room WHERE campaign_id=? AND id=?')
      .get(campaignId, entry.room_id);
    if (!row)
      throw new Error('Raumhistory enthält ein fehlendes Ziel. Originaldaten bleiben erhalten.');
    const current = decodeRoom(row);
    if (current.revision !== entry.guard_revision)
      throw new Error('Undo-Konflikt: Raumrevision stimmt nicht mehr.');
    const values = checkedRoomHistory(entry, current);
    const target = direction === 'undo' ? values.before : values.after;
    validateRoom(target);
    target.revision = current.revision + 1;
    context.writeRoom(campaignId, target);
    db.prepare('UPDATE history SET guard_revision=? WHERE campaign_id=? AND ordinal=?').run(
      target.revision,
      campaignId,
      ordinal,
    );
    rebaseDrawingRoomHistory(db, campaignId, current.id, ordinal, direction);
    // Earlier/later deltas of the same causal group now expect this monotonically newer revision.
    const neighbor = checkedQuery(
      db,
      `SELECT ordinal FROM history WHERE campaign_id=? AND room_id=? AND ordinal ${direction === 'undo' ? '<' : '>'} ? ORDER BY ordinal ${direction === 'undo' ? 'DESC' : 'ASC'} LIMIT 1`,
      { ordinal: 'integer' },
    ).get(campaignId, entry.room_id, ordinal);
    if (neighbor)
      db.prepare('UPDATE history SET guard_revision=? WHERE campaign_id=? AND ordinal=?').run(
        target.revision,
        campaignId,
        neighbor.ordinal,
      );
    db.prepare('UPDATE campaign SET cursor=?,selected_id=? WHERE id=?').run(
      direction === 'undo' ? cursor - 1 : cursor + 1,
      current.id,
      campaignId,
    );
  }).immediate();
  return context.workspace();
}
interface ReconcileContext {
  guard: (token: string, campaignId?: string | undefined) => string;
  workspace: () => import('./../shared/contracts').Workspace;
}
export function storedReconcile(
  db: SqliteDatabase,
  context: ReconcileContext,
  edit: Edit,
  token = edit.token,
): {
  outcome: 'applied' | 'not-applied' | 'conflict';
  targetChanged: boolean;
  workspace: import('./../shared/contracts').Workspace;
} {
  return db.transaction((): ReturnType<typeof storedReconcile> => {
    const campaignId = context.guard(token, edit.campaignId);
    const receipt = checkedQuery(db, 'SELECT * FROM receipt WHERE command_id=?', {
      campaign_id: 'text',
      fingerprint: 'text',
      revision: 'integer',
    }).get(edit.commandId);
    if (receipt && (receipt.campaign_id !== campaignId || !matchesReceipt(receipt, edit)))
      throw new Error('Änderungskennung bereits anders verwendet.');
    const current = checkedQuery(db, 'SELECT revision FROM room WHERE campaign_id=? AND id=?', {
      revision: 'integer',
    }).get(campaignId, edit.roomId);
    if (!current) throw new Error('Raum nicht verfügbar.');
    const workspace = context.workspace();
    return {
      outcome: receipt
        ? 'applied'
        : current.revision === edit.expectedRevision
          ? 'not-applied'
          : 'conflict',
      targetChanged:
        current.revision !== (receipt?.revision ?? edit.expectedRevision) ||
        !workspace.rooms.some((room) => room.id === edit.roomId),
      workspace,
    };
  })();
}
interface KeepRoomDraftContext {
  guard: (token: string, campaignId?: string | undefined) => string;
}
export function storedKeepRoomDraft(
  db: SqliteDatabase,
  context: KeepRoomDraftContext,
  token: string,
  roomId: string,
  draft: WorkingRoomDraft | null,
): void {
  const campaignId = context.guard(token);
  if (draft === null) {
    db.prepare('DELETE FROM room_draft WHERE campaign_id=? AND room_id=?').run(campaignId, roomId);
    return;
  }
  if (!db.prepare('SELECT 1 FROM room WHERE campaign_id=? AND id=?').get(campaignId, roomId))
    throw new Error('Entwurf gehört nicht zum aktuellen Raum.');
  const existing = db
    .prepare('SELECT * FROM room_draft WHERE campaign_id=? AND room_id=?')
    .get(campaignId, roomId);
  if (existing) decodeRoomDraft(existing);
  const payload = json(draft);
  if (payload.length > 64 * 1024 * 1024)
    throw new Error('Dieser Entwurf ist für den ersten Anschluss zu groß.');
  const checksum = hash(payload);
  // Validate the persisted envelope without treating unfinished text as author truth.
  decodeRoomDraft({ campaign_id: campaignId, room_id: roomId, payload, checksum });
  db.prepare(
    'INSERT INTO room_draft VALUES(?,?,?,?) ON CONFLICT(campaign_id,room_id) DO UPDATE SET payload=excluded.payload,checksum=excluded.checksum',
  ).run(campaignId, roomId, payload, checksum);
}
