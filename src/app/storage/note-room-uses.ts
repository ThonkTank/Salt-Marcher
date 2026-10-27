import { createHash } from 'node:crypto';
import type { NoteRoomUsesPage } from '../campaign/preparation-contracts';
import { validateRoom } from '../shared/room-validation';
import { drawingRoomFromRow } from './drawing';
import { checkedKeyRow } from './dungeon-key';

const registered = new WeakSet<object>();
function install(db: any) {
  if (registered.has(db)) return;
  // Only volatile metadata is cached. Check the source bytes even on a hit.
  const cache = new Map<string, { value: string; bytes: number }>();
  let bytes = 0;
  db.function(
    'gm_room_key_refs',
    { deterministic: true },
    (
      payload: string,
      checksum: string,
      id: string,
      scope: string,
      kind: string,
      revision: number,
    ) => {
      try {
        const identity = JSON.stringify([checksum, id, scope, kind, revision]),
          hit = cache.get(identity);
        if (hit) {
          if (createHash('sha256').update(payload).digest('hex') !== checksum)
            throw new Error('Prüfsumme');
          cache.delete(identity);
          cache.set(identity, hit);
          return hit.value;
        }
        const key = checkedKeyRow({ payload, checksum, id, scope_id: scope, kind, revision });
        const value = JSON.stringify({
            refs:
              key.kind === 'room' ? key.references.map((r) => ({ kind: r.kind, id: r.id })) : [],
            scope: key.scopeId,
            excerpt: key.blocks
              .filter((b) => b.kind === 'text')
              .map((b) => b.text)
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 200),
          }),
          size = Buffer.byteLength(value);
        if (size <= 4 * 1024 * 1024) {
          while (cache.size && (bytes + size > 4 * 1024 * 1024 || cache.size >= 1024)) {
            const first = cache.keys().next().value!;
            bytes -= cache.get(first)!.bytes;
            cache.delete(first);
          }
          cache.set(identity, { value, bytes: size });
          bytes += size;
        }
        return value;
      } catch {
        return JSON.stringify({ problem: true, refs: [] });
      }
    },
  );
  registered.add(db);
}

/** Explicit room-key links from checked documents, without loading the complete drawing snapshot. */
export function readNoteRoomUses(
  db: any,
  cam: string,
  note: { id: string; kind: string },
  offset: number,
): NoteRoomUsesPage {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000)
    throw new Error('Ungültige Raumverweisseite.');
  install(db);
  const rows = db
    .prepare(
      `WITH keys AS MATERIALIZED (
  SELECT id,gm_room_key_refs(payload,checksum,id,scope_id,kind,revision) doc FROM dungeon_key_content WHERE campaign_id=@cam
 ), matches AS (
  SELECT k.id,json_extract(k.doc,'$.scope') scope,json_extract(k.doc,'$.excerpt') excerpt FROM keys k
  WHERE EXISTS(SELECT 1 FROM json_each(k.doc,'$.refs') r WHERE json_extract(r.value,'$.id')=@id AND json_extract(r.value,'$.kind')=@kind)
 ), page AS MATERIALIZED (
  SELECT m.*,r.name FROM matches m
  LEFT JOIN room r ON r.campaign_id=@cam AND r.id=m.id
  ORDER BY r.name COLLATE NOCASE,m.id LIMIT 41 OFFSET @offset
 ), problems AS (
  SELECT count(*) count FROM keys WHERE json_extract(doc,'$.problem')=1
 ) SELECT r.*,p.id keyId,p.scope keyScope,p.excerpt,s.name scopeName,f.name floorName,b.count problems
 FROM problems b LEFT JOIN page p ON 1
 LEFT JOIN room r ON r.campaign_id=@cam AND r.id=p.id
 LEFT JOIN scope s ON s.campaign_id=@cam AND s.id=r.scope_id
 LEFT JOIN drawing_floor f ON f.campaign_id=@cam AND f.scope_id=r.scope_id AND f.id=r.floor_id
 ORDER BY p.name COLLATE NOCASE,p.id`,
    )
    .iterate({ cam, id: note.id, kind: note.kind, offset });
  // The left join retains the problem count even for an empty or exhausted page.
  // Stream full room bodies only after the metadata page has been selected.
  let problems = 0,
    count = 0;
  const entries: NoteRoomUsesPage['entries'] = [];
  for (const row of rows) {
    if (count === 0) problems = row.problems;
    if (row.keyId === null) continue;
    if (++count > 40) break;
    try {
      const room = drawingRoomFromRow(row);
      validateRoom(room);
      if (
        room.id !== row.id ||
        room.scopeId !== row.scope_id ||
        room.floorId !== row.floor_id ||
        room.revision !== row.revision ||
        room.name !== row.name ||
        room.number !== row.number ||
        room.scopeId !== row.keyScope ||
        typeof room.number !== 'string'
      )
        throw new Error('Raumidentität');
      if (row.scopeName === null || row.floorName === null) throw new Error('Raumort');
      entries.push({
        id: room.id,
        title: room.name,
        number: room.number,
        place: row.scopeName + ' · ' + row.floorName,
        excerpt: row.excerpt,
        unavailable: false,
      });
    } catch {
      problems++;
      entries.push({
        id: row.keyId,
        title: 'Raum nicht verfügbar',
        number: '',
        place: 'Quelle fehlt oder ist beschädigt',
        excerpt: '',
        unavailable: true,
      });
    }
  }
  return {
    entries,
    next: count > 40 ? offset + 40 : null,
    ...(problems
      ? {
          notice: `Raumverweise unvollständig: ${problems} Quellen konnten nicht gelesen oder zugeordnet werden.`,
        }
      : {}),
  };
}
