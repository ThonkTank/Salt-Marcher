import { type Entity, type Light, type MapObject, type Point, type ReferenceImage, uid } from "./model";
import { type RecordChange } from "./session";
import { entityBounds, moveEntity, portalPose, type Bounds } from "./geometry";

export const nativeSelectionTypes = [
  ["walls", "Wände"],
  ["portals", "Portale"],
  ["objects", "Objekte"],
  ["paths", "Pfade"],
  ["lights", "Lichter"],
  ["patterns", "Muster"],
  ["roofs", "Dächer"],
] as const;

export const additionalSelectionTypes = [
  ["materials", "Materialflächen"],
  ["ground", "Grundflächen und Höhlen"],
  ["water", "Wasser"],
  ["terrain", "Terrain"],
  ["references", "Nachzeichenvorlagen"],
] as const;

export const selectionTypes = [
  ...nativeSelectionTypes,
  ...additionalSelectionTypes,
] as const;

export type SelectionType = (typeof selectionTypes)[number][0];

/** Dungeondraft orders each painted kind across its numeric layers. */
export function selectionStackChange(
  entities: ReadonlyMap<string, Entity>,
  id: string,
  direction: "front" | "back",
): RecordChange<Entity> | undefined {
  const source = entities.get(id);
  if (!source || !(
    source.kind === "object" || source.kind === "surface" ||
    source.kind === "roof"
  )) return undefined;
  const records = [...entities.values()];
  const peers = records.flatMap((entity, index) =>
    entity.floorId === source.floorId &&
    entity.kind === source.kind &&
    (entity.kind !== "surface" ||
      (source.kind === "surface" && entity.category === source.category))
      ? [index] : [],
  );
  const target = direction === "front" ? peers.at(-1) : peers[0];
  if (target === undefined || records[target]?.id === id) return undefined;
  return { id, before: source, after: source, afterIndex: target };
}

export function selectionType(entity: Entity): SelectionType {
  switch (entity.kind) {
    case "building":
    case "wall":
      return "walls";
    case "door":
      return "portals";
    case "object":
      return "objects";
    case "path":
      return "paths";
    case "light":
      return "lights";
    case "roof":
      return "roofs";
    case "reference":
      return "references";
    case "surface":
      if (entity.category === "pattern") return "patterns";
      if (entity.category === "material") return "materials";
      if (entity.category === "water") return "water";
      if (entity.category === "terrain") return "terrain";
      return "ground";
  }
}

export const selectionLayers = [
  ["fixed", "Feste Ebenen"],
  ["-400", "Unter dem Boden"],
  ["-100", "Unter Wasser"],
  ["100", "Benutzerebene 1"],
  ["200", "Benutzerebene 2"],
  ["300", "Benutzerebene 3"],
  ["400", "Benutzerebene 4"],
  ["700", "Über Wänden"],
  ["900", "Über Dächern"],
] as const;

export type SelectionLayer = (typeof selectionLayers)[number][0];
const userSelectionLayers = selectionLayers.slice(1);

/** Fixed system elements remain separate from user layers, even at the same draw rank. */
export function selectionLayer(entity: Entity): SelectionLayer {
  if (
    entity.kind !== "object" &&
    entity.kind !== "path" &&
    !(entity.kind === "surface" &&
      (entity.category === "material" || entity.category === "pattern"))
  )
    return "fixed";
  const rank = entity.layer ?? 100;
  let closest: SelectionLayer = userSelectionLayers[0]![0];
  let distance = Infinity;
  for (const [value] of userSelectionLayers) {
    const next = Math.abs(rank - Number(value));
    if (next < distance) {
      closest = value;
      distance = next;
    }
  }
  return closest;
}

export function selectionAllowed(
  entity: Entity,
  types: ReadonlySet<SelectionType>,
  layers: ReadonlySet<SelectionLayer>,
): boolean {
  return types.has(selectionType(entity)) && layers.has(selectionLayer(entity));
}

/** Dungeondraft ignores locked elements on an ordinary click; Alt can pick one for unlocking. */
export function selectableByClick(
  entity: Entity,
  types: ReadonlySet<SelectionType>,
  layers: ReadonlySet<SelectionLayer>,
  alt: boolean,
): boolean {
  return selectionAllowed(entity, types, layers) && (!entity.locked || alt);
}

