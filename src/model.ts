export type Id = string;
export interface Point {
  readonly x: number;
  readonly y: number;
}
export interface NoteLink {
  readonly path: string;
  readonly anchor?: string;
}
export interface Floor {
  readonly id: Id;
  readonly name: string;
  readonly elevation: number;
  readonly ambient?: number;
}
interface BaseEntity {
  readonly id: Id;
  readonly floorId: Id;
  readonly locked?: boolean;
  readonly groupId?: Id;
  readonly prefabId?: Id;
  readonly roomId?: Id;
  readonly note?: NoteLink;
}
export interface Material {
  readonly asset?: string;
  readonly assetId?: Id;
  readonly assetPart?: string;
  readonly tileSize: number;
  readonly tint: number;
  readonly rotation: number;
}
export interface Polygon {
  readonly outer: readonly Point[];
  readonly holes: readonly (readonly Point[])[];
}
export interface Building extends BaseEntity {
  readonly kind: "building";
  readonly polygons: readonly Polygon[];
  readonly layer: number;
  readonly fill: number;
  readonly wall: number;
  readonly wallWidth: number;
  readonly wallAssetId?: Id;
  readonly material?: Material;
  readonly name?: string;
  readonly number?: string;
  readonly note?: NoteLink;
  readonly key?: RoomKey;
}
export interface MarkdownKeySection {
  readonly id: Id;
  readonly kind: "markdown";
  readonly markdown: string;
}
export interface PassageKeySection {
  readonly id: Id;
  readonly kind: "passage";
  readonly doorId: Id;
}
export type KeySection = MarkdownKeySection | PassageKeySection;
export interface RoomKey {
  readonly sections: readonly KeySection[];
  readonly nextFeatureOrdinal?: number;
}
export type RoomV3 = Building & {
  readonly name: string;
  readonly number: string;
  readonly note: NoteLink;
  readonly key?: never;
};
export type RoomV4 = Building & {
  readonly name: string;
  readonly number: string;
  readonly note?: never;
  readonly key: RoomKey;
};
export type Room = RoomV3 | RoomV4;
export function isRoom(entity: Entity | undefined): entity is Room {
  return (
    entity?.kind === "building" &&
    typeof entity.name === "string" &&
    typeof entity.number === "string" &&
    (entity.note !== undefined || entity.key !== undefined)
  );
}
export function isStructuredRoom(entity: Entity | undefined): entity is RoomV4 {
  return isRoom(entity) && entity.key !== undefined;
}
export interface Wall extends BaseEntity {
  readonly kind: "wall";
  readonly points: readonly Point[];
  readonly closed: boolean;
  readonly smooth: boolean;
  readonly color: number;
  readonly width: number;
  readonly layer?: number;
  readonly shadow?: boolean;
  readonly assetId?: Id;
}
export type CompassDirection =
  | "north"
  | "northeast"
  | "east"
  | "southeast"
  | "south"
  | "southwest"
  | "west"
  | "northwest";
