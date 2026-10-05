import {
  type Entity,
  type MapPath,
  type Point,
  type Surface,
  uid,
} from "./model";
import { Session } from "./session";

export type GeneratorKind = "dungeon" | "cave";
export interface GeneratorOptions {
  readonly kind: GeneratorKind;
  readonly seed: number;
  readonly amount: number;
}

function randomSource(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function dungeonEntities(
  session: Session,
  floorId: string,
  amount: number,
  random: () => number,
): Entity[] {
  const { width, height } = session.settings,
    columns = Math.max(1, Math.ceil(Math.sqrt((amount * width) / height))),
    rows = Math.ceil(amount / columns),
    cellWidth = width / columns,
    cellHeight = height / rows,
    centers: Point[] = [],
    polygons = Array.from({ length: amount }, (_, index) => {
      const column = index % columns,
        row = Math.floor(index / columns),
        insetX = Math.min(cellWidth * (0.12 + random() * 0.16), cellWidth / 3),
        insetY = Math.min(cellHeight * (0.12 + random() * 0.16), cellHeight / 3),
        left = column * cellWidth + insetX,
        right = Math.min(width, (column + 1) * cellWidth - insetX),
        top = row * cellHeight + insetY,
        bottom = Math.min(height, (row + 1) * cellHeight - insetY);
      centers.push({ x: (left + right) / 2, y: (top + bottom) / 2 });
      return {
        outer: [
          { x: left, y: top },
          { x: right, y: top },
          { x: right, y: bottom },
          { x: left, y: bottom },
        ],
        holes: [],
      };
    }),
    floor: Surface = {
      id: uid(),
      kind: "surface",
      floorId,
      category: "pattern",
      polygons,
      layer: 120,
      color: 0xb8aa91,
      opacity: 1,
      effect: "none",
      wallColor: 0x45413a,
      wallWidth: 0.22,
    };
  if (centers.length < 2) return [floor];
  const points: Point[] = [centers[0]!];
  for (let index = 1; index < centers.length; index++) {
    const previous = centers[index - 1]!,
      next = centers[index]!,
      elbow =
        random() < 0.5
          ? { x: next.x, y: previous.y }
          : { x: previous.x, y: next.y };
    if (
      (elbow.x !== previous.x || elbow.y !== previous.y) &&
      (elbow.x !== next.x || elbow.y !== next.y)
    )
      points.push(elbow);
    points.push(next);
  }
  const corridors: MapPath = {
    id: uid(),
    kind: "path",
    floorId,
    points,
    closed: false,
    smooth: false,
    width: Math.max(1, Math.min(2.5, Math.min(cellWidth, cellHeight) * 0.22)),
    style: "road",
    color: 0xb8aa91,
    outlineColor: 0x45413a,
    outlineWidth: 0.18,
    layer: 130,
    start: "square",
    end: "square",
    blocksLight: false,
  };
  return [floor, corridors];
}

function caveEntity(
  session: Session,
  floorId: string,
  amount: number,
  random: () => number,
): Surface {
  const { width, height } = session.settings,
    count = Math.max(16, amount * 2),
    center = { x: width / 2, y: height / 2 },
    radiusX = width * 0.42,
    radiusY = height * 0.42,
    outer = Array.from({ length: count }, (_, index) => {
      const angle = (index / count) * Math.PI * 2,
        modulation = 0.78 + random() * 0.22;
      return {
        x: center.x + Math.cos(angle) * radiusX * modulation,
        y: center.y + Math.sin(angle) * radiusY * modulation,
      };
    });
  return {
    id: uid(),
    kind: "surface",
    floorId,
    category: "cave",
    polygons: [{ outer, holes: [] }],
    layer: -300,
    color: 0xafa99b,
    opacity: 1,
    effect: "none",
    wallColor: 0x454443,
    wallWidth: 0.3,
  };
}

export function generateLayout(
  session: Session,
  floorId: string,
  options: GeneratorOptions,
  replaceIds: readonly string[] = [],
): Entity[] {
  if (
    !session.floors.has(floorId) ||
    !Number.isSafeInteger(options.seed) ||
    !Number.isSafeInteger(options.amount) ||
    options.amount <= 0
  )
    throw new Error("Ungültige Generatorwerte.");
  const random = randomSource(options.seed),
    generated =
      options.kind === "dungeon"
        ? dungeonEntities(session, floorId, options.amount, random)
        : [caveEntity(session, floorId, options.amount, random)],
    removed = replaceIds.flatMap((id) => {
      const before = session.entities.get(id);
      return before ? [{ id, before, after: null }] : [];
    });
  session.execute({
    label: replaceIds.length
      ? options.kind === "dungeon"
        ? "Dungeon neu generieren"
        : "Höhle neu generieren"
      : options.kind === "dungeon"
        ? "Dungeon generieren"
        : "Höhle generieren",
    entities: [
      ...removed,
      ...generated.map((entity) => ({ id: entity.id, before: null, after: entity })),
    ],
  });
  return generated;
}