/** Mirror acts on selected objects as one edit; other selection types stay untouched. */
export function selectionMirrorChanges(
  entities: readonly Entity[],
): { before: MapObject; after: MapObject }[] {
  return entities
    .filter((entity): entity is MapObject =>
      entity.kind === "object" && !entity.locked,
    )
    .map((before) => ({ before, after: { ...before, flip: !before.flip } }));
}

export type BoxSelection = MapObject | ReferenceImage;
export type TransformSelection = BoxSelection | Light;
export interface SelectionFrame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
}
export type SelectionTransform =
  | { mode: "move" }
  | { mode: "scale"; corner: 0 | 1 | 2 | 3 }
  | { mode: "rotate" };
export type SelectionGrip = "box" | "light";

/** Native SelectTool: corner grips take priority over the box interior. */
export function selectionTransformAt(
  entity: TransformSelection,
  point: Point,
  pixelsPerField: number,
): SelectionTransform {
  // Native furniture grips its world-aligned bounds even when the object turns.
  // A light uses its symbol frame, independent of illumination radius.
  const frame = entity.kind === "light"
    ? { x: entity.x, y: entity.y, width: 1, height: 1,
      rotation: entity.rotation ?? 0 }
    : selectionFrame([entity])!;
  return transformAtFrame(frame, point, pixelsPerField, true,
    entity.kind === "light" ? "light" : "box");
}

function transformAtFrame(
  frame: SelectionFrame,
  point: Point,
  pixelsPerField: number,
  canScale: boolean,
  grip: SelectionGrip = "box",
): SelectionTransform {
  const c = Math.cos(frame.rotation),
    s = Math.sin(frame.rotation),
    dx = point.x - frame.x,
    dy = point.y - frame.y,
    x = dx * c + dy * s,
    y = -dx * s + dy * c,
    halfWidth = frame.width / 2,
    halfHeight = frame.height / 2;
  if (canScale) {
    const gripPixels = grip === "light" ? 32 : 33;
    for (const [corner, cornerX, cornerY] of [
      [0, -halfWidth, -halfHeight], [1, halfWidth, -halfHeight],
      [2, halfWidth, halfHeight], [3, -halfWidth, halfHeight],
    ] as const) {
      const distancePixels = Math.hypot(x - cornerX, y - cornerY) * pixelsPerField;
      if (distancePixels < gripPixels ||
        (grip === "box" && distancePixels === gripPixels))
        return { mode: "scale", corner };
    }
  }
  if (Math.abs(x) <= halfWidth && Math.abs(y) <= halfHeight)
    return { mode: "move" };
  return { mode: "rotate" };
}

/** The shared frame measures light symbols, not their illumination radius. */
export function selectionFrame(
  entities: readonly TransformSelection[],
  rotation = 0,
): SelectionFrame | undefined {
  if (!entities.length) return undefined;
  const c = Math.cos(rotation), s = Math.sin(rotation);
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  for (const entity of entities) {
    const halfWidth = entity.kind === "light" ? 0.5 : entity.width / 2,
      halfHeight = entity.kind === "light" ? 0.5 : entity.height / 2,
      angle = entity.rotation ?? 0,
      ec = Math.cos(angle), es = Math.sin(angle);
    for (const x of [-halfWidth, halfWidth])
      for (const y of [-halfHeight, halfHeight]) {
        const worldX = entity.x + x * ec - y * es,
          worldY = entity.y + x * es + y * ec,
          localX = worldX * c + worldY * s,
          localY = -worldX * s + worldY * c;
        left = Math.min(left, localX);
        right = Math.max(right, localX);
        top = Math.min(top, localY);
        bottom = Math.max(bottom, localY);
      }
  }
  const midX = (left + right) / 2, midY = (top + bottom) / 2;
  return {
    x: midX * c - midY * s,
    y: midX * s + midY * c,
    width: right - left,
    height: bottom - top,
    rotation,
  };
}

export function selectionFrameTransformAt(
  frame: SelectionFrame,
  point: Point,
  pixelsPerField: number,
  grip: SelectionGrip = "box",
): SelectionTransform {
  return transformAtFrame(frame, point, pixelsPerField, true, grip);
}

