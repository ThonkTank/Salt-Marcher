import type { Transform } from "./generated/Transform";
export type { Transform } from "./generated/Transform";
export type { GridPose } from "./generated/GridPose";
export type { Placement } from "./generated/Placement";
export type { Side } from "./generated/Side";
export type { ParcelSource } from "./generated/ParcelSource";
export type { RoadSection } from "./generated/RoadSection";
export type { EditorContext } from "./generated/EditorContext";
export type { OwnerState } from "./generated/OwnerState";
export type { Version } from "./generated/Version";
export type { Status } from "./generated/Status";
export type { CascadeCounts } from "./generated/CascadeCounts";
export type { GenerationLimit } from "./generated/GenerationLimit";
export type { GenerationSummary } from "./generated/GenerationSummary";
import type { Node as WireNode } from "./generated/Node";
import type { PopulationRecipe as WirePopulationRecipe } from "./generated/PopulationRecipe";
import type { PopulationSettings as WirePopulationSettings } from "./generated/PopulationSettings";
import type { SceneObject as WireSceneObject } from "./generated/SceneObject";
import type { SceneResponse as WireSceneResponse } from "./generated/SceneResponse";
import type { InteriorMetadataResponse as WireInteriorMetadataResponse } from "./generated/InteriorMetadataResponse";
import type { InteriorTileResponse as WireInteriorTileResponse } from "./generated/InteriorTileResponse";
import type { NodeInput as WireNodeInput } from "./generated/NodeInput";
import type { ExistingNodeInput as WireExistingNodeInput } from "./generated/ExistingNodeInput";
import type { NewRoadInput as WireNewRoadInput } from "./generated/NewRoadInput";
import type { RoadEditInput as WireRoadEditInput } from "./generated/RoadEditInput";
import type { AreaInput as WireAreaInput } from "./generated/AreaInput";
import type { Intent as WireIntent } from "./generated/Intent";
import type { ValidPreviewWire as WireValidPreviewWire } from "./generated/ValidPreviewWire";
import type { InvalidPreviewWire as WireInvalidPreviewWire } from "./generated/InvalidPreviewWire";
import type { GenerationDiagnostic as WireGenerationDiagnostic } from "./generated/GenerationDiagnostic";

import type {
  Cell,
  Connection,
  Point as CoordinatePoint,
} from "../interiorContract";
export type { Connection } from "../interiorContract";
// Coordinate spaces and author-input exclusions are local UI constraints.
type Point<Space extends string> = CoordinatePoint & {
  readonly coordinateSpace?: Space;
};
export type ScreenPoint = Point<"screen">;
export type WorldPoint = Point<"world">;
export type LocalPoint = Point<"local">;
export type Bounds = WireInteriorTileResponse["bounds"];
export type Node = Omit<WireNode, "point" | "incoming" | "outgoing"> & {
  point: WorldPoint;
  incoming: WorldPoint | null;
  outgoing: WorldPoint | null;
};
export type PopulationSettings = WirePopulationSettings;
export type PopulationRecipe = WirePopulationRecipe;
export type House = Omit<
  Extract<WireSceneObject, { kind: "house" }>,
  "contours" | "occupancyContours"
> & {
  contours: LocalPoint[][];
  occupancyContours: LocalPoint[][];
};
export type Road = Omit<
  Extract<WireSceneObject, { kind: "road" }>,
  "nodes" | "path" | "populationRecipe"
> & {
  nodes: Node[];
  path: WorldPoint[];
  populationRecipe: PopulationRecipe | null;
};
export type Area = Omit<
  Extract<WireSceneObject, { kind: "area" }>,
  "points"
> & { points: WorldPoint[] };
export type Parcel = Omit<
  Extract<WireSceneObject, { kind: "parcel" }>,
  "polygon"
> & { polygon: WorldPoint[] };
export type MapObject =
  House | Road | Area | Parcel | Extract<WireSceneObject, { kind: "scenery" }>;
export type Scene = Omit<WireSceneResponse, "objects"> & {
  objects: MapObject[];
};
export type InteriorMetadata = WireInteriorMetadataResponse;
export type DetailTile = WireInteriorTileResponse;
// A loaded UI view assembles the separately fetched tile and metadata responses.
export type Detail = DetailTile &
  Pick<InteriorMetadata, "rooms" | "connections">;
export type CurveNodeInput = Omit<
  WireNodeInput,
  "point" | "incoming" | "outgoing"
> & {
  point: WorldPoint;
  incoming: WorldPoint | null;
  outgoing: WorldPoint | null;
  id?: never;
};
export type ExistingNodeInput = WireExistingNodeInput &
  Omit<CurveNodeInput, "id">;
