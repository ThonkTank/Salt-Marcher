import { createHash } from 'node:crypto';
import { worldNoteDocument } from '../../features/world/world-notes';
import {
  detachNoteSource,
  noteSourceLinks,
  sameNoteContent,
  type NoteSourceRecovery,
} from '../campaign/note-thread-edit';
import type { Note } from '../campaign/preparation-contracts';
const digest = (s: string) => createHash('sha256').update(s).digest('hex');
export function installNoteSourceHistory(db: any) {
  db.exec(`CREATE TABLE IF NOT EXISTS note_source_history(campaign_id TEXT NOT NULL REFERENCES campaign(id), id TEXT NOT NULL, note_id TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT NOT NULL, checksum TEXT NOT NULL, PRIMARY KEY(campaign_id,id)) STRICT;
    CREATE INDEX IF NOT EXISTS note_source_history_root ON note_source_history(campaign_id,note_id,revision DESC);`);
}
const same = sameNoteContent;
/** Called inside the existing canonical note transaction, after its conflict and identity checks. */
export function rememberSourceUnlink(
  db: any,
  cam: string,
  id: string,
  before: Note | null,
  after: Note,
) {
  if (!before) return;
  const remaining = noteSourceLinks(after),
    removed = [...noteSourceLinks(before)].filter(([id]) => !remaining.has(id));
  if (removed.length !== 1) return;
  for (const [sourceId, links] of removed) {
    if (links.family) continue;
    if (!same(detachNoteSource(before, sourceId).note, after)) continue;
    const payload = JSON.stringify({ sourceId, before, after });
    db.prepare('INSERT INTO note_source_history VALUES(?,?,?,?,?,?)').run(
      cam,
      id,
      before.id,
      after.revision,
      payload,
      digest(payload),
    );
    return;
  }
}
function checked(row: any): NoteSourceRecovery {
  if (digest(row.payload) !== row.checksum)
    throw Error('Gesicherte Quellenänderung ist beschädigt.');
  const value = JSON.parse(row.payload),
    before = worldNoteDocument(value.before),
    after = worldNoteDocument(value.after);
  if (
    typeof value.sourceId !== 'string' ||
    !value.sourceId ||
    !noteSourceLinks(before).has(value.sourceId) ||
    noteSourceLinks(after).has(value.sourceId) ||
    before.id !== row.note_id ||
    after.id !== row.note_id ||
    after.revision !== row.revision ||
    after.revision !== before.revision + 1 ||
    !same(detachNoteSource(before, value.sourceId).note, after)
  )
    throw Error('Gesicherte Quellenänderung hat eine widersprüchliche Zuordnung.');
  return { id: row.id, sourceId: value.sourceId, title: '', before, after };
}
export function validateNoteSourceHistory(db: any) {
  if (!db.prepare("SELECT 1 FROM sqlite_schema WHERE name='note_source_history'").get()) return;
  for (const row of db.prepare('SELECT * FROM note_source_history').iterate()) checked(row);
}
export function readSourceUnlinks(db: any, cam: string, root: Note) {
  const values: NoteSourceRecovery[] = [],
    remaining = noteSourceLinks(root),
    seen = new Set<string>();
  for (const row of db
    .prepare(
      'SELECT * FROM note_source_history WHERE campaign_id=? AND note_id=? ORDER BY revision DESC LIMIT 20',
    )
    .all(cam, root.id)) {
    const value = checked(row);
    // A source already used again remains in the normal map, rather than offering a repeated undo.
    if (remaining.has(value.sourceId) || seen.has(value.sourceId)) continue;
    seen.add(value.sourceId);
    const source = db
      .prepare('SELECT payload,checksum,trashed FROM world_note WHERE campaign_id=? AND id=?')
      .get(cam, value.sourceId);
    value.unavailable = !source || !!source.trashed || digest(source.payload) !== source.checksum;
    value.title = !value.unavailable
      ? worldNoteDocument(JSON.parse(source.payload)).title
      : 'Originalquelle nicht verfügbar';
    values.push(value);
  }
  return values;
}
