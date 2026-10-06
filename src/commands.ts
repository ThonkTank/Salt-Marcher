import {
  type Entity,
  type Point,
  type Polygon,
  type Building,
  type Room,
  type Door,
  type MapObject,
  type Light,
  type Floor,
  type Boundary,
  type Wall,
  type Surface,
  type MapPath,
  type Roof,
  type ReferenceImage,
  type Settings,
  type CompassDirection,
  type PassageDetails,
  isRoom,
  safePath,
  uid,
  validatePolygons,
} from "./model";
import {
  type Command,
  type RecordChange,
  Session,
  textPatch,
} from "./session";
import {
  edgeAt,
  inside,
  moveEntity,
  portalPose,
  reanchorPortal,
  buildingContourEntries,
  followPortalAfterContourEdit,
  assertBuildingTopology,
  type BuildingContourEdit,
} from "./geometry";
import { type ComposeBuildingResult } from "./compute";

export function createRoom(
  session: Session,
  floorId: string,
  points: readonly Point[],
  noteFolder: string,
  style: Pick<Room, "wallAssetId" | "material"> = {},
  mapPath?: string,
): Room {
  const used = new Set(
    [...session.entities.values()]
      .filter(isRoom)
      .map((e) => e.number),
  );
  let number = 1;
  while (used.has(String(number))) number++;
  const id = uid(),
    name = "Raum " + number,
    path = noteFolder + "/" + id + ".md";
  const room: Room = {
    id,
    kind: "building",
    floorId,
    polygons: [{ outer: points, holes: [] }],
    layer: 200,
    number: String(number),
    name,
    note: { path },
    fill: 0xbfb09a,
    wall: 0x403e39,
    wallWidth: 0.2,
    ...style,
  };
  session.loadNote(path, null);
  if (mapPath) safePath(mapPath);
  const text =
    '---\nroom_id: "' +
    id +
    '"\n---\n# ' +
    number +
    " " +
    name +
    "\n\n" +
    (mapPath ? "![[" + mapPath + "]]\n\n" : "");
  session.execute({
    label: "Raum anlegen",
    entities: [{ id, before: null, after: room }],
    texts: [{ path, offset: 0, before: "", after: text, create: true }],
    affectsRules: true,
  });
  return room;
}
export function adoptFloorAsRoom(
  session: Session,
  surfaceId: string,
  noteFolder: string,
  style: Pick<Room, "wallAssetId"> = {},
  mapPath?: string,
): Room {
  const current = session.entities.get(surfaceId);
  if (current?.kind !== "building" || isRoom(current))
    throw new Error("Eine gezeichnete Bodenfläche auswählen.");
  const used = new Set(
    [...session.entities.values()]
      .filter(isRoom)
      .map((entity) => entity.number),
  );
  let number = 1;
  while (used.has(String(number))) number++;
  const name = "Raum " + number,
    path = noteFolder + "/" + current.id + ".md",
    room: Room = {
      ...current,
      number: String(number),
      name,
      note: { path },
      ...style,
    };
  if (mapPath) safePath(mapPath);
  const portalNames = {
    door: "Tür",
    window: "Fenster",
    bars: "Gitter",
    opening: "Offener Durchgang",
  };
  const portalChanges: RecordChange<Entity>[] = [];
  const portalSections: string[] = [];
  for (const entity of session.entities.values()) {
    if (entity.kind !== "door" || entity.anchor?.boundaryId !== current.id)
      continue;
    if (entity.note && entity.note.path !== path)
      throw new Error("Der Durchgang besitzt bereits einen anderen Key-Verweis.");
    const passage = entity.passage ?? {
      description: "",
      state: entity.variant === "opening" ? "open" as const : "closed" as const,
      hidden: false,
    };
    const after: Door = {
      ...entity,
      note: { path, anchor: "durchgang-" + entity.id },
      passage: {
        ...passage,
        direction: passage.direction ?? inferredDirection(room, entity, session),
      },
    };
    portalChanges.push({ id: entity.id, before: entity, after });
    portalSections.push(
      "## " + portalNames[entity.variant] + "\n\n" +
      passageBlock(after) + "\n^durchgang-" + entity.id + "\n",
    );
  }
  const text =
    '---\nroom_id: "' +
    room.id +
    '"\n---\n# ' +
    number +
    " " +
    name +
    "\n\n" +
    (mapPath ? "![[" + mapPath + "]]\n\n" : "") +
    portalSections.join("\n");
  session.loadNote(path, null);
  session.execute({
    label: "Bodenfläche als Raum anlegen",
    entities: [
      { id: current.id, before: current, after: room },
      ...portalChanges,
    ],
    texts: [{ path, offset: 0, before: "", after: text, create: true }],
    affectsRules: true,
  });
  return room;
}
export function createObject(
  session: Session,
  floorId: string,
  point: Point,
  settings: Pick<
    MapObject,
    "rotation" | "width" | "height" | "color" | "alpha" | "label" | "assetId"
  > = {
    rotation: 0,
    width: 1.6,
    height: 0.9,
    color: 0x795438,
    label: "",
  },
): MapObject {
  const room = [...session.entities.values()].find(
    (e) =>
      isRoom(e) &&
      e.floorId === floorId &&
      e.polygons.some(
        (polygon) =>
          inside(point, polygon.outer) &&
          !polygon.holes.some((hole) => inside(point, hole)),
      ),
  );
  const object: MapObject = {
    id: uid(),
    kind: "object",
    floorId,
    x: point.x,
    y: point.y,
    ...settings,
    ...(room ? { roomId: room.id } : {}),
  };
  session.execute({
    label: "Möbel platzieren",
    entities: [{ id: object.id, before: null, after: object }],
  });
  return object;
}
export interface ScatterSettings {
  object: Pick<
    MapObject,
    "rotation" | "width" | "height" | "color" | "alpha" | "label" | "assetId"
  >;
  spacing: number;
  spread: number;
  rotationJitter: number;
  scaleJitter: number;
  seed: number;
}
export function scatterObjects(
  session: Session,
  floorId: string,
  points: readonly Point[],
  settings: ScatterSettings,
): MapObject[] {
  if (
    !Number.isFinite(settings.spacing) ||
    settings.spacing <= 0 ||
    !Number.isFinite(settings.spread) ||
    settings.spread < 0 ||
    !Number.isFinite(settings.rotationJitter) ||
    settings.rotationJitter < 0 ||
    !Number.isFinite(settings.scaleJitter) ||
    settings.scaleJitter < 0 ||
    settings.scaleJitter >= 1
  )
    throw new Error("Ungültige Streueinstellungen.");
  let randomState = settings.seed >>> 0;
  const random = () => {
      randomState = (randomState * 1664525 + 1013904223) >>> 0;
      return randomState / 0x100000000;
    },
    samples: Point[] = [];
  if (points.length <= 1) samples.push(points[0] ?? { x: 0, y: 0 });
  else {
    let remaining = 0;
    for (let index = 0; index < points.length - 1; index++) {
      const a = points[index]!,
        b = points[index + 1]!,
        dx = b.x - a.x,
        dy = b.y - a.y,
        length = Math.hypot(dx, dy);
      for (
        let distance = remaining;
        distance <= length;
        distance += settings.spacing
      )
        samples.push({
          x: a.x + (dx * distance) / (length || 1),
          y: a.y + (dy * distance) / (length || 1),
        });
      remaining = (remaining - length) % settings.spacing;
      if (remaining < 0) remaining += settings.spacing;
    }
  }
  const rooms = [...session.entities.values()].filter(
      (entity): entity is Room => isRoom(entity) && entity.floorId === floorId,
    ),
    objects = samples.map((sample) => {
      const angle = random() * Math.PI * 2,
        distance = Math.sqrt(random()) * settings.spread,
        point = {
          x: sample.x + Math.cos(angle) * distance,
          y: sample.y + Math.sin(angle) * distance,
        },
        scale = 1 + (random() * 2 - 1) * settings.scaleJitter,
        room = rooms.find((candidate) =>
          candidate.polygons.some(
            (polygon) =>
              inside(point, polygon.outer) &&
              !polygon.holes.some((hole) => inside(point, hole)),
          ),
        );
      return {
        id: uid(),
        kind: "object" as const,
        floorId,
        x: point.x,
        y: point.y,
        ...settings.object,
        rotation:
          settings.object.rotation +
          (random() * 2 - 1) * settings.rotationJitter,
        width: settings.object.width * scale,
        height: settings.object.height * scale,
        ...(room ? { roomId: room.id } : {}),
      };
    });
  if (objects.length)
    session.execute({
      label: "Möbel streuen",
      entities: objects.map((object) => ({
        id: object.id,
        before: null,
        after: object,
      })),
    });
  return objects;
}
export function createLight(
  session: Session,
  floorId: string,
  point: Point,
  settings: Pick<
    Light,
    "radius" | "intensity" | "color" | "shadows" | "assetId"
  >,
): Light {
  const light: Light = {
    id: uid(),
    kind: "light",
    floorId,
    x: point.x,
    y: point.y,
    ...settings,
  };
  session.execute({
    label: "Licht platzieren",
    entities: [{ id: light.id, before: null, after: light }],
  });
  return light;
}
export function createWall(
  session: Session,
  floorId: string,
  points: readonly Point[],
  smooth = false,
  closed = false,
  width = 0.22,
  assetId?: string,
  layer = 700,
  shadow = true,
): Wall {
  const wall: Wall = {
    id: uid(),
    kind: "wall",
    floorId,
    points,
    smooth,
    closed,
    color: 0x403e39,
    width,
    layer,
    shadow,
    ...(assetId ? { assetId } : {}),
  };
  session.execute({
    label: "Wand anlegen",
    entities: [{ id: wall.id, before: null, after: wall }],
  });
  return wall;
}
export function createSurface(
  session: Session,
  floorId: string,
  category: Surface["category"],
  points: readonly Point[],
  settings: Pick<
    Surface,
    | "layer"
    | "color"
    | "wallColor"
    | "wallWidth"
    | "opacity"
    | "effect"
    | "material"
  >,
): Surface {
  const surface: Surface = {
    id: uid(),
    kind: "surface",
    floorId,
    category,
    polygons: [{ outer: points, holes: [] }],
    ...settings,
  };
  session.execute({
    label: "Fläche anlegen",
    entities: [{ id: surface.id, before: null, after: surface }],
  });
  return surface;
}
export function createBuilding(
  session: Session,
  floorId: string,
  polygons: readonly Polygon[],
  settings: Pick<
    Building,
    "layer" | "fill" | "wall" | "wallWidth" | "wallAssetId" | "material"
  >,
): Building {
  const building: Building = {
    id: uid(),
    kind: "building",
    floorId,
    polygons,
    ...settings,
  };
  session.execute({
    label: "Grundriss anlegen",
    entities: [{ id: building.id, before: null, after: building }],
  });
  return building;
}
export interface BuildingMutationRequest {
  readonly entities: readonly Entity[];
  readonly floorId: string;
  readonly result: ComposeBuildingResult;
  readonly expectedRevision: number;
  readonly currentRevision: number;
  readonly newBuilding?: Building;
}
export interface BuildingMutationPlan {
  readonly command: Command | null;
  readonly selectedId?: string;
}
const recordsEqual = (a: unknown, b: unknown): boolean =>
  a === b || JSON.stringify(a) === JSON.stringify(b);

