import {
  GROUP_PROFILES,
  type GroupProfile,
  type GroupRecipe,
  type GroupDraft,
} from './room-group-contracts';
import type { Point, Polygon, Room } from '../shared/contracts';
import type { DrawingElement } from './drawing-element-contracts';
import { newElement, combineRooms, inside } from './drawing-model';
export const isBuildingProfile = (p: GroupProfile) => GROUP_PROFILES.indexOf(p) < 6;
export function checkGroupRecipe(r: GroupRecipe) {
  if (
    !r ||
    r.version !== 1 ||
    !GROUP_PROFILES.includes(r.profile) ||
    typeof r.seed !== 'string' ||
    !r.seed.trim() ||
    r.seed.length > 200 ||
    ![r.width, r.depth].every((n) => Number.isFinite(n) && n >= 3 && n <= 80) ||
    (r.floors !== undefined && (!Number.isInteger(r.floors) || r.floors < 1 || r.floors > 6)) ||
    (r.basement !== undefined && typeof r.basement !== 'boolean')
  )
    throw Error('Art, Seed, Größe (3–80 m) und Geschosse (1–6) prüfen.');
}
const programs: Record<GroupProfile, string[]> = {
  Wohnhaus: ['Wohnküche', 'Schlafzimmer', 'Kammer', 'Arbeitszimmer'],
  Werkstatt: ['Werkstatt', 'Materiallager', 'Verkaufsraum', 'Büro'],
  Handel: ['Verkaufsraum', 'Warenlager', 'Büro', 'Kammer'],
  Taverne: ['Schankraum', 'Küche', 'Vorratsraum', 'Gästezimmer'],
  Tempel: ['Heiligtum', 'Sakristei', 'Bibliothek', 'Andachtsraum'],
  Lager: ['Lagerhalle', 'Warenlager', 'Büro', 'Kammer'],
  Gewölbe: ['Wachstube', 'Vorratsraum', 'Aufenthaltsraum', 'Schlaflager'],
  Krypta: ['Grabkammer', 'Andachtsraum', 'Ossarium', 'Grabkammer'],
  Höhle: ['Wohnhöhle', 'Vorratshöhle', 'Schlafhöhle', 'Leere Kammer'],
};
const furnishings: Record<string, string[]> = {
  Wohnküche: ['table', 'chair', 'stove', 'shelf'],
  Schlafzimmer: ['bed', 'chest', 'wardrobe'],
  Kammer: ['shelf', 'chest'],
  Arbeitszimmer: ['desk', 'chair', 'shelf'],
  Werkstatt: ['workbench', 'shelf', 'barrel'],
  Materiallager: ['crate', 'shelf', 'barrel'],
  Verkaufsraum: ['counter', 'shelf', 'crate'],
  Büro: ['desk', 'chair', 'shelf'],
  Warenlager: ['crate', 'barrel', 'shelf'],
  Schankraum: ['counter', 'table', 'chair', 'table', 'chair'],
  Küche: ['stove', 'workbench', 'shelf'],
  Vorratsraum: ['barrel', 'shelf', 'crate'],
  Gästezimmer: ['bed', 'chest', 'chair'],
  Heiligtum: ['altar', 'bench', 'bench'],
  Sakristei: ['wardrobe', 'chest'],
  Bibliothek: ['shelf', 'shelf', 'desk'],
  Andachtsraum: ['altar', 'bench'],
  Lagerhalle: ['crate', 'barrel', 'crate', 'shelf'],
  Wachstube: ['table', 'chair', 'rack'],
  Aufenthaltsraum: ['table', 'bench', 'shelf'],
  Schlaflager: ['bed', 'bed', 'chest'],
  Grabkammer: ['sarcophagus', 'urn', 'urn'],
  Ossarium: ['shelf', 'urn', 'sarcophagus'],
  Wohnhöhle: ['firepit', 'bedroll', 'crate'],
  Vorratshöhle: ['barrel', 'crate'],
  Schlafhöhle: ['bedroll', 'bedroll'],
  'Leere Kammer': ['rock'],
};
export const furnitureNames: Record<string, string> = {
  table: 'Tisch',
  chair: 'Stuhl',
  stove: 'Herd',
  shelf: 'Regal',
  bed: 'Bett',
  chest: 'Truhe',
  wardrobe: 'Schrank',
  desk: 'Schreibtisch',
  workbench: 'Werkbank',
  barrel: 'Fass',
  crate: 'Kiste',
  counter: 'Theke',
  altar: 'Altar',
  bench: 'Bank',
  rack: 'Waffenständer',
  sarcophagus: 'Sarkophag',
  urn: 'Urne',
  firepit: 'Feuerstelle',
  bedroll: 'Schlafplatz',
  rock: 'Fels',
};
const sizes: Record<string, [number, number]> = {
  bed: [1.2, 2],
  sarcophagus: [1.1, 2],
  table: [1.4, 1],
  counter: [2, 0.6],
  bench: [1.8, 0.5],
  shelf: [1.4, 0.5],
  wardrobe: [1.2, 0.6],
  workbench: [1.8, 0.8],
  desk: [1.4, 0.7],
  altar: [1.4, 0.8],
  bedroll: [0.7, 1.8],
};
const rounded = (n: number) => Math.round(n * 1e6) / 1e6;
const rect = (x: number, y: number, w: number, h: number): Polygon => ({
  outer: [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ].map((p) => ({ x: rounded(p.x), y: rounded(p.y) })),
  holes: [],
});
/** Pure, versioned generation. IDs are derived from the group's identity and seed,
 * never from ambient randomness; the store recomputes exactly the reviewed draft. */