/** Native marquee probes select free-standing graphics by their anchor, even when clipped. */
export function selectionInsideBox(
  entity: Entity,
  box: Bounds,
  get: (id: string) => Entity | undefined,
): boolean {
  if (entity.kind === "wall") return false;
  if (entity.kind === "roof")
    return entity.points.every((point) =>
      point.x >= box.x && point.y >= box.y &&
      point.x <= box.x + box.width && point.y <= box.y + box.height);
  if (entity.kind === "surface" && entity.category === "pattern") {
    return entity.polygons.length > 0 && entity.polygons.every((polygon) =>
      polygon.outer.length > 0 && polygon.outer.every((point) =>
        point.x >= box.x && point.y >= box.y &&
        point.x <= box.x + box.width &&
        point.y <= box.y + box.height));
  }
  if (entity.kind === "door") {
    if (entity.anchor) return false;
    const pose = portalPose(entity, get);
    return pose.x >= box.x && pose.y >= box.y &&
      pose.x <= box.x + box.width && pose.y <= box.y + box.height;
  }
  if (entity.kind === "object" || entity.kind === "reference" || entity.kind === "light")
    return entity.x >= box.x && entity.y >= box.y &&
      entity.x <= box.x + box.width && entity.y <= box.y + box.height;
  const bounds = entityBounds(entity, get);
  return bounds.x >= box.x && bounds.y >= box.y &&
    bounds.x + bounds.width <= box.x + box.width &&
    bounds.y + bounds.height <= box.y + box.height;
}

/** One pointer gesture transforms every selected member about the shared frame. */
export function transformSelectionGroup(
  entities: readonly TransformSelection[],
  frame: SelectionFrame,
  action: Exclude<SelectionTransform, { mode: "move" }>,
  start: Point,
  end: Point,
): { frame: SelectionFrame; entities: TransformSelection[] } {
  if (action.mode === "rotate") {
    const first = Math.atan2(start.y - frame.y, start.x - frame.x),
      last = Math.atan2(end.y - frame.y, end.x - frame.x),
      change = last - first,
      c = Math.cos(change), s = Math.sin(change);
    return {
      frame: { ...frame, rotation: frame.rotation + change },
      entities: entities.map((entity) => {
        const dx = entity.x - frame.x, dy = entity.y - frame.y;
        return {
          ...entity,
          x: frame.x + dx * c - dy * s,
          y: frame.y + dx * s + dy * c,
          rotation: (entity.rotation ?? 0) + change,
        };
      }),
    };
  }
  const afterFrame = scaleSelectionFrame(frame, action.corner, start, end),
    factor = afterFrame.width / frame.width;
  return {
    frame: afterFrame,
    entities: entities.map((entity) => {
      const common = {
        ...entity,
        x: afterFrame.x + (entity.x - frame.x) * factor,
        y: afterFrame.y + (entity.y - frame.y) * factor,
      };
      return entity.kind === "light" ? common : {
        ...common,
        width: entity.width * factor,
        height: entity.height * factor,
      };
    }),
  };
}

/** Native furniture scaling keeps the opposite world-aligned frame corner fixed. */
export function scaleBoxSelection(
  entity: BoxSelection,
  corner: 0 | 1 | 2 | 3,
  start: Point,
  end: Point,
): BoxSelection {
  const frame = selectionFrame([entity])!,
    afterFrame = scaleSelectionFrame(frame, corner, start, end),
    factor = afterFrame.width / frame.width;
  return {
    ...entity,
    x: entity.x + afterFrame.x - frame.x,
    y: entity.y + afterFrame.y - frame.y,
    width: entity.width * factor,
    height: entity.height * factor,
  };
}

export function scaleSelectionFrame(
  entity: SelectionFrame,
  corner: 0 | 1 | 2 | 3,
  start: Point,
  end: Point,
): SelectionFrame {
  const c = Math.cos(entity.rotation),
    s = Math.sin(entity.rotation),
    dx = end.x - start.x,
    dy = end.y - start.y,
    localX = dx * c + dy * s,
    localY = -dx * s + dy * c,
    signX = corner === 0 || corner === 3 ? -1 : 1,
    signY = corner === 0 || corner === 1 ? -1 : 1,
    changeX = signX * localX / entity.width,
    changeY = signY * localY / entity.height,
    change = changeX >= 0 && changeY >= 0
      ? Math.min(changeX, changeY)
      : changeX <= 0 && changeY <= 0
        ? Math.max(changeX, changeY)
        : 0,
    factor = Math.max(0.1 / Math.min(entity.width, entity.height), 1 + change),
    width = entity.width * factor,
    height = entity.height * factor,
    centerX = signX * (width - entity.width) / 2,
    centerY = signY * (height - entity.height) / 2;
  return {
    x: entity.x + centerX * c - centerY * s,
    y: entity.y + centerX * s + centerY * c,
    width,
    height,
    rotation: entity.rotation,
  };
}