/**
 * Turns a worker's geometry-only result into one complete history command.
 * Identity, room protection and every portal consequence stay on the main
 * model side; this function has no session or text side effects.
 */
export function planBuildingMutation(
  request: BuildingMutationRequest,
): BuildingMutationPlan {
  if (request.expectedRevision !== request.currentRevision)
    throw new Error(
      "Der Grundriss wurde inzwischen geändert. Zeichenschritt bitte wiederholen.",
    );
  const orderedBuildings = request.entities.filter(
      (entity): entity is Building =>
        entity.kind === "building" && entity.floorId === request.floorId,
    ),
    buildings = new Map(orderedBuildings.map((building) => [building.id, building])),
    doors = request.entities.filter(
      (entity): entity is Door => entity.kind === "door",
    ),
    changes: RecordChange<Entity>[] = [];
  const affected =
    request.result.mode === "draw"
      ? request.result.mergedIds
      : request.result.changes.map((change) => change.id);
  if (new Set(affected).size !== affected.length)
    throw new Error("Grundrissberechnung enthält doppelte Kennungen.");
  for (const id of affected) {
    const building = buildings.get(id);
    if (!building || building.locked)
      throw new Error("Ungültige oder gesperrte Grundrissquelle: " + id);
  }

  const reconcilePortals = (
    beforeById: ReadonlyMap<string, Building>,
    after: Building | null,
  ) => {
    for (const door of doors) {
      if (!door.anchor) continue;
      const before = beforeById.get(door.anchor.boundaryId);
      if (!before) continue;
      const next = after
        ? reanchorPortal(door, before, after, "survive")
        : null;
      if (!recordsEqual(door, next))
        changes.push({ id: door.id, before: door, after: next });
    }
  };

  if (request.result.mode === "draw") {
    if (!request.result.polygons.length) return { command: null };
    const mergedIds = new Set(request.result.mergedIds),
      merged = orderedBuildings.filter((building) => mergedIds.has(building.id)),
      rooms = merged.filter(isRoom);
    if (rooms.length > 1)
      throw new Error("Zwei nummerierte Räume dürfen nicht vereinigt werden.");
    const winner = rooms[0] ?? merged[0];
    let after: Building;
    if (winner) after = { ...winner, polygons: request.result.polygons };
    else {
      const fresh = request.newBuilding;
      if (
        !fresh ||
        fresh.kind !== "building" ||
        isRoom(fresh) ||
        fresh.floorId !== request.floorId ||
        request.entities.some((entity) => entity.id === fresh.id)
      )
        throw new Error("Neuer Grundriss besitzt keine eindeutige Kennung.");
      after = { ...fresh, polygons: request.result.polygons };
    }
    if (!winner || !recordsEqual(winner, after))
      changes.push({
        id: after.id,
        before: winner ?? null,
        after,
      });
    for (const source of merged)
      if (source.id !== after.id)
        changes.push({ id: source.id, before: source, after: null });
    reconcilePortals(new Map(merged.map((source) => [source.id, source])), after);
    return {
      command: changes.length
        ? { label: "Grundriss zeichnen", entities: changes }
        : null,
      selectedId: after.id,
    };
  }

  const geometryById = new Map(
      request.result.changes.map((change) => [change.id, change.polygons]),
    ),
    changed = orderedBuildings.filter((building) => geometryById.has(building.id));
  for (const before of changed) {
    const polygons = geometryById.get(before.id)!;
    if (!polygons.length && isRoom(before))
      throw new Error(
        "Ein nummerierter Raum kann nur über den Archivierungsablauf vollständig entfernt werden.",
      );
  }
  let selectedId: string | undefined;
  for (const before of changed) {
    const polygons = geometryById.get(before.id)!,
      after: Building | null = polygons.length
        ? { ...before, polygons }
        : null;
    if (!recordsEqual(before, after))
      changes.push({ id: before.id, before, after });
    reconcilePortals(new Map([[before.id, before]]), after);
    if (after) selectedId = after.id;
  }
  return {
    command: changes.length
      ? { label: "Grundriss ausradieren", entities: changes }
      : null,
    selectedId,
  };
}
export interface BuildingContourMutationRequest {
  readonly entities: readonly Entity[];
  readonly before: Building;
  readonly after: Building;
  readonly edit: BuildingContourEdit;
}
export function planBuildingContourMutation(
  request: BuildingContourMutationRequest,
): Command | null {
  const { before, after, edit } = request,
    current = request.entities.find((entity) => entity.id === before.id),
    { polygons: _beforePolygons, ...beforeMetadata } = before,
    { polygons: _afterPolygons, ...afterMetadata } = after,
    beforeContours = buildingContourEntries(before),
    afterContours = buildingContourEntries(after),
    beforeContour = beforeContours[edit.contour],
    afterContour = afterContours[edit.contour];
  if (
    before.locked ||
    before.id !== after.id ||
    before.floorId !== after.floorId ||
    !recordsEqual(current, before) ||
    !recordsEqual(beforeMetadata, afterMetadata) ||
    before.polygons.length !== after.polygons.length ||
    before.polygons.some(
      (polygon, index) =>
        polygon.holes.length !== after.polygons[index]?.holes.length,
    ) ||
    beforeContours.length !== afterContours.length ||
    !beforeContour ||
    !afterContour
  )
    throw new Error("Ungültige oder veraltete Gebäudekontur.");
  for (const entry of beforeContours)
    if (
      entry.contour !== edit.contour &&
      !recordsEqual(entry.points, afterContours[entry.contour]?.points)
    )
      throw new Error("Eine Punktbearbeitung darf nur eine Kontur ändern.");
  const beforePoints = beforeContour.points,
    afterPoints = afterContour.points,
    without = (points: readonly Point[], index: number) =>
      points.filter((_, candidate) => candidate !== index);
  if (
    !Number.isInteger(edit.index) ||
    (edit.kind === "move" &&
      (edit.index < 0 ||
        edit.index >= beforePoints.length ||
        beforePoints.length !== afterPoints.length ||
        !recordsEqual(without(beforePoints, edit.index), without(afterPoints, edit.index)))) ||
    (edit.kind === "insert" &&
      (edit.index < 1 ||
        edit.index > beforePoints.length ||
        afterPoints.length !== beforePoints.length + 1 ||
        !recordsEqual(beforePoints, without(afterPoints, edit.index)))) ||
    (edit.kind === "remove" &&
      (edit.index < 0 ||
        edit.index >= beforePoints.length ||
        beforePoints.length <= 3 ||
        afterPoints.length !== beforePoints.length - 1 ||
        !recordsEqual(without(beforePoints, edit.index), afterPoints)))
  )
    throw new Error("Ungültige Punktbearbeitung.");
  validatePolygons(after.polygons);
  assertBuildingTopology(after.polygons);
  if (recordsEqual(before, after)) return null;
  const changes: RecordChange<Entity>[] = [
    { id: before.id, before, after },
  ];
  for (const entity of request.entities) {
    if (
      entity.kind !== "door" ||
      entity.anchor?.boundaryId !== before.id
    )
      continue;
    const next = followPortalAfterContourEdit(entity, before, after, edit);
    if (!recordsEqual(entity, next))
      changes.push({ id: entity.id, before: entity, after: next });
  }
  return {
    label:
      edit.kind === "move"
        ? "Konturpunkt verschieben"
        : edit.kind === "insert"
          ? "Konturpunkt einfügen"
          : "Konturpunkt entfernen",
    entities: changes,
  };
}
export function createMapPath(
  session: Session,
  floorId: string,
  points: readonly Point[],
  settings: Omit<MapPath, "id" | "kind" | "floorId" | "points">,
): MapPath {
  const path: MapPath = {
    id: uid(),
    kind: "path",
    floorId,
    points,
    ...settings,
  };
  session.execute({
    label: "Pfad anlegen",
    entities: [{ id: path.id, before: null, after: path }],
  });
  return path;
}
export function createRoof(
  session: Session,
  floorId: string,
  points: readonly Point[],
  settings: Pick<
    Roof,
    "roofType" | "color" | "outlineColor" | "layer" | "material"
  >,
): Roof {
  const xs = points.map((point) => point.x),
    ys = points.map((point) => point.y),
    minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys),
    horizontal = maxX - minX >= maxY - minY,
    ridge =
      settings.roofType === "flat"
        ? []
        : horizontal
          ? [
              { x: minX + (maxX - minX) * 0.2, y: (minY + maxY) / 2 },
              { x: maxX - (maxX - minX) * 0.2, y: (minY + maxY) / 2 },
            ]
          : [
              { x: (minX + maxX) / 2, y: minY + (maxY - minY) * 0.2 },
              { x: (minX + maxX) / 2, y: maxY - (maxY - minY) * 0.2 },
            ];
  const roof: Roof = {
    id: uid(),
    kind: "roof",
    floorId,
    points,
    ridge,
    ...settings,
  };
  session.execute({
    label: "Dach anlegen",
    entities: [{ id: roof.id, before: null, after: roof }],
  });
  return roof;
}
export function addFloor(session: Session): Floor {
  let number = 1;
  const names = new Set([...session.floors.values()].map((f) => f.name));
  while (names.has("Geschoss " + number)) number++;
  const floor: Floor = {
    id: uid(),
    name: "Geschoss " + number,
    elevation:
      Math.max(...[...session.floors.values()].map((f) => f.elevation)) + 1,
    ambient: 1,
  };
  session.execute({
    label: "Geschoss anlegen",
    floors: [{ id: floor.id, before: null, after: floor }],
  });
  return floor;
}