export function generateRoomGroup(id: string, recipe: GroupRecipe): GroupDraft {
  checkGroupRecipe(recipe);
  let state = 2166136261;
  for (const c of recipe.seed) state = Math.imul(state ^ c.charCodeAt(0), 16777619);
  const suffix = (state >>> 0).toString(36);
  state ||= 1;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  const { profile, width: w, depth: h } = recipe,
    large = w * h >= 100;
  const floors =
    recipe.floors ??
    (large && ['Wohnhaus', 'Taverne', 'Handel', 'Werkstatt'].includes(profile) ? 2 : 1);
  const basement =
    recipe.basement ?? (large && ['Wohnhaus', 'Taverne', 'Tempel', 'Krypta'].includes(profile));
  const result: GroupDraft = {
    recipe: { ...recipe },
    floors: [],
    rooms: [],
    elements: [],
    footprint: [],
  };
  let serial = 0;
  const identity = (kind: string) => id + ':' + suffix + ':' + kind + ':' + ++serial;
  const addRoom = (floorId: string, name: string, polygon: Polygon) => {
    const room: Room = {
      id: identity('room'),
      scopeId: id,
      floorId,
      number: String(result.rooms.length + 1),
      name,
      revision: 0,
      polygons: [polygon],
      sections: [{ id: identity('key'), kind: 'markdown', markdown: '' }],
    };
    result.rooms.push(room);
    return room;
  };
  const element = (
    kind: DrawingElement['kind'],
    room: Room,
    points: Point[],
    extra: Partial<DrawingElement> = {},
  ) => {
    const e = { ...newElement(kind, id, room.floorId, room.id, points, identity(kind)), ...extra };
    result.elements.push(e);
    return e;
  };
  const furnish = (room: Room, x: number, y: number, rw: number, rh: number) => {
    const choices = furnishings[room.name] ?? ['crate'];
    // Furniture occupies wall strips; a central cross remains free for every door.
    const occupied: { x: number; y: number; w: number; h: number }[] = [];
    for (const variant of choices) {
      const size = sizes[variant] ?? [0.65, 0.65];
      let placed = false;
      for (const angle of [0, 90]) {
        const [fw, fh] = angle ? [size[1], size[0]] : size;
        if (fw > rw / 2 - 0.35 || fh > rh - 1) continue;
        const candidates = [
          { x: x + 0.25 + fw / 2, y: y + 0.25 + fh / 2 },
          { x: x + rw - 0.25 - fw / 2, y: y + 0.25 + fh / 2 },
          { x: x + 0.25 + fw / 2, y: y + rh - 0.25 - fh / 2 },
          { x: x + rw - 0.25 - fw / 2, y: y + rh - 0.25 - fh / 2 },
        ];
        const shift = Math.floor(random() * candidates.length);
        for (let i = 0; i < candidates.length; i++) {
          const p = candidates[(i + shift) % candidates.length]!;
          if (
            Math.abs(p.y - (y + rh / 2)) < fh / 2 + 0.6 ||
            occupied.some(
              (o) =>
                Math.abs(o.x - p.x) < (o.w + fw) / 2 + 0.15 &&
                Math.abs(o.y - p.y) < (o.h + fh) / 2 + 0.15,
            ) ||
            [-1, 1].some((dx) =>
              [-1, 1].some(
                (dy) => !inside({ x: p.x + (dx * fw) / 2, y: p.y + (dy * fh) / 2 }, room.polygons),
              ),
            )
          )
            continue;
          element('object', room, [p], {
            variant,
            name: furnitureNames[variant] ?? variant,
            width: size[0],
            height: size[1],
            angle,
            passable: false,
            blocksSight: variant === 'wardrobe' || variant === 'shelf',
            color: variant === 'sarcophagus' || variant === 'altar' ? '#999389' : '#977451',
          });
          occupied.push({ ...p, w: fw, h: fh });
          placed = true;
          break;
        }
        if (placed) break;
      }
    }
    if (!occupied.length) {
      const variant =
        room.name.includes('Schlaf') || room.name === 'Gästezimmer' ? 'bedroll' : 'chest';
      element('object', room, [{ x: x + 0.65, y: y + 0.65 }], {
        variant,
        name: furnitureNames[variant]!,
        width: 0.6,
        height: 0.6,
        passable: false,
      });
    }
  };
  const hubs: Room[] = [];
  for (let f = basement ? -1 : 0; f < floors; f++) {
    const floorId = f === 0 ? 'ground' : f < 0 ? 'basement' : 'floor-' + f;
    result.floors.push({
      id: floorId,
      name: f < 0 ? 'Keller' : f === 0 ? 'Erdgeschoss' : f + '. Obergeschoss',
      elevation: f * 3.048,
    });
    if (w < 8 || h < 5) {
      const room = addRoom(floorId, programs[profile][0]!, rect(-w / 2, -h / 2, w, h));
      hubs.push(room);
      furnish(room, -w / 2, -h / 2, w, h);
      continue;
    }
    const aisle = 1.8,
      side = (w - aisle) / 2,
      hub = addRoom(
        floorId,
        profile === 'Höhle' ? 'Verbindungsgang' : 'Flur',
        rect(-aisle / 2, -h / 2, aisle, h),
      );
    hubs.push(hub);
    const count = Math.max(1, Math.min(6, Math.floor(h / (profile === 'Lager' ? 7 : 4)))),
      cuts = [-h / 2];
    for (let n = 1; n < count; n++)
      cuts.push(-h / 2 + (h * n) / count + (random() - 0.5) * Math.min(1, h / count - 3));
    cuts.push(h / 2);
    let index = 0;
    for (const sign of [-1, 1])
      for (let n = 0; n < count; n++) {
        const x = sign < 0 ? -w / 2 : aisle / 2,
          y = cuts[n]!,
          rh = cuts[n + 1]! - y;
        const name =
          f < 0
            ? profile === 'Krypta'
              ? 'Grabkammer'
              : 'Vorratsraum'
            : f > 0 && ['Taverne', 'Wohnhaus', 'Handel'].includes(profile)
              ? profile === 'Taverne'
                ? 'Gästezimmer'
                : 'Schlafzimmer'
              : programs[profile][index++ % programs[profile].length]!;
        const poly = rect(x, y, side, rh);
        if (profile === 'Höhle') {
          // Keep the shared wall/door exact, vary only the outside contour inward.
          const edge = sign < 0 ? 3 : 1,
            a = poly.outer[edge]!,
            b = poly.outer[(edge + 1) % 4]!;
          poly.outer.splice(edge + 1, 0, {
            x: a.x - sign * side * (0.08 + random() * 0.12),
            y: (a.y + b.y) / 2,
          });
        }
        const room = addRoom(floorId, name, poly);
        furnish(room, x + 0.4, y, side - 0.8, rh);
        const p = { x: (sign * aisle) / 2, y: y + rh / 2 };
        element('door', room, [p], {
          name: profile === 'Höhle' ? 'Durchgang' : 'Tür',
          targetRoomId: hub.id,
          angle: 90,
          width: 1.524,
          passable: true,
          state: 'open',
          blocksSight: false,
          blocksSound: false,
          anchor: {
            roomId: room.id,
            polygon: 0,
            edge: sign < 0 ? 1 : poly.outer.length - 1,
            t: 0.5,
          },
        });
      }
  }
  const ground = hubs.find((r) => r.floorId === 'ground')!;
  element('door', ground, [{ x: 0, y: -h / 2 }], {
    name: 'Eingang',
    width: 1.524,
    state: 'open',
    blocksSight: false,
    blocksSound: false,
    anchor: { roomId: ground.id, polygon: 0, edge: 0, t: 0.5 },
  });
  for (let i = 1; i < hubs.length; i++) {
    const from = hubs[i - 1]!,
      to = hubs[i]!;
    element(
      'stairs',
      from,
      [
        { x: 0, y: -1 },
        { x: 0, y: 1 },
      ],
      {
        name: 'Treppe',
        width: 1.2,
        targetRoomId: to.id,
        targetFloorId: to.floorId,
        passable: true,
        state: 'open',
      },
    );
  }
  result.footprint = combineRooms(
    result.rooms.filter((r) => r.floorId === 'ground').map((r) => r.polygons),
  );
  return result;
}
