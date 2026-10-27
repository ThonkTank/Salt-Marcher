import type { Room } from './contracts';
export function validateRoom(room: Pick<Room, 'name' | 'polygons' | 'sections'>): void {
  validateRoomContent(room, false);
}
/** Drafts must be safely readable, but incomplete author input is not a commit. */
export function validateRoomDraftContent(room: Pick<Room, 'name' | 'polygons' | 'sections'>): void {
  validateRoomContent(room, true);
}
function validateRoomContent(
  room: Pick<Room, 'name' | 'polygons' | 'sections'>,
  draft: boolean,
): void {
  if (!room || typeof room.name !== 'string' || (!draft && room.name.length > 1000))
    throw new Error('Bitte einen Raumnamen eingeben.');
  if (
    !Array.isArray(room.polygons) ||
    !room.polygons.length ||
    (!draft && room.polygons.length > 10000)
  )
    throw new Error('Raumkontur fehlt oder ist zu groß.');
  for (const polygon of room.polygons) {
    if (!polygon || !Array.isArray(polygon.outer) || !Array.isArray(polygon.holes))
      throw new Error('Ungültige Kontur.');
    for (const ring of [polygon.outer, ...polygon.holes]) {
      if (!Array.isArray(ring) || (!draft && (ring.length < 3 || ring.length > 100000)))
        throw new Error('Eine Kontur benötigt mindestens drei Punkte.');
      for (const point of ring)
        if (
          !point ||
          !Number.isFinite(point.x) ||
          !Number.isFinite(point.y) ||
          (!draft && (Math.abs(point.x) > 1e9 || Math.abs(point.y) > 1e9))
        )
          throw new Error('Ungültige lokale Koordinate.');
      if (!draft) {
        const area = ring.reduce((sum, p, i) => {
          const q = ring[(i + 1) % ring.length]!;
          return sum + p.x * q.y - q.x * p.y;
        }, 0);
        if (Math.abs(area) < 1e-8) throw new Error('Die Kontur hat keine Fläche.');
      }
    }
  }
  if (!Array.isArray(room.sections) || (!draft && room.sections.length > 10000))
    throw new Error('Ungültiger Raum-Key.');
  const ids = new Set<string>();
  for (const section of room.sections) {
    if (!section || typeof section.id !== 'string' || !section.id || ids.has(section.id))
      throw new Error('Abschnittsidentitäten müssen eindeutig sein.');
    ids.add(section.id);
    if (
      section.kind === 'markdown'
        ? typeof section.markdown !== 'string' || (!draft && section.markdown.length > 2_000_000)
        : section.kind !== 'passage' || typeof section.doorId !== 'string'
    )
      throw new Error('Ungültiger Key-Abschnitt.');
  }
}