export function duplicateFloor(session: Session, sourceId: string): Floor {
  const source = session.floors.get(sourceId);
  if (!source) throw new Error("Ausgangsgeschoss fehlt.");
  const entities = [...session.entities.values()].filter(
      (entity) => entity.floorId === sourceId,
    ),
    idMap = new Map(entities.map((entity) => [entity.id, uid()])),
    groupMap = new Map(
      entities
        .flatMap((entity) => (entity.groupId ? [entity.groupId] : []))
        .map((id) => [id, uid()]),
    ),
    floor: Floor = {
      ...source,
      id: uid(),
      name: source.name + " Kopie",
      elevation:
        Math.max(
          ...[...session.floors.values()].map((item) => item.elevation),
        ) + 1,
    },
    rooms = entities.filter(isRoom),
    noteMap = new Map(
      rooms.map((room) => [
        room.note.path,
        room.note.path.replace(/[^/]+\.md$/, idMap.get(room.id)! + ".md"),
      ]),
    ),
    copies = entities.map((entity): Entity => {
      const common = {
        id: idMap.get(entity.id)!,
        floorId: floor.id,
        groupId: entity.groupId ? groupMap.get(entity.groupId) : undefined,
        roomId: entity.roomId ? idMap.get(entity.roomId) : undefined,
      };
      if (isRoom(entity))
        return {
          ...entity,
          ...common,
          note: { path: noteMap.get(entity.note.path)! },
        };
      if (entity.kind === "door")
        return {
          ...entity,
          ...common,
          anchor: entity.anchor
            ? {
                ...entity.anchor,
                boundaryId: idMap.get(entity.anchor.boundaryId)!,
              }
            : undefined,
          note: entity.note
            ? {
                path: noteMap.get(entity.note.path) ?? entity.note.path,
                anchor: entity.note.anchor?.replace(
                  entity.id,
                  idMap.get(entity.id)!,
                ),
              }
            : undefined,
        };
      return { ...entity, ...common };
    }),
    texts = rooms.map((room) => {
      const before = session.note(room.note.path);
      if (before === undefined || before === null)
        throw new Error("Raum-Key zuerst laden: " + room.note.path);
      const path = noteMap.get(room.note.path)!;
      session.loadNote(path, null);
      let after = before.replace(
        'room_id: "' + room.id + '"',
        'room_id: "' + idMap.get(room.id)! + '"',
      );
      for (const door of entities.filter(
        (entity): entity is Door =>
          entity.kind === "door" && entity.note?.path === room.note.path,
      ))
        after = after.replaceAll(door.id, idMap.get(door.id)!);
      return { path, offset: 0, before: "", after, create: true as const };
    });
  session.execute({
    label: "Geschoss kopieren",
    floors: [{ id: floor.id, before: null, after: floor }],
    entities: copies.map((entity) => ({
      id: entity.id,
      before: null,
      after: entity,
    })),
    texts,
    affectsRules: true,
  });
  return floor;
}