export type RoadProperties = Pick<
  WireNewRoadInput,
  "name" | "width" | "material"
>;
type InputOnly = {
  id?: never;
  kind?: never;
  path?: never;
  sections?: never;
  edgeSections?: never;
  populationRecipe?: never;
};
export type NewRoadInput = Omit<WireNewRoadInput, "nodes"> &
  RoadProperties &
  InputOnly & { nodes: CurveNodeInput[] };
export type RoadEditInput = Omit<WireRoadEditInput, "nodes"> &
  RoadProperties &
  InputOnly & { nodes: ExistingNodeInput[] };
export type AreaInput = Omit<WireAreaInput, "points"> & {
  points: WorldPoint[];
  id?: never;
  kind?: never;
  order?: never;
};
type RefineIntent<T> = T extends { type: "createRoad" }
  ? Omit<T, "road" | "population"> & {
      road: NewRoadInput;
      population: PopulationSettings | null;
    }
  : T extends { type: "updateRoad" }
    ? Omit<T, "road"> & { road: RoadEditInput }
    : T extends { type: "createArea" | "updateArea" }
      ? Omit<T, "area"> & { area: AreaInput }
      : T extends { type: "extendRoad" }
        ? Omit<T, "nodes" | "endpointHandle" | "population"> & {
            nodes: CurveNodeInput[];
            endpointHandle: WorldPoint | null;
            population: PopulationSettings | null;
          }
        : T;
export type Intent = RefineIntent<WireIntent>;
export type ValidPreview = Omit<
  WireValidPreviewWire,
  "objects" | "generationDiagnostics"
> & {
  objects: MapObject[];
  generationDiagnostics: GenerationDiagnostic[];
  reason?: never;
};
export type PreviewIssue = import("./generated/DomainIssue").DomainIssue;
export type Preview =
  | ValidPreview
  | (Omit<
      WireInvalidPreviewWire,
      "proposedObjects" | "generationDiagnostics"
    > & {
      proposedObjects: MapObject[];
      generationDiagnostics: GenerationDiagnostic[];
      status?: never;
      removedConnections?: never;
    });
type RefineDiagnostic<T> = T extends { point: CoordinatePoint }
  ? Omit<T, "point"> & { point: WorldPoint }
  : T;
export type GenerationDiagnostic = RefineDiagnostic<WireGenerationDiagnostic>;

export const defaultPopulation: PopulationSettings = {
  side: "both",
  setback: 5,
  gap: 10,
  minWidth: 4,
  maxWidth: 7,
  minDepth: 4,
  maxDepth: 8,
  seed: 1,
  parcelDepth: null,
};
export type Camera = { x: number; y: number; scale: number };
export function toWorld(p: LocalPoint, t: Transform): WorldPoint {
  const c = Math.cos(t.angle),
    s = Math.sin(t.angle);
  return [t.x + 5 * (p[0] * c - p[1] * s), t.y + 5 * (p[0] * s + p[1] * c)];
}
export function toLocal(p: WorldPoint, t: Transform): LocalPoint {
  const c = Math.cos(t.angle),
    s = Math.sin(t.angle),
    x = p[0] - t.x,
    y = p[1] - t.y;
  return [(x * c + y * s) / 5, (-x * s + y * c) / 5];
}
export const distance = (a: [number, number], b: [number, number]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1]);
export function segmentDistance(p: WorldPoint, a: WorldPoint, b: WorldPoint) {
  const x = b[0] - a[0],
    y = b[1] - a[1],
    d = x * x + y * y,
    t = d
      ? Math.max(0, Math.min(1, ((p[0] - a[0]) * x + (p[1] - a[1]) * y) / d))
      : 0;
  return distance(p, [a[0] + t * x, a[1] + t * y]);
}
export function contains(rings: [number, number][][], p: [number, number]) {
  let hit = false;
  for (const r of rings)
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const a = r[i],
        b = r[j];
      if (
        a[1] > p[1] !== b[1] > p[1] &&
        p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
      )
        hit = !hit;
    }
  return hit;
}
export function hitObject(o: MapObject, p: WorldPoint, tolerance = 0) {
  if (o.kind === "house") return contains(o.contours, toLocal(p, o.transform));
  if (o.kind === "scenery")
    return o.assets.some((a) => distance(a.point, p) <= a.size + tolerance);
  if (o.kind === "area") return contains([o.points], p);
  if (o.kind === "parcel") return contains([o.polygon], p);
  return o.path
    .slice(1)
    .some(
      (q, i) => segmentDistance(p, o.path[i], q) <= o.width / 2 + tolerance,
    );
}
export function rectangle(a: LocalPoint, b: LocalPoint): [number, number][] {
  const x = Math.min(a[0], b[0]),
    y = Math.min(a[1], b[1]),
    w = Math.abs(a[0] - b[0]) + 1,
    h = Math.abs(a[1] - b[1]) + 1;
  if (w * h > 100000) throw Error("Maximal 100.000 Zellen pro Aktion");
  return Array.from({ length: w * h }, (_, i) => [
    x + (i % w),
    y + Math.floor(i / w),
  ]);
}
export function bezier(
  a: WorldPoint,
  b: WorldPoint,
  c: WorldPoint,
  d: WorldPoint,
  t: number,
): WorldPoint {
  const u = 1 - t;
  return [
    u * u * u * a[0] +
      3 * u * u * t * b[0] +
      3 * u * t * t * c[0] +
      t * t * t * d[0],
    u * u * u * a[1] +
      3 * u * u * t * b[1] +
      3 * u * t * t * c[1] +
      t * t * t * d[1],
  ];
}
// Integer, inclusive bounds covering every visible local cell, with one-cell halo.
export function interiorBounds(b: Bounds, t: Transform): Bounds {
  const points = (
    [
      [b[0], b[1]],
      [b[2], b[1]],
      [b[2], b[3]],
      [b[0], b[3]],
    ] as WorldPoint[]
  ).map((p) => toLocal(p, t));
  return [
    Math.floor(Math.min(...points.map((p) => p[0]))) - 1,
    Math.floor(Math.min(...points.map((p) => p[1]))) - 1,
    Math.ceil(Math.max(...points.map((p) => p[0]))) + 1,
    Math.ceil(Math.max(...points.map((p) => p[1]))) + 1,
  ];
}
export const INTERIOR_TILE_SIZE = 128;
const INTERIOR_QUERY_LIMIT = 1_000_001;
export type InteriorTile = {
  x: number;
  y: number;
  core: Bounds;
  sqlHalo: Bounds;
};
export const interiorTileCoordinate = (cell: number) =>
  Math.floor(cell / INTERIOR_TILE_SIZE);

