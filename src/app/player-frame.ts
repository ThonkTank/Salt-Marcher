import type { PlayerFrame } from './player-contracts';
import type { Point, Polygon } from './contracts';
const point = ({ x, y }: Point): Point => ({ x, y });
const polygons = (values: Polygon[]) =>
  values.map(({ outer, holes }) => ({
    outer: outer.map(point),
    holes: holes.map((hole) => hole.map(point)),
  }));
/** Only visual fields cross the passive window boundary, including for older payloads. */
export function visualPlayerFrame(frame: PlayerFrame): PlayerFrame {
  if (!frame || typeof frame.title !== 'string') return { mode: 'blank', title: '' };
  if (frame.mode === 'image' && frame.imageId)
    return { mode: 'image', title: frame.title, imageId: frame.imageId };
  if (frame.mode === 'map' && frame.map) {
    const m = frame.map;
    return {
      mode: 'map',
      title: frame.title,
      map: {
        hexMeters: m.hexMeters,
        position: { q: m.position.q, r: m.position.r },
        cells: m.cells.map(({ q, r, terrain, road, river, visible, label }) => ({
          q,
          r,
          terrain,
          road,
          river,
          visible,
          label,
        })),
        markers: m.markers.map(({ q, r, label, visible }) => ({ q, r, label, visible })),
      },
    };
  }
  if (frame.mode === 'dungeon' && frame.dungeon) {
    const d = frame.dungeon;
    return {
      mode: 'dungeon',
      title: frame.title,
      dungeon: {
        position: point(d.position),
        known: polygons(d.known),
        visible: polygons(d.visible),
        labels: d.labels.map(({ point: p, text }) => ({ point: point(p), text })),
        markers: d.markers.map(({ point: p, kind, open }) => ({ point: point(p), kind, open })),
        ...(d.tracks
          ? { tracks: d.tracks.map(({ from, to }) => ({ from: point(from), to: point(to) })) }
          : {}),
      },
    };
  }
  return { mode: 'blank', title: '' };
}