export interface MapMargins {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export function resizeMap(
  session: Session,
  margins: MapMargins,
  appearance: Partial<
    Pick<Settings, "wallShadows" | "objectShadows" | "buildingWear">
  > = {},
): void {
  const values = [margins.left, margins.right, margins.top, margins.bottom];
  if (!values.every(Number.isInteger))
    throw new Error("Kartenränder müssen in ganzen Feldern angegeben werden.");
  const before = session.settings,
    width = before.width + margins.left + margins.right,
    height = before.height + margins.top + margins.bottom,
    after = { ...before, width, height, ...appearance };
  if (width <= 0 || height <= 0 || width > 10000 || height > 10000)
    throw new Error("Die neue Kartengröße ist ungültig.");
  const changes = [...session.entities.values()].flatMap((entity) => {
    const moved = moveEntity(entity, margins.left, margins.top);
    return moved === entity || JSON.stringify(moved) === JSON.stringify(entity)
      ? []
      : [{ id: entity.id, before: entity, after: moved }];
  });
  session.execute({
    label: "Karteneinstellungen ändern",
    settings: { before, after },
    entities: changes,
  });
}
export function createReferenceImage(
  session: Session,
  floorId: string,
  asset: string,
  name: string,
  pixelWidth: number,
  pixelHeight: number,
): ReferenceImage {
  if (
    !session.floors.has(floorId) ||
    !Number.isFinite(pixelWidth) ||
    !Number.isFinite(pixelHeight) ||
    pixelWidth <= 0 ||
    pixelHeight <= 0
  )
    throw new Error("Nachzeichenvorlage kann nicht angelegt werden.");
  const width = Math.min(session.settings.width * 0.8, 80),
    image: ReferenceImage = {
      id: uid(),
      kind: "reference",
      floorId,
      asset,
      name: name.trim() || "Nachzeichenvorlage",
      x: session.settings.width / 2,
      y: session.settings.height / 2,
      rotation: 0,
      width,
      height: width * (pixelHeight / pixelWidth),
      opacity: 0.45,
      visible: true,
    };
  session.execute({
    label: "Nachzeichenvorlage laden",
    entities: [{ id: image.id, before: null, after: image }],
  });
  return image;
}
export function createDoor(
  session: Session,
  room: Room,
  edge: number,
  t: number,
  variant: Door["variant"] = "door",
): Door {
  return createPortal(
    session,
    room.floorId,
    { boundary: room, anchor: edgeAt(room, edge, t) },
    {
      variant,
      width: 1,
      blocksLight:
        variant === "door" || variant === "window" || variant === "bars",
    },
  );
}
export interface PortalSettings {
  variant: Door["variant"];
  width: number;
  blocksLight: boolean;
  flip?: boolean;
  assetId?: string;
  passage?: PassageDetails;
}
const directionLabels: Record<CompassDirection, string> = {
  north: "Norden",
  northeast: "Nordosten",
  east: "Osten",
  southeast: "Südosten",
  south: "Süden",
  southwest: "Südwesten",
  west: "Westen",
  northwest: "Nordwesten",
};
function sentence(value: string): string {
  const trimmed = value.trim();
  return !trimmed || /[.!?]$/.test(trimmed) ? trimmed : trimmed + ".";
}
function inferredDirection(
  room: Room,
  door: Door,
  session: Session,
): CompassDirection {
  const pose = portalPose(door, (id) => session.entities.get(id)),
    points = room.polygons.flatMap((polygon) => polygon.outer),
    center = {
      x:
        points.reduce((sum, point) => sum + point.x, 0) /
        points.length,
      y:
        points.reduce((sum, point) => sum + point.y, 0) /
        points.length,
    },
    angle = Math.atan2(center.y - pose.y, pose.x - center.x),
    octant = Math.round(angle / (Math.PI / 4));
  return (
    [
      "east",
      "northeast",
      "north",
      "northwest",
      "west",
      "southwest",
      "south",
      "southeast",
    ] as const
  )[(octant + 8) % 8]!;
}
function passageText(door: Door): string {
  const passage = door.passage ?? {
      description: "",
      state: door.variant === "opening" ? "open" : "closed",
      hidden: false,
    },
    fallback = {
      door: "Tür",
      window: "Fenster",
      bars: "Gitter",
      opening: "Durchgang",
    }[door.variant],
    parts = [
      sentence(passage.description) || fallback + ".",
      { open: "Offen.", closed: "Geschlossen.", locked: "Verschlossen." }[
        passage.state
      ],
    ];
  if (passage.hidden)
    parts.push(
      passage.hiddenDC ? `Versteckt (SG ${passage.hiddenDC}).` : "Versteckt.",
    );
  if (passage.hp !== undefined || passage.ac !== undefined)
    parts.push(
      [
        passage.hp !== undefined ? `${passage.hp} HP` : "",
        passage.ac !== undefined ? `RK ${passage.ac}` : "",
      ]
        .filter(Boolean)
        .join(", ") + ".",
    );
  if (passage.key?.trim()) parts.push(`Schlüssel: ${sentence(passage.key)}`);
  const direction = passage.direction
    ? directionLabels[passage.direction]
    : "Unbestimmte Richtung";
  return `${direction}: ${parts.join(" ")}`;
}
function passageBlock(door: Door): string {
  return (
    `<!-- dungeon-passage:${door.id}:start -->\n` +
    passageText(door) +
    `\n<!-- dungeon-passage:${door.id}:end -->`
  );
}
function replacePassageBlock(current: string, door: Door): string {
  const start = `<!-- dungeon-passage:${door.id}:start -->`,
    end = `<!-- dungeon-passage:${door.id}:end -->`,
    startAt = current.indexOf(start),
    endAt = current.indexOf(end, startAt + start.length),
    block = passageBlock(door);
  if (startAt >= 0 && endAt >= 0)
    return (
      current.slice(0, startAt) + block + current.slice(endAt + end.length)
    );
  const anchor = `^durchgang-${door.id}`,
    anchorAt = current.indexOf(anchor);
  if (anchorAt < 0) throw new Error("Der Durchgangsanker fehlt im Raum-Key.");
  return current.slice(0, anchorAt) + block + "\n" + current.slice(anchorAt);
}
export function updatePassage(
  session: Session,
  id: string,
  passage: PassageDetails,
): Door {
  const before = session.entities.get(id);
  if (before?.kind !== "door") throw new Error("Durchgang nicht gefunden.");
  const after: Door = { ...before, passage };
  const current = before.note ? session.note(before.note.path) : undefined;
  if (before.note && (current === undefined || current === null))
    throw new Error("Raum-Key zuerst laden.");
  session.execute({
    label: "Durchgang bearbeiten",
    entities: [{ id, before, after }],
    ...(before.note
      ? {
          texts: [
            textPatch(
              before.note.path,
              current!,
              replacePassageBlock(current!, after),
            ),
          ],
        }
      : {}),
    affectsRules: true,
  });
  return after;
}
export function createPortal(
  session: Session,
  floorId: string,
  anchor:
    | {
        boundary: Boundary;
        anchor: { readonly contour: number; readonly at: number };
      }
    | { point: Point; rotation: number },
  settings: PortalSettings,
): Door {
  const id = uid(),
    room = "boundary" in anchor && isRoom(anchor.boundary)
      ? anchor.boundary
      : undefined,
    doorWithoutPassage: Door = {
      id,
      kind: "door",
      floorId,
      ...(room
        ? { note: { path: room.note.path, anchor: "durchgang-" + id } }
        : {}),
      ...("boundary" in anchor
        ? {
            anchor: {
              boundaryId: anchor.boundary.id,
              ...anchor.anchor,
            },
          }
        : { x: anchor.point.x, y: anchor.point.y, rotation: anchor.rotation }),
      ...settings,
    },
    passage: PassageDetails = {
      description: settings.passage?.description ?? "",
      state:
        settings.passage?.state ??
        (settings.variant === "opening" ? "open" : "closed"),
      hidden: settings.passage?.hidden ?? false,
      ...(settings.passage?.hiddenDC
        ? { hiddenDC: settings.passage.hiddenDC }
        : {}),
      ...(settings.passage?.hp ? { hp: settings.passage.hp } : {}),
      ...(settings.passage?.ac ? { ac: settings.passage.ac } : {}),
      ...(settings.passage?.key?.trim()
        ? { key: settings.passage.key.trim() }
        : {}),
      ...(settings.passage?.direction
        ? { direction: settings.passage.direction }
        : room
          ? { direction: inferredDirection(room, doorWithoutPassage, session) }
          : {}),
    },
    door: Door = { ...doorWithoutPassage, passage };
  const names = {
    door: "Tür",
    window: "Fenster",
    bars: "Gitter",
    opening: "Offener Durchgang",
  };
  const before = room ? session.note(room.note.path) : undefined;
  if (room && (before === undefined || before === null))
    throw new Error("Raum-Key zuerst laden.");
  const after = room
    ? before! +
      (before!.endsWith("\n") ? "" : "\n") +
      "## " +
      names[settings.variant] +
      "\n\n" +
      passageBlock(door) +
      "\n^durchgang-" +
      id +
      "\n"
    : undefined;
  session.execute({
    label: names[settings.variant] + " anlegen",
    entities: [{ id, before: null, after: door }],
    ...(room ? { texts: [textPatch(room.note.path, before!, after!)] } : {}),
    affectsRules: true,
  });
  return door;
}
export function editNote(
  session: Session,
  path: string,
  before: string,
  after: string,
): void {
  if (session.note(path) !== before)
    throw new Error("Der Raumtext wurde inzwischen geändert.");
  session.execute({
    label: "Raumtext bearbeiten",
    texts: [textPatch(path, before, after)],
    affectsRules: true,
  });
}
