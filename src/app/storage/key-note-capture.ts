import { createHash } from 'node:crypto';
import { worldNoteDocument } from '../../features/world/world-notes';
import {
  normalizedNoteTitle,
  validateKeyNoteCapture,
  type KeyNoteCaptureCommand,
  type KeyNoteCaptureStatus,
  type KeyNoteChoices,
} from '../campaign/key-note-capture-contracts';
import type { Note } from '../campaign/preparation-contracts';
import { validateRoom } from '../shared/room-validation';
import { drawingRoom, executeDrawing } from './drawing';
import { checkedKeyRow } from './dungeon-key';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const fingerprint = (c: KeyNoteCaptureCommand) => hash(JSON.stringify({ ...c, token: undefined }));
function prior(db: any, c: KeyNoteCaptureCommand) {
  const row = db.prepare('SELECT * FROM receipt WHERE command_id=?').get(c.commandId);
  if (row && (row.campaign_id !== c.campaignId || row.fingerprint !== fingerprint(c)))
    throw new Error('Notizauftrag ist bereits anders verwendet.');
  return row;
}
function partial(db: any, c: KeyNoteCaptureCommand) {
  return db
    .prepare('SELECT 1 FROM receipt WHERE command_id IN (?,?)')
    .get(c.commandId + '|note', c.commandId + '|key');
}
function key(db: any, c: KeyNoteCaptureCommand) {
  const row = db
    .prepare('SELECT * FROM dungeon_key_content WHERE campaign_id=? AND id=?')
    .get(c.campaignId, c.room.id);
  const value = row ? checkedKeyRow(row) : null;
  if (value && value.kind !== 'room') throw new Error('Verknüpfung benötigt einen Raum-Key.');
  return value;
}
function currentRoom(db: any, c: KeyNoteCaptureCommand) {
  const row = db
      .prepare('SELECT * FROM room WHERE campaign_id=? AND id=?')
      .get(c.campaignId, c.room.id),
    room = drawingRoom(db, c.campaignId, c.room.id);
  validateRoom(room);
  if (
    room.id !== row.id ||
    room.scopeId !== row.scope_id ||
    room.floorId !== row.floor_id ||
    room.name !== row.name ||
    room.number !== row.number ||
    room.revision !== row.revision
  )
    throw new Error('Raumzuordnung widersprüchlich.');
  const k = key(db, c);
  if (k && k.scopeId !== room.scopeId) throw new Error('Keyzuordnung widersprüchlich.');
  return { room, key: k };
}
function checkedNote(row: any): Note {
  if (!row || row.trashed || hash(row.payload) !== row.checksum)
    throw new Error('Notiz fehlt oder ist beschädigt.');
  const note = worldNoteDocument(JSON.parse(row.payload));
  if (note.deleted || note.id !== row.id || note.revision !== row.revision)
    throw new Error('Notizzuordnung widersprüchlich.');
  return note;
}
const registered = new WeakSet<object>();
function installTitles(db: any) {
  if (!registered.has(db)) {
    db.function('gm_note_title', { deterministic: true }, normalizedNoteTitle);
    registered.add(db);
  }
}
const titleExpression =
  "gm_note_title(CASE WHEN json_valid(payload) THEN CASE WHEN json_type(payload,'$.title')='text' THEN json_extract(payload,'$.title') ELSE '' END ELSE '' END)";