// Core bounds are sent to Rust; SQL expands them by one cell on each side.
// Clamp at the backend request limit, including when the view lies beyond it.
export function interiorTiles(b: Bounds): InteriorTile[] {
  const clamp = (n: number) =>
    Math.max(-INTERIOR_QUERY_LIMIT, Math.min(INTERIOR_QUERY_LIMIT, n));
  const tiles: InteriorTile[] = [];
  for (
    let y = interiorTileCoordinate(clamp(b[1]));
    y <= interiorTileCoordinate(clamp(b[3]));
    y++
  )
    for (
      let x = interiorTileCoordinate(clamp(b[0]));
      x <= interiorTileCoordinate(clamp(b[2]));
      x++
    ) {
      const core: Bounds = [
        clamp(x * INTERIOR_TILE_SIZE),
        clamp(y * INTERIOR_TILE_SIZE),
        clamp((x + 1) * INTERIOR_TILE_SIZE - 1),
        clamp((y + 1) * INTERIOR_TILE_SIZE - 1),
      ];
      tiles.push({
        x,
        y,
        core,
        sqlHalo: [core[0] - 1, core[1] - 1, core[2] + 1, core[3] + 1],
      });
    }
  return tiles;
}

export function mergeDetails(
  parts: DetailTile[],
  metadata: InteriorMetadata,
  bounds: Bounds,
): Detail {
  // SQL includes a one-cell boundary halo, so adjacent tiles overlap.
  const unique = (cells: Cell[]) => [
    ...new Map(
      cells.map((c) => [`${c.floor}:${c.x}:${c.y}`, c] as const),
    ).values(),
  ];
  return {
    ...parts[0],
    rooms: metadata.rooms,
    connections: metadata.connections,
    bounds,
    cells: unique(parts.flatMap((part) => part.cells)),
    lower: unique(parts.flatMap((part) => part.lower)),
  };
}

export function screenToWorld(p: ScreenPoint, camera: Camera): WorldPoint {
  return [(p[0] - camera.x) / camera.scale, (p[1] - camera.y) / camera.scale];
}
export function worldToScreen(p: WorldPoint, camera: Camera): ScreenPoint {
  return [p[0] * camera.scale + camera.x, p[1] * camera.scale + camera.y];
}

export function openingPoint(
  c: Extract<Connection, { type: "opening" }>,
  along: number,
): LocalPoint {
  return [
    c.x + (c.axis === "horizontal" ? c.offset + along : 0),
    c.y + (c.axis === "vertical" ? c.offset + along : 0),
  ];
}