export type PassageState = "open" | "closed" | "locked";
export interface PassageDetails {
  readonly direction?: CompassDirection;
  readonly description: string;
  readonly state: PassageState;
  readonly hidden: boolean;
  readonly hiddenDC?: number;
  readonly hp?: number;
  readonly ac?: number;
  readonly key?: string;
}
export interface Door extends BaseEntity {
  readonly kind: "door";
  readonly anchor?: BoundaryAnchor;
  readonly x?: number;
  readonly y?: number;
  readonly rotation?: number;
  readonly width: number;
  readonly variant: "door" | "window" | "bars" | "opening";
  readonly note?: NoteLink;
  readonly blocksLight?: boolean;
  readonly flip?: boolean;
  readonly assetId?: Id;
  readonly passage?: PassageDetails;
}
export interface BoundaryAnchor {
  readonly boundaryId: Id;
  readonly contour: number;
  readonly at: number;
}
export interface MapObject extends BaseEntity {
  readonly kind: "object";
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly width: number;
  readonly height: number;
  readonly color: number;
  readonly alpha?: number;
  readonly label: string;
  readonly layer?: number;
  readonly shadow?: boolean;
  readonly blocksLight?: boolean;
  readonly flip?: boolean;
  readonly assetId?: Id;
  readonly roomId?: Id;
  readonly note?: NoteLink;
}
export interface Surface extends BaseEntity {
  readonly kind: "surface";
  readonly category:
    | "cave"
    | "material"
    | "pattern"
    | "water"
    | "terrain";
  readonly polygons: readonly Polygon[];
  readonly layer: number;
  readonly color: number;
  readonly opacity?: number;
  readonly effect?: "none" | "ripples";
  readonly material?: Material;
  readonly wallColor: number;
  readonly wallWidth: number;
}
export interface MapPath extends BaseEntity {
  readonly kind: "path";
  readonly points: readonly Point[];
  readonly closed: boolean;
  readonly smooth: boolean;
  readonly width: number;
  readonly style: "road" | "rope" | "rail" | "stones" | "hedge";
  readonly color: number;
  readonly outlineColor: number;
  readonly outlineWidth: number;
  readonly layer: number;
  readonly start: "round" | "square" | "hidden";
  readonly end: "round" | "square" | "taper" | "hidden";
  readonly blocksLight: boolean;
  readonly material?: Material;
}
export interface Roof extends BaseEntity {
  readonly kind: "roof";
  readonly points: readonly Point[];
  readonly ridge: readonly Point[];
  readonly roofType: "gable" | "hip" | "dormer" | "flat";
  readonly color: number;
  readonly outlineColor: number;
  readonly layer: number;
  readonly material?: Material;
}
export interface Light extends BaseEntity {
  readonly kind: "light";
  readonly x: number;
  readonly y: number;
  readonly rotation?: number;
  readonly radius: number;
  readonly intensity: number;
  readonly color: number;
  readonly shadows: boolean;
  readonly assetId?: Id;
}
export interface ReferenceImage extends BaseEntity {
  readonly kind: "reference";
  readonly asset: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly width: number;
  readonly height: number;
  readonly opacity: number;
  readonly visible: boolean;
}
export type Boundary = Building | Wall;
export type Entity =
  | Building
  | Wall
  | Door
  | MapObject
  | Surface
  | MapPath
  | Roof
  | Light
  | ReferenceImage;
