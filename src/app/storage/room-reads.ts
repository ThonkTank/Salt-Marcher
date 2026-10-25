import { createHash } from 'node:crypto';
import { validateRoom } from '../shared/contracts';
import type { RoomGeometry, RoomSummary, RoomDirectoryQuery } from '../shared/contracts';

export const visibleRoomWhere = `r.campaign_id=? AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=r.campaign_id AND h.id=r.id AND h.kind='room' AND h.hidden=1) AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=r.campaign_id AND h.id=r.floor_id AND h.scope_id=r.scope_id AND h.kind='floor' AND h.hidden=1)`;
const columns = 'r.id,r.scope_id scopeId,r.floor_id floorId,r.number,r.name,r.revision';
const digest = (s: string) => createHash('sha256').update(s).digest('hex');
export const roomOrder = (
  a: Pick<RoomSummary, 'number' | 'id'>,
  b: Pick<RoomSummary, 'number' | 'id'>,
) => numbers.compare(a.number, b.number) || a.id.localeCompare(b.id);
const numbers = new Intl.Collator('de', { numeric: true });
/** Never parse the prose array or retain all canonical payloads for a map read. */
export function roomGeometries(db: any, cam: string, hidden = false) {
  const rooms: RoomGeometry[] = [],
    problems: { id: string; number: string; message: string }[] = [];
  const sql = `SELECT ${columns},r.payload,r.checksum,CASE WHEN json_valid(r.payload) THEN json_extract(r.payload,'$.polygons') END polygons FROM room r WHERE ${hidden ? "r.campaign_id=? AND EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=r.campaign_id AND h.id=r.id AND h.kind='room' AND h.hidden=1)" : visibleRoomWhere}`;
  for (const row of db.prepare(sql).iterate(cam)) {
    try {
      if (digest(row.payload) !== row.checksum)
        throw new Error('Datenprüfung fehlgeschlagen. Originaldaten bleiben erhalten.');
      const polygons = JSON.parse(row.polygons ?? 'null');
      // Reuse canonical contour rules, without treating a projection as author content.
      validateRoom({ name: row.name, polygons, sections: [] });
      rooms.push({
        id: row.id,
        scopeId: row.scopeId,
        floorId: row.floorId,
        number: row.number,
        name: row.name,
        revision: row.revision,
        polygons,
      });
    } catch (e) {
      problems.push({ id: row.id, number: row.number, message: (e as Error).message });
    }
  }
  rooms.sort(roomOrder);
  return { rooms, problems };
}
export function roomDirectoryQuery(q: RoomDirectoryQuery) {
  if (
    !q ||
    typeof q.text !== 'string' ||
    q.text.length > 200 ||
    (q.limit !== undefined && (!Number.isSafeInteger(q.limit) || q.limit < 1 || q.limit > 200)) ||
    (q.scopeId !== undefined && (typeof q.scopeId !== 'string' || !q.scopeId)) ||
    (q.floorId !== undefined && (typeof q.floorId !== 'string' || !q.floorId))
  )
    throw new Error('Raumsuche prüfen.');
  const c = q.cursor;
  if (
    c &&
    (!c.after ||
      typeof c.after.id !== 'string' ||
      typeof c.after.number !== 'string' ||
      typeof c.fence !== 'string' ||
      c.text !== q.text ||
      c.scopeId !== q.scopeId ||
      c.floorId !== q.floorId)
  )
    throw new Error('Raumsuche inzwischen geändert. Suche erneut beginnen.');
}
/** Worker-side streaming scan: only limit+1 metadata rows and one source text live. */
export function roomDirectoryRows(db: any, cam: string, q: RoomDirectoryQuery) {
  roomDirectoryQuery(q);
  const text = q.text.toLocaleLowerCase(),
    limit = q.limit ?? 40,
    items: RoomSummary[] = [];
  let total = 0,
    unreadable = 0;
  const args: any[] = [cam];
  let where = visibleRoomWhere;
  if (q.scopeId !== undefined) {
    where += ' AND r.scope_id=?';
    args.push(q.scopeId);
  }
  if (q.floorId !== undefined) {
    where += ' AND r.floor_id=?';
    args.push(q.floorId);
  }
  for (const row of db
    .prepare(`SELECT ${columns}${text ? ',r.payload,r.checksum' : ''} FROM room r WHERE ${where}`)
    .iterate(...args)) {
    let content = '';
    if (text) {
      try {
        if (digest(row.payload) !== row.checksum) throw new Error('checksum');
        const parsed = JSON.parse(row.payload);
        if (!Array.isArray(parsed.sections)) throw new Error('sections');
        content = parsed.sections.map((s: any) => s.markdown ?? '').join('\n');
      } catch {
        unreadable++;
      }
      if (!`${row.number} ${row.name} ${content}`.toLocaleLowerCase().includes(text)) continue;
    }
    total++;
    if (q.cursor && roomOrder(row, q.cursor.after) <= 0) continue;
    const item: RoomSummary = {
      id: row.id,
      scopeId: row.scopeId,
      floorId: row.floorId,
      number: row.number,
      name: row.name,
      revision: row.revision,
    };
    let at = items.findIndex((x) => roomOrder(item, x) < 0);
    if (at < 0) at = items.length;
    if (at <= limit) {
      items.splice(at, 0, item);
      if (items.length > limit + 1) items.pop();
    }
  }
  const more = items.length > limit;
  if (more) items.pop();
  return { items, total, unreadable, more };
}
