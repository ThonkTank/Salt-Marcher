import { canonicalJson } from './generation/canonical-json';
import type { AtlasMap, AtlasCell, Hex, Terrain } from './world-contracts';
import { cellAt, hexKey, hexPoint, pointHex, hexDistance } from './world-model';
export interface HexPaintChange {
  key: string;
  before: AtlasCell | null;
  after: AtlasCell;
}
export interface HexPaintEdit {
  mapId: string;
  level: number;
  terrain: Terrain;
  changes: HexPaintChange[];
}
const key = (c: Hex & { level: number }) => c.level + ':' + hexKey(c);
export function beginHexPaint(map: AtlasMap, level: number, terrain: Terrain, radius: number) {
  const cells = new Map(map.cells.map((c) => [key(c), c])),
    changes = new Map<string, HexPaintChange>();
  let previous: Hex | null = null;
  const paint = (h: Hex) => {
    for (let dq = -radius; dq <= radius; dq++)
      for (let dr = -radius; dr <= radius; dr++) {
        const at = { q: h.q + dq, r: h.r + dr };
        if (hexDistance(at, h) > radius) continue;
        const id = key({ ...at, level }),
          old = cells.get(id) ?? null,
          c = old ?? cellAt(map, at, level);
        if (old && c.terrain === terrain) continue;
        if (!changes.has(id) && changes.size >= 5000)
          throw new Error(
            'Ein Strich erreicht 5.000 Hexes. Strich abschließen und einen weiteren beginnen.',
          );
        const after = { ...c, ...at, level, terrain },
          prior = changes.get(id);
        changes.set(id, { key: id, before: prior ? prior.before : old, after });
        cells.set(id, after);
      }
  };
  return {
    touch(h: Hex) {
      const from = previous ?? h,
        count = hexDistance(from, h),
        a = hexPoint(from),
        b = hexPoint(h);
      if (count > 5000) throw new Error('Kartenstrich ist zu lang. In Abschnitten malen.');
      try {
        for (let i = 0; i <= count; i++) {
          const t = count ? i / count : 0;
          paint(pointHex(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t));
        }
        previous = h;
      } finally {
        map.cells = [...cells.values()];
      }
    },
    finish(): HexPaintEdit {
      return { mapId: map.id, level, terrain, changes: [...changes.values()] };
    },
  };
}
export function applyHexPaintEdit(map: AtlasMap, edit: HexPaintEdit, direction: 'undo' | 'redo') {
  if (map.id !== edit.mapId) throw new Error('Geländestrich gehört zu einer anderen Karte.');
  const cells = new Map(map.cells.map((c) => [key(c), c]));
  for (const change of edit.changes) {
    const expected = direction === 'undo' ? change.after : change.before;
    if (canonicalJson(cells.get(change.key) ?? null) !== canonicalJson(expected))
      throw new Error(
        'Ein betroffenes Hex wurde inzwischen geändert. Geländestrich kann nicht überschrieben werden.',
      );
  }
  for (const change of edit.changes) {
    const next = direction === 'undo' ? change.before : change.after;
    if (next) cells.set(change.key, structuredClone(next));
    else cells.delete(change.key);
  }
  map.cells = [...cells.values()];
}