export interface Settings {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly feetPerField: 5;
  readonly assetPacks?: readonly string[];
  readonly builtInAssets?: boolean;
  readonly wallShadows: boolean;
  readonly objectShadows: boolean;
  readonly buildingWear: number;
}
export type FeatureKind = "feature" | "creature" | "loot" | "trap";
export interface FeatureDefinition {
  readonly id: Id;
  readonly name: string;
  readonly kind: FeatureKind;
  readonly xp: number;
  readonly lootValue: number;
  readonly encounter?: string;
  readonly description?: string;
  readonly reference?: string;
  readonly encounterLink?: string;
}
export interface FeatureOccurrence {
  readonly id: Id;
  readonly definitionId: Id;
  readonly roomId: Id;
  readonly entityId?: Id;
  readonly marker: string;
  readonly quantity: number;
  readonly note?: NoteLink;
  readonly sectionId?: Id;
  readonly situation?: string;
  readonly reaction?: string;
}
export interface DungeonRoute {
  readonly id: Id;
  readonly name: string;
  readonly entrance: boolean;
  readonly fromRoomId?: Id;
  readonly toRoomId: Id;
  readonly prerequisites: readonly string[];
  readonly bossGoalOrder?: number;
}
export interface ArchivedBundle {
  readonly id: Id;
  readonly label: string;
  readonly archivedAt: string;
  readonly floors: readonly Floor[];
  readonly floorPositions: readonly number[];
  readonly definitions: readonly FeatureDefinition[];
  readonly definitionPositions: readonly number[];
  readonly occurrences: readonly FeatureOccurrence[];
  readonly occurrencePositions: readonly number[];
  readonly routes: readonly DungeonRoute[];
  readonly routePositions: readonly number[];
  readonly entities: readonly Entity[];
  readonly entityPositions: readonly number[];
}
export interface DungeonContent {
  readonly definitions: readonly FeatureDefinition[];
  readonly occurrences: readonly FeatureOccurrence[];
  readonly routes: readonly DungeonRoute[];
  readonly archive: readonly ArchivedBundle[];
}
export interface MapDocument {
  readonly format: "dungeon-map";
  readonly version: 3 | 4;
  readonly id: Id;
  readonly settings: Settings;
  readonly floors: readonly Floor[];
  readonly entities: readonly Entity[];
  readonly content: DungeonContent;
}
export type MapDocumentV2 = Omit<MapDocument, "version"> & {
  readonly version: 2;
};
export const uid = (): Id => crypto.randomUUID();
export function newDocument(
  name: string,
  width: number,
  height: number,
  assets?: Pick<Settings, "assetPacks" | "builtInAssets">,
  appearance: Pick<
    Settings,
    "wallShadows" | "objectShadows" | "buildingWear"
  > = { wallShadows: true, objectShadows: true, buildingWear: 0 },
  version: 3 | 4 = 4,
): MapDocument {
  const result: MapDocument = {
    format: "dungeon-map",
    version,
    id: uid(),
    settings: {
      name,
      width,
      height,
      feetPerField: 5,
      ...assets,
      ...appearance,
    },
    floors: [{ id: uid(), name: "Erdgeschoss", elevation: 0 }],
    entities: [],
    content: { definitions: [], occurrences: [], routes: [], archive: [] },
  };
  validateDocument(result);
  return result;
}
export function safePath(path: string): string {
  if (
    !path ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.split("/").some((p) => !p || p === "." || p === "..") ||
    /[\x00-\x1f]/.test(path)
  )
    throw new Error("Ungültiger Vault-Pfad: " + path);
  return path;
}
export function validateSettings(s: Settings): void {
  if (
    !s ||
    typeof s.name !== "string" ||
    !s.name.trim() ||
    s.feetPerField !== 5 ||
    typeof s.wallShadows !== "boolean" ||
    typeof s.objectShadows !== "boolean" ||
    !Number.isFinite(s.buildingWear) ||
    s.buildingWear < 0 ||
    s.buildingWear > 1 ||
    ![s.width, s.height].every(
      (n) => Number.isFinite(n) && n > 0 && n <= 10000,
    ) ||
    (s.builtInAssets !== undefined && typeof s.builtInAssets !== "boolean") ||
    (s.assetPacks !== undefined &&
      (!Array.isArray(s.assetPacks) ||
        new Set(s.assetPacks).size !== s.assetPacks.length ||
        s.assetPacks.some((id) => typeof id !== "string" || !id)))
  )
    throw new Error("Ungültige Karteneinstellungen.");
}
export function validatePolygons(polygons: readonly Polygon[]): void {
  if (!Array.isArray(polygons) || !polygons.length)
    throw new Error("Ungültige Flächenkontur.");
  for (const polygon of polygons) {
    if (!Array.isArray(polygon.holes))
      throw new Error("Ungültige Innenkontur.");
    for (const ring of [polygon.outer, ...polygon.holes]) {
      if (
        !Array.isArray(ring) ||
        ring.length < 3 ||
        !ring.every((point) =>
          Number.isFinite(point.x) && Number.isFinite(point.y),
        )
      )
        throw new Error("Ungültige Flächenkontur.");
      const area = ring.reduce((sum, point, index) => {
        const next = ring[(index + 1) % ring.length]!;
        return sum + point.x * next.y - next.x * point.y;
      }, 0);
      if (Math.abs(area) < 0.0001)
        throw new Error("Die Kontur hat keine Fläche.");
    }
  }
}
export function validateEntity(
  e: Entity,
  floors: ReadonlyMap<Id, Floor>,
  get: (id: Id) => Entity | undefined,
  version: 3 | 4 = 3,
): void {
  if (!e || typeof e.id !== "string" || !e.id || !floors.has(e.floorId))
    throw new Error("Ungültige Objekt- oder Geschosskennung.");
  if (e.prefabId !== undefined &&
      (typeof e.prefabId !== "string" || !e.prefabId.trim()))
    throw new Error("Ungültige Vorlagenkennung.");
  if (e.kind === "building") {
    validatePolygons(e.polygons);
    const hasIdentity = e.name !== undefined || e.number !== undefined,
      isV3Room = e.note !== undefined,
      isV4Room = e.key !== undefined;
    if (
      !Number.isInteger(e.fill) ||
      !Number.isInteger(e.wall) ||
      !Number.isFinite(e.wallWidth) ||
      e.wallWidth < 0 ||
      !Number.isFinite(e.layer) ||
      (hasIdentity !== (isV3Room || isV4Room)) ||
      (hasIdentity &&
        (typeof e.name !== "string" || typeof e.number !== "string")) ||
      (isV3Room && isV4Room) ||
      (isV3Room && version !== 3) ||
      (isV4Room && version !== 4)
    )
      throw new Error("Ungültige Gebäudedaten.");
    if (isV4Room) {
      if (!Array.isArray(e.key!.sections) ||
          (e.key!.nextFeatureOrdinal !== undefined &&
            (!Number.isInteger(e.key!.nextFeatureOrdinal) || e.key!.nextFeatureOrdinal < 1)) ||
          new Set(e.key!.sections.map((section) => section.id)).size !== e.key!.sections.length)
        throw new Error("Ungültige Raumabschnitte.");
      for (const section of e.key!.sections) {
        if (!section.id ||
            (section.kind === "markdown"
              ? typeof section.markdown !== "string"
              : section.kind === "passage"
                ? typeof section.doorId !== "string" || !section.doorId
                : true))
          throw new Error("Ungültiger Raumabschnitt.");
      }
    }
  } else if (e.kind === "wall") {
    if (
      !Array.isArray(e.points) ||
      e.points.length < (e.closed ? 3 : 2) ||
      !e.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)) ||
      typeof e.closed !== "boolean" ||
      typeof e.smooth !== "boolean" ||
      !Number.isFinite(e.width) ||
      e.width <= 0 ||
      !Number.isInteger(e.color) ||
      (e.layer !== undefined && !Number.isFinite(e.layer)) ||
      (e.shadow !== undefined && typeof e.shadow !== "boolean")
    )
      throw new Error("Ungültige Wandkontur.");
  } else if (e.kind === "door") {
    const boundary = e.anchor ? get(e.anchor.boundaryId) : undefined,
      contours =
        boundary?.kind === "building"
          ? boundary.polygons.flatMap((polygon) => [polygon.outer, ...polygon.holes])
          : boundary?.kind === "wall"
            ? [boundary.points]
            : [],
      bound = boundary?.kind === "building" || boundary?.kind === "wall";
    const freestanding =
      !e.anchor &&
      [e.x, e.y, e.rotation].every((value) => Number.isFinite(value));
    if (
      bound === freestanding ||
      (bound && boundary.floorId !== e.floorId) ||
      (bound &&
        (!Number.isInteger(e.anchor?.contour) ||
          e.anchor!.contour < 0 ||
          e.anchor!.contour >= contours.length ||
          !Number.isFinite(e.anchor?.at) ||
          e.anchor!.at < 0 ||
          e.anchor!.at > 1)) ||
      !Number.isFinite(e.width) ||
      e.width <= 0 ||
      !["door", "window", "bars", "opening"].includes(e.variant) ||
      (e.passage !== undefined &&
        (typeof e.passage.description !== "string" ||
          !["open", "closed", "locked"].includes(e.passage.state) ||
          typeof e.passage.hidden !== "boolean" ||
          (e.passage.direction !== undefined &&
            ![
              "north",
              "northeast",
              "east",
              "southeast",
              "south",
              "southwest",
              "west",
              "northwest",
            ].includes(e.passage.direction)) ||
          [e.passage.hiddenDC, e.passage.hp, e.passage.ac].some(
            (value) =>
              value !== undefined && (!Number.isInteger(value) || value <= 0),
          ) ||
          (e.passage.key !== undefined && typeof e.passage.key !== "string")))
    )
      throw new Error("Ungültige Wandbindung.");
  } else if (e.kind === "object") {
    if (
      ![e.x, e.y, e.rotation, e.width, e.height].every(Number.isFinite) ||
      e.width <= 0 ||
      e.height <= 0 ||
      typeof e.label !== "string" ||
      !Number.isInteger(e.color) ||
      (e.alpha !== undefined &&
        (!Number.isInteger(e.alpha) || e.alpha < 0 || e.alpha > 255)) ||
      (e.layer !== undefined && !Number.isFinite(e.layer)) ||
      (e.shadow !== undefined && typeof e.shadow !== "boolean") ||
      (e.blocksLight !== undefined && typeof e.blocksLight !== "boolean") ||
      (e.flip !== undefined && typeof e.flip !== "boolean") ||
      (e.assetId !== undefined &&
        (typeof e.assetId !== "string" || !e.assetId.startsWith("pack:")))
    )
      throw new Error("Ungültiges Kartenobjekt.");
    if (e.roomId) {
      const r = get(e.roomId);
      if (!isRoom(r) || r.floorId !== e.floorId)
        throw new Error("Ungültige Raumzuordnung.");
    }
  } else if (e.kind === "surface") {
    if (
      !["cave", "material", "pattern", "water", "terrain"].includes(
        e.category,
      ) ||
      !Array.isArray(e.polygons) ||
      !e.polygons.length ||
      !Number.isFinite(e.layer) ||
      !Number.isInteger(e.color) ||
      !Number.isInteger(e.wallColor) ||
      !Number.isFinite(e.wallWidth) ||
      e.wallWidth < 0 ||
      (e.opacity !== undefined &&
        (!Number.isFinite(e.opacity) || e.opacity < 0 || e.opacity > 1)) ||
      (e.effect !== undefined && !["none", "ripples"].includes(e.effect))
    )
      throw new Error("Ungültige Fläche.");
    validatePolygons(e.polygons);
  } else if (e.kind === "path") {
    if (
      !Array.isArray(e.points) ||
      e.points.length < (e.closed ? 3 : 2) ||
      !e.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)) ||
      typeof e.closed !== "boolean" ||
      typeof e.smooth !== "boolean" ||
      !Number.isFinite(e.width) ||
      e.width <= 0 ||
      !["road", "rope", "rail", "stones", "hedge"].includes(e.style) ||
      !Number.isInteger(e.color) ||
      !Number.isInteger(e.outlineColor) ||
      !Number.isFinite(e.outlineWidth) ||
      e.outlineWidth < 0 ||
      !Number.isFinite(e.layer) ||
      !["round", "square", "hidden"].includes(e.start) ||
      !["round", "square", "taper", "hidden"].includes(e.end) ||
      typeof e.blocksLight !== "boolean"
    )
      throw new Error("Ungültiger Texturpfad.");
  } else if (e.kind === "roof") {
    if (
      !Array.isArray(e.points) ||
      e.points.length < 3 ||
      !e.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)) ||
      !Array.isArray(e.ridge) ||
      !e.ridge.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)) ||
      (e.roofType !== "flat" && e.ridge.length < 2) ||
      !["gable", "hip", "dormer", "flat"].includes(e.roofType) ||
      !Number.isInteger(e.color) ||
      !Number.isInteger(e.outlineColor) ||
      !Number.isFinite(e.layer)
    )
      throw new Error("Ungültiges Dach.");
  } else if (e.kind === "light") {
    if (
      ![e.x, e.y, e.radius, e.intensity].every(Number.isFinite) ||
      (e.rotation !== undefined && !Number.isFinite(e.rotation)) ||
      e.radius <= 0 ||
      e.intensity < 0 ||
      e.intensity > 4 ||
      !Number.isInteger(e.color) ||
      typeof e.shadows !== "boolean"
    )
      throw new Error("Ungültige Lichtquelle.");
  } else if (e.kind === "reference") {
    if (
      typeof e.name !== "string" ||
      !e.name.trim() ||
      ![e.x, e.y, e.rotation, e.width, e.height, e.opacity].every(
        Number.isFinite,
      ) ||
      e.width <= 0 ||
      e.height <= 0 ||
      e.opacity < 0 ||
      e.opacity > 1 ||
      typeof e.visible !== "boolean"
    )
      throw new Error("Ungültige Nachzeichenvorlage.");
    safePath(e.asset);
  } else throw new Error("Unbekannter Objekttyp.");
  const packageAsset =
    e.kind === "building"
      ? e.wallAssetId
      : e.kind === "wall" || e.kind === "door" || e.kind === "light"
        ? e.assetId
        : undefined;
  if (
    packageAsset !== undefined &&
    (typeof packageAsset !== "string" || !packageAsset.startsWith("pack:"))
  )
    throw new Error("Ungültiges Paketasset.");
  if (
    (e.kind === "building" ||
      e.kind === "surface" ||
      e.kind === "path" ||
      e.kind === "roof") &&
    e.material
  ) {
    const m = e.material;
    if (!!m.asset === !!m.assetId)
      throw new Error("Ein Material benötigt genau eine Bildquelle.");
    if (m.asset) safePath(m.asset);
    if (
      m.assetId !== undefined &&
      (typeof m.assetId !== "string" || !m.assetId.startsWith("pack:"))
    )
      throw new Error("Ungültiges Paketasset.");
    if (m.assetPart !== undefined && !/^[a-z]+$/.test(m.assetPart))
      throw new Error("Ungültiger Assetbestandteil.");
    if (
      !Number.isFinite(m.tileSize) ||
      m.tileSize <= 0 ||
      !Number.isFinite(m.rotation) ||
      !Number.isInteger(m.tint)
    )
      throw new Error("Ungültiges Material.");
  }
  if (e.note) {
    safePath(e.note.path);
    if (!e.note.path.endsWith(".md"))
      throw new Error("Der Raum-Key muss eine Markdown-Datei sein.");
  }
}
export function validateDocument(doc: MapDocument): void {
  if (
    !doc ||
    doc.format !== "dungeon-map" ||
    (doc.version !== 3 && doc.version !== 4) ||
    typeof doc.id !== "string" ||
    !doc.id
  )
    throw new Error("Nicht unterstütztes Kartenformat.");
  validateSettings(doc.settings);
  if (
    !Array.isArray(doc.floors) ||
    !doc.floors.length ||
    !Array.isArray(doc.entities)
  )
    throw new Error("Geschosse oder Objekte fehlen.");
  const floors = new Map(doc.floors.map((f) => [f.id, f]));
  const entities = new Map(doc.entities.map((e) => [e.id, e]));
  if (
    floors.size !== doc.floors.length ||
    entities.size !== doc.entities.length
  )
    throw new Error("Doppelte Kennung.");
  for (const f of floors.values()) validateFloor(f);
  for (const e of entities.values())
    validateEntity(e, floors, (id) => entities.get(id), doc.version);
  validateContent(doc.content, entities, doc.version);
}
export function validateContent(
  content: DungeonContent,
  entities: ReadonlyMap<Id, Entity>,
  version: 3 | 4 = 3,
): void {
  if (
    !content ||
    !Array.isArray(content.definitions) ||
    !Array.isArray(content.occurrences) ||
    !Array.isArray(content.routes) ||
    !Array.isArray(content.archive)
  )
    throw new Error("Dungeon-Inhalte fehlen.");
  const definitions = new Map(
      content.definitions.map((value) => [value.id, value]),
    ),
    occurrences = new Map(
      content.occurrences.map((value) => [value.id, value]),
    ),
    routes = new Map(content.routes.map((value) => [value.id, value]));
  if (
    definitions.size !== content.definitions.length ||
    occurrences.size !== content.occurrences.length ||
    routes.size !== content.routes.length ||
    new Set(content.archive.map((value) => value.id)).size !==
      content.archive.length
  )
    throw new Error("Doppelte Inhaltskennung.");
  for (const definition of definitions.values()) {
    if (
      !definition.id ||
      typeof definition.name !== "string" ||
      !definition.name.trim() ||
      !["feature", "creature", "loot", "trap"].includes(definition.kind) ||
      ![definition.xp, definition.lootValue].every(
        (value) => Number.isFinite(value) && value >= 0,
      ) ||
      (definition.encounter !== undefined &&
        (typeof definition.encounter !== "string" ||
          !definition.encounter.trim())) ||
      [
        definition.description,
        definition.reference,
        definition.encounterLink,
      ].some(
        (value) =>
          value !== undefined && (typeof value !== "string" || !value.trim()),
      )
    )
      throw new Error("Ungültige Feature-Definition.");
  }
  for (const occurrence of occurrences.values()) {
    const room = entities.get(occurrence.roomId),
      entity = occurrence.entityId
        ? entities.get(occurrence.entityId)
        : undefined;
    if (
      !occurrence.id ||
      !definitions.has(occurrence.definitionId) ||
      !isRoom(room) ||
      (occurrence.entityId !== undefined && !entity) ||
      (entity && entity.floorId !== room.floorId) ||
      typeof occurrence.marker !== "string" ||
      !occurrence.marker.trim() ||
      !Number.isInteger(occurrence.quantity) ||
      occurrence.quantity <= 0 ||
      [occurrence.situation, occurrence.reaction].some(
        (value) =>
          value !== undefined && (typeof value !== "string" || !value.trim()),
      ) ||
      (version === 3
        ? !occurrence.note || occurrence.note.path !== room.note?.path ||
          occurrence.sectionId !== undefined
        : !isStructuredRoom(room) || occurrence.note !== undefined ||
          !occurrence.sectionId ||
          (entity && (entity.kind !== "object" || entity.roomId !== room.id)) ||
          !room.key.sections.some((section) =>
            section.kind === "markdown" && section.id === occurrence.sectionId))
    )
      throw new Error("Ungültiges Feature-Vorkommen.");
    if (version === 3 && occurrence.note) {
      safePath(occurrence.note.path);
      if (!occurrence.note.path.endsWith(".md") ||
          typeof occurrence.note.anchor !== "string" ||
          !occurrence.note.anchor.trim())
        throw new Error("Ungültiger Feature-Verweis.");
    }
  }
  if (version === 4) {
    const linked = content.occurrences.map((item) => item.entityId).filter(Boolean);
    if (new Set(linked).size !== linked.length)
      throw new Error("Ein Kartenobjekt ist mehrfach mit Features verknüpft.");
    const archivedDoors = new Map<Id, Door>();
    for (const bundle of content.archive)
      for (const entity of bundle.entities)
        if (entity.kind === "door") archivedDoors.set(entity.id, entity);
    for (const room of entities.values()) {
      if (!isStructuredRoom(room)) continue;
      for (const section of room.key.sections) {
        if (section.kind !== "passage") continue;
        const door = entities.get(section.doorId) ?? archivedDoors.get(section.doorId);
        if (door?.kind !== "door" || door.anchor?.boundaryId !== room.id)
          throw new Error("Durchgang des Raum-Keys fehlt.");
      }
    }
  }
  const goalOrders = new Set<number>();
  for (const route of routes.values()) {
    const from = route.fromRoomId ? entities.get(route.fromRoomId) : undefined,
      to = entities.get(route.toRoomId);
    if (
      !route.id ||
      typeof route.name !== "string" ||
      !route.name.trim() ||
      typeof route.entrance !== "boolean" ||
      !isRoom(to) ||
      (!route.entrance && !isRoom(from)) ||
      (route.fromRoomId !== undefined && !isRoom(from)) ||
      route.fromRoomId === route.toRoomId ||
      !Array.isArray(route.prerequisites) ||
      route.prerequisites.some(
        (value: unknown) => typeof value !== "string" || !value.trim(),
      ) ||
      new Set(route.prerequisites).size !== route.prerequisites.length ||
      (route.bossGoalOrder !== undefined &&
        (!Number.isInteger(route.bossGoalOrder) || route.bossGoalOrder <= 0))
    )
      throw new Error("Ungültiger Eingang oder Weg.");
    if (route.bossGoalOrder !== undefined) {
      if (goalOrders.has(route.bossGoalOrder))
        throw new Error("Bossziel-Reihenfolge ist nicht eindeutig.");
      goalOrders.add(route.bossGoalOrder);
    }
  }
  for (const bundle of content.archive) {
    if (
      !bundle.id ||
      typeof bundle.label !== "string" ||
      !bundle.label.trim() ||
      typeof bundle.archivedAt !== "string" ||
      !Number.isFinite(Date.parse(bundle.archivedAt)) ||
      !Array.isArray(bundle.floors) ||
      !Array.isArray(bundle.floorPositions) ||
      !Array.isArray(bundle.definitions) ||
      !Array.isArray(bundle.definitionPositions) ||
      !Array.isArray(bundle.occurrences) ||
      !Array.isArray(bundle.occurrencePositions) ||
      !Array.isArray(bundle.routes) ||
      !Array.isArray(bundle.routePositions) ||
      !Array.isArray(bundle.entities) ||
      !Array.isArray(bundle.entityPositions) ||
      bundle.floorPositions.length !== bundle.floors.length ||
      bundle.definitionPositions.length !== bundle.definitions.length ||
      bundle.occurrencePositions.length !== bundle.occurrences.length ||
      bundle.routePositions.length !== bundle.routes.length ||
      bundle.entityPositions.length !== bundle.entities.length ||
      [
        ...bundle.floorPositions,
        ...bundle.definitionPositions,
        ...bundle.occurrencePositions,
        ...bundle.routePositions,
        ...bundle.entityPositions,
      ].some((position) => !Number.isInteger(position) || position < 0)
    )
      throw new Error("Ungültiger Archiveintrag.");
  }
}
export function validateFloor(f: Floor): void {
  if (
    !f.id ||
    typeof f.name !== "string" ||
    !f.name.trim() ||
    !Number.isFinite(f.elevation) ||
    (f.ambient !== undefined &&
      (!Number.isFinite(f.ambient) || f.ambient < 0 || f.ambient > 1))
  )
    throw new Error("Ungültiges Geschoss.");
}
export function parseDocument(raw: string): MapDocument {
  const source = JSON.parse(raw) as MapDocument | MapDocumentV2;
  const doc: MapDocument = source.version === 2
    ? { ...source, version: 3 }
    : source as MapDocument;
  validateDocument(doc);
  return doc;
}
export function serializeDocument(doc: MapDocument): string {
  return JSON.stringify(doc, null, 2) + "\n";
}
export function immutable<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) immutable(v);
  }
  return value;
}
