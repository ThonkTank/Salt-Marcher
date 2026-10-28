import { createHash } from 'node:crypto';
import type { DungeonGeometry } from '../atlas/dungeon-contracts';
import { drawingRoom, drawingView } from './drawing-read';
export const hash = (s: string) => createHash('sha256').update(s).digest('hex');

export function dungeonGeometry(db: any, cam: string): DungeonGeometry {
  const drawing = drawingView(db, cam);
  for (const key of drawing.keyContent ?? []) {
    if (key.kind !== 'room' || !key.secret) continue;
    const style = drawing.styles.find((s) => s.id === key.id);
    if (style) style.secret = true;
    else
      drawing.styles.push({
        id: key.id,
        revision: 0,
        scopeId: key.scopeId,
        ceilingMeters: 3.048,
        fill: '#c5b998',
        wall: '#56493e',
        publicLabel: '',
        secret: true,
      });
  }
  const rooms = db
      .prepare(
        `SELECT r.id FROM room r WHERE r.campaign_id=? AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=r.campaign_id AND h.id=r.id AND h.kind='room' AND h.hidden=1) AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=r.campaign_id AND h.id=r.floor_id AND h.scope_id=r.scope_id AND h.kind='floor' AND h.hidden=1)`,
      )
      .all(cam)
      .map((r: any) => drawingRoom(db, cam, r.id)),
    floors = db
      .prepare(
        `SELECT f.id,f.scope_id scopeId,f.name,f.source_elevation elevation FROM drawing_floor f WHERE f.campaign_id=? AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=f.campaign_id AND h.id=f.id AND h.scope_id=f.scope_id AND h.kind='floor' AND h.hidden=1)`,
      )
      .all(cam);
  return { rooms, floors, drawing };
}

export function dungeonGeometryBasis(g: DungeonGeometry, scopeId: string) {
  return hash(
    JSON.stringify({
      rooms: g.rooms.filter((r) => r.scopeId === scopeId).map((r) => [r.id, r.revision]),
      floors: g.floors.filter((f) => f.scopeId === scopeId),
      passages: g.drawing.passages
        ?.filter((p) => p.scopeId === scopeId)
        .map((p) => [p.id, p.revision]),
      paths: g.drawing.paths?.filter((p) => p.scopeId === scopeId).map((p) => [p.id, p.revision]),
      elements: g.drawing.elements
        .filter((e) => e.scopeId === scopeId)
        .map((e) => [e.id, e.revision]),
      triggerFields: g.drawing.triggerFields
        ?.filter((f) => f.scopeId === scopeId)
        .map((f) => [f.id, f.revision]),
      styles: g.drawing.styles.filter((e) => e.scopeId === scopeId).map((e) => [e.id, e.revision]),
    }),
  );
}