export function rotateBoxSelection(
  entity: TransformSelection,
  start: Point,
  end: Point,
): TransformSelection {
  const first = Math.atan2(start.y - entity.y, start.x - entity.x),
    last = Math.atan2(end.y - entity.y, end.x - entity.x);
  return { ...entity, rotation: (entity.rotation ?? 0) + last - first };
}

/** The native Paste action immediately centers the copied selection in the viewport. */
export function selectionCenter(
  entities: readonly Entity[],
  get: (id: string) => Entity | undefined,
): Point | undefined {
  if (!entities.length) return undefined;
  let left = Infinity,
    top = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  for (const entity of entities) {
    let bounds = entityBounds(entity, get);
    if (entity.kind === "object" || entity.kind === "reference") {
      const c = Math.abs(Math.cos(entity.rotation)),
        s = Math.abs(Math.sin(entity.rotation)),
        halfWidth = (entity.width * c + entity.height * s) / 2,
        halfHeight = (entity.width * s + entity.height * c) / 2;
      bounds = {
        x: entity.x - halfWidth,
        y: entity.y - halfHeight,
        width: halfWidth * 2,
        height: halfHeight * 2,
      };
    } else if (entity.kind === "light") {
      bounds = { x: entity.x - 0.5, y: entity.y - 0.5, width: 1, height: 1 };
    }
    left = Math.min(left, bounds.x);
    top = Math.min(top, bounds.y);
    right = Math.max(right, bounds.x + bounds.width);
    bottom = Math.max(bottom, bounds.y + bounds.height);
  }
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

export interface SelectionClipboard {
  readonly entities: readonly Entity[];
  readonly center?: Point;
}

/** Capture dependent portal positions now, so later edits cannot change the copied contents. */
export function captureSelectionClipboard(
  sources: readonly Entity[],
  get: (id: string) => Entity | undefined,
): SelectionClipboard {
  const copiedIds = new Set(sources.map((entity) => entity.id));
  const entities = sources.map((source): Entity => {
    if (
      source.kind !== "door" ||
      !source.anchor ||
      copiedIds.has(source.anchor.boundaryId)
    )
      return source;
    const pose = portalPose(source, get);
    return {
      ...source,
      anchor: undefined,
      x: pose.x,
      y: pose.y,
      rotation: pose.angle,
      note: undefined,
    };
  });
  return { entities, center: selectionCenter(entities, get) };
}

export function copyAtViewportCenter(
  sources: readonly Entity[],
  sourceCenter: Point,
  viewportCenter: Point,
  floorId: string,
  newId: () => string = uid,
): Entity[] {
  const dx = viewportCenter.x - sourceCenter.x,
    dy = viewportCenter.y - sourceCenter.y,
    idMap = new Map(sources.map((entity) => [entity.id, newId()])),
    groupMap = new Map<string, string>();
  return sources.map((source) => {
    const groupId = source.groupId
      ? (groupMap.get(source.groupId) ?? newId())
      : undefined;
    if (source.groupId && groupId) groupMap.set(source.groupId, groupId);
    let copy: Entity;
    if (source.kind === "door" && source.anchor) {
      const boundaryId = idMap.get(source.anchor.boundaryId);
      if (!boundaryId)
        throw new Error("Kopierter Durchgang hat keine kopierte Wand.");
      copy = {
        ...source,
        id: idMap.get(source.id)!,
        floorId,
        anchor: { ...source.anchor, boundaryId },
        groupId,
      };
    } else
      copy = {
        ...source,
        id: idMap.get(source.id)!,
        floorId,
        groupId,
      };
    if (copy.kind === "object" && copy.roomId && source.floorId !== floorId)
      copy = { ...copy, roomId: undefined };
    return moveEntity(copy, dx, dy);
  });
}