export function readKeyNoteChoices(db: any, cam: string, query: string): KeyNoteChoices {
  if (typeof query !== 'string' || query.length > 1000) throw new Error('Notizsuche prüfen.');
  installTitles(db);
  const q = normalizedNoteTitle(query);
  if (!q) return { entries: [], more: false };
  const rows = db
    .prepare(
      `SELECT * FROM world_note WHERE campaign_id=@cam AND trashed=0 AND instr(${titleExpression},@q)>0 ORDER BY (${titleExpression}=@q) DESC,${titleExpression},id LIMIT 21`,
    )
    .all({ cam, q });
  const entries: KeyNoteChoices['entries'] = [];
  let problems = 0;
  for (const row of rows.slice(0, 20)) {
    try {
      const n = checkedNote(row);
      entries.push({
        id: n.id,
        kind: n.kind,
        title: n.title,
        revision: n.revision,
        preview: n.gmNotes.replace(/\s+/g, ' ').trim().slice(0, 240),
      });
    } catch {
      problems++;
    }
  }
  return {
    entries,
    more: rows.length > 20,
    ...(problems
      ? { notice: `${problems} passende Notizen sind beschädigt und können nicht gewählt werden.` }
      : {}),
  };
}
function reusable(db: any, c: KeyNoteCaptureCommand) {
  const n = checkedNote(
    db
      .prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?')
      .get(c.campaignId, c.note.id),
  );
  if (n.revision !== c.reuseRevision || n.kind !== c.note.kind || n.title !== c.note.title)
    throw new Error('Vorhandene Notiz wurde geändert. Auswahl neu prüfen.');
  return n;
}
export function hasNoteTitle(db: any, campaignId: string, title: string) {
  installTitles(db);
  return !!db
    .prepare(
      `SELECT 1 FROM world_note WHERE campaign_id=? AND trashed=0 AND ${titleExpression}=? LIMIT 1`,
    )
    .get(campaignId, normalizedNoteTitle(title));
}
export function captureKeyNote(
  db: any,
  c: KeyNoteCaptureCommand,
  guard: () => void,
  writeNote: (note: Note, expectedRevision: number | null) => void,
) {
  validateKeyNoteCapture(c);
  return db
    .transaction(() => {
      guard();
      if (prior(db, c)) return { noteId: c.note.id };
      if (partial(db, c)) throw new Error('Unvollständiger Notizauftrag. Status prüfen.');
      const source = currentRoom(db, c);
      if (
        source.room.revision !== c.room.expectedRevision ||
        (source.key?.revision ?? null) !== c.room.keyRevision
      )
        throw new Error('Raum-Key wurde geändert. Notiz bleibt im Eingabefenster.');
      if (c.reuseRevision !== undefined) {
        const n = reusable(db, c);
        if (c.note.gmNotes)
          writeNote(
            { ...n, gmNotes: n.gmNotes + (n.gmNotes ? '\n\n' : '') + c.note.gmNotes },
            n.revision,
          );
      } else {
        if (!c.allowSameTitle && hasNoteTitle(db, c.campaignId, c.note.title))
          throw new Error(
            'Eine Notiz mit diesem Namen existiert bereits. Vorhandene Notiz wählen oder ausdrücklich eine eigenständige neue Notiz anlegen.',
          );
        writeNote(c.note, null);
      }
      const linked = source.key?.references.some(
        (r) => r.id === c.note.id && r.kind === c.note.kind,
      );
      if (!linked)
        executeDrawing(
          db,
          {
            commandId: c.commandId + '|key',
            campaignId: c.campaignId,
            token: c.token,
            action: {
              kind: 'key-batch',
              rooms: [c.room],
              patch: {
                references: [
                  ...(source.key?.references ?? []),
                  { kind: c.note.kind, id: c.note.id, label: c.note.title },
                ],
              },
            },
          },
          guard,
        );
      const revision = key(db, c)!.revision;
      db.prepare('INSERT INTO receipt VALUES(?,?,?,?,?)').run(
        c.commandId,
        fingerprint(c),
        c.campaignId,
        c.note.id,
        revision,
      );
      return { noteId: c.note.id };
    })
    .immediate();
}
export function keyNoteCaptureStatus(
  db: any,
  c: KeyNoteCaptureCommand,
  guard: () => void,
): KeyNoteCaptureStatus {
  validateKeyNoteCapture(c);
  return db.transaction(() => {
    guard();
    const receipt = prior(db, c);
    if (receipt) {
      let targetChanged = true;
      try {
        const note = checkedNote(
          db
            .prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?')
            .get(c.campaignId, c.note.id),
        );
        const source = currentRoom(db, c),
          noteWritten = !!db
            .prepare('SELECT 1 FROM receipt WHERE command_id=?')
            .get(c.commandId + '|note'),
          keyWritten = !!db
            .prepare('SELECT 1 FROM receipt WHERE command_id=?')
            .get(c.commandId + '|key');
        targetChanged =
          note.revision !==
            (c.reuseRevision === undefined ? 1 : c.reuseRevision + (noteWritten ? 1 : 0)) ||
          note.kind !== c.note.kind ||
          note.title !== c.note.title ||
          (c.reuseRevision === undefined &&
            (note.gmNotes !== c.note.gmNotes || note.readAloud !== c.note.readAloud)) ||
          source.room.revision !== c.room.expectedRevision + (keyWritten ? 1 : 0) ||
          source.key?.revision !== receipt.revision ||
          !source.key?.references.some((r) => r.id === c.note.id && r.kind === c.note.kind);
      } catch {}
      return { outcome: 'applied', noteId: c.note.id, targetChanged };
    }
    if (
      partial(db, c) ||
      (c.reuseRevision === undefined &&
        db
          .prepare('SELECT 1 FROM world_note WHERE campaign_id=? AND id=?')
          .get(c.campaignId, c.note.id))
    )
      return { outcome: 'conflict' };
    try {
      if (c.reuseRevision !== undefined) reusable(db, c);
      const source = currentRoom(db, c);
      return {
        outcome:
          source.room.revision === c.room.expectedRevision &&
          (source.key?.revision ?? null) === c.room.keyRevision
            ? 'not-applied'
            : 'conflict',
      };
    } catch {
      return { outcome: 'conflict' };
    }
  })();
}
