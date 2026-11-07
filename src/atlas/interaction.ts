import {
  isFeatureBrush,
  featureResolution,
  terrainScreenRadius,
} from "./featureBrush";
import { groundResolution, landAuthorResolution, WORLD_LIMIT } from "./lod";
import { viewScale, zoomAt, type LodDecision } from "./lod";
import { riverHit } from "./riverView";
import type { RiverAction } from "./generated/RiverAction";
import type { River } from "./generated/River";
import type { RiverView } from "./generated/RiverView";
import type { RiverSettings } from "./generated/RiverSettings";
import type { TerrainFollow } from "./generated/TerrainFollow";
import type { GroundBrush } from "./generated/GroundBrush";
import type { GroundArgs } from "./generated/GroundArgs";
import type { Brush } from "./generated/Brush";
import type { MapFeature } from "./generated/MapFeature";
import type { RoadRoughness } from "./generated/RoadRoughness";
import { MIN_CITY_SCALE, overviewRoadVisible, zoomIntoCity } from "./cityView";
import {
  parcelIntent,
  resizeParcel,
  parcelHandles,
  freezeLayout,
  plannedForParcel,
  type ParcelHandle,
} from "./parcelPlanning";
import type { Road } from "./model";
import {
  rectangle,
  distance,
  hitObject,
  openingPoint,
  segmentDistance,
  worldToScreen,
  type EditorContext,
  type MapObject,
  type PopulationSettings,
  type Scene,
  type Detail,
  toLocal,
  toWorld,
  type Area,
  type Camera,
  type House,
  type Intent,
  type LocalPoint,
  type Parcel,
  type ScreenPoint,
  type WorldPoint,
} from "./model";
import { stairPlacement } from "../interiorContract";
import { hitScene, parcelTransform, parcelVisibility } from "./parcelEditor";
import type { SelectionEvent, Tool } from "./editorSelection";
import {
  isLiveBrush,
  workflowDraft,
  workflowPointer,
  workflowPreview,
  type EditorWorkflow,
} from "./editorWorkflow";
import { roadInsertion } from "./roadGeometry";
export type Guide = {
  points: WorldPoint[];
  closed?: boolean;
  invalid?: boolean;
};

import {
  drawingNodes,
  smoothRoadDraft,
  newRoadDraft,
  editRoadDraft,
  moveRoadNode,
  editAreaDraft,
  toDraftIntent,
  type DrawingRoadDraft,
  type EditorDraft,
  type RoadEditDraft,
} from "./roadDraft";

type Base = { pointer: number; start: WorldPoint; screen: ScreenPoint };
type Interior = { house: House; floor: number };
export type Gesture = Base &
  (
    | {
        kind: "region";
        id: string;
        points: WorldPoint[];
        radius: number;
        erase: boolean;
      }
    | {
        kind: "river";
        index: number;
        intent: Extract<Intent, { type: "riverEdit" }>;
      }
    | { kind: "pan"; camera: Camera }
    | { kind: "ground"; brush: GroundBrush; view?: GroundArgs; started: number }
    | {
        kind: "scenery";
        brush: import("./generated/SceneryBrush").SceneryBrush;
      }
    | {
        kind: "terrain";
        water?: boolean;
        brush: Brush;
        view?: import("./generated/TerrainArgs").TerrainArgs;
      }
    | {
        kind: "node";
        object: RoadEditDraft;
        index: number;
        handle: "point" | "incoming" | "outgoing";
      }
    | {
        kind: "parcel";
        parcel: Parcel;
        road: Road;
        handle: ParcelHandle;
        draft?: DrawingRoadDraft;
        settings?: PopulationSettings;
        key?: string;
      }
    | { kind: "newNode"; draft: DrawingRoadDraft; index: number }
    | { kind: "areaPoint"; object: Area; index: number }
    | { kind: "moveArea"; object: Area }
    | {
        kind: "houseTransform";
        object: House;
        mode: "move" | "rotate";
        parcel?: Parcel;
      }
    | ({ kind: "roomMove"; room: string; cells: LocalPoint[] } & Interior)
    | { kind: "houseRectangle"; parcel?: Parcel }
    | { kind: "parcelRectangle"; parcel: Parcel; floor: number }
    | ({
        kind: "interiorRectangle";
        tool: "draw" | "erase";
        room: string;
      } & Interior)
    | ({ kind: "interiorRectangle"; tool: "assign"; room: string } & Interior)
    | ({
        kind: "stairs";
        travel: "up" | "down";
        axis: boolean | null;
      } & Interior)
  );
export type Evaluation = {
  gesture: Gesture;
  intent: Intent | null;
  guide: Guide | null;
  draft: EditorDraft | null | undefined;
  camera: Camera | null;
  error: string | null;
};
function extendStroke<T extends { brush: { points: WorldPoint[] } }>(
  gesture: T,
  point: WorldPoint,
): T {
  const points = [...gesture.brush.points];
  const last = points[points.length - 1];
  if (!last || distance(last, point) > 0.001) points.push(point);
  return { ...gesture, brush: { ...gesture.brush, points } };
}

export function evaluateGesture(
  g: Gesture,
  input: {
    pointer: number;
    point: WorldPoint;
    screen: ScreenPoint;
    snapped: WorldPoint;
    finish: boolean;
    time?: number;
  },
): Evaluation | null {
  if (g.pointer !== input.pointer) return null;
  const { point: p, screen, snapped } = input;
  const result: Evaluation = {
    gesture: g,
    intent: null,
    guide: null,
    draft: undefined,
    camera: null,
    error: null,
  };
  if (g.kind === "river") {
    const intent = structuredClone(g.intent);
    if (intent.action.kind !== "put") return null;
    intent.action.nodes[g.index].point = p;
    result.gesture = { ...g, intent };
    result.intent = intent;
    return result;
  }
  if (g.kind === "region") {
    const gesture = { ...g, points: [...g.points, p] };
    result.gesture = gesture;
    result.intent = {
      type: "regionStroke",
      id: g.id,
      points: gesture.points,
      radius: g.radius,
      erase: g.erase,
    };
    return result;
  }
  if (g.kind === "ground") {
    const elapsed = Math.max(
      g.brush.points[g.brush.points.length - 1][2],
      (input.time ?? g.started) - g.started,
    );
    const gesture = {
      ...g,
      brush: {
        ...g.brush,
        points: [
          ...g.brush.points,
          [p[0], p[1], elapsed] as [number, number, number],
        ],
      },
    };
    result.gesture = gesture;
    result.intent = {
      type: "groundStroke",
      brush: gesture.brush,
      view: gesture.view,
    };
    return result;
  }
  if (g.kind === "terrain" && !g.water) {
    const last = g.brush.points[g.brush.points.length - 1];
    const points: WorldPoint[] = !last || distance(last, p) > 0.001 ? [p] : [];
    result.gesture = points.length
      ? { ...g, brush: { ...g.brush, points } }
      : g;
    result.intent = {
      type: "terrainStroke",
      brush: { ...g.brush, points },
      view: g.view,
    };
    return result;
  }
  if (g.kind === "scenery" || g.kind === "terrain") {
    const gesture = extendStroke(g, p);
    result.gesture = gesture;
    result.intent =
      gesture.kind === "scenery"
        ? { type: "sceneryStroke", brush: gesture.brush }
        : {
            type: gesture.water ? "waterStroke" : "terrainStroke",
            brush: gesture.brush,
            view: gesture.view,
          };
    return result;
  }
  const moved = Math.hypot(screen[0] - g.screen[0], screen[1] - g.screen[1]);
  if (g.kind === "pan") {
    result.camera = {
      ...g.camera,
      x: g.camera.x + screen[0] - g.screen[0],
      y: g.camera.y + screen[1] - g.screen[1],
    };
    return result;
  }
  if (moved < (g.kind === "newNode" ? 3 : 5)) {
    if (g.kind === "node" || g.kind === "areaPoint" || g.kind === "moveArea")
      result.draft = null;
    if (g.kind === "newNode") {
      result.draft = g.draft;
      result.intent = toDraftIntent(g.draft);
    }
    if (!(
      input.finish &&
      (g.kind === "interiorRectangle" || g.kind === "parcelRectangle")
    ))
      return result;
  }
  try {
    if (g.kind === "parcel") {
      const source = resizeParcel(g.parcel, g.road, g.handle, p);
      if (g.settings && g.key) {
        const settings = {
          ...g.settings,
          layout: g.settings.layout?.map((item) =>
            item.key === g.key
              ? {
                  ...item,
                  start: source.start,
                  end: source.end,
                  setback: source.setback,
                  depth: source.depth,
                }
              : item,
          ),
        };
        if (g.draft) {
          result.draft = { ...g.draft, population: settings };
          result.intent = toDraftIntent(result.draft);
        } else
          result.intent = { type: "populate", roadId: g.road.id, settings };
      } else result.intent = parcelIntent(g.parcel, source);
    } else if (g.kind === "newNode") {
      const r = structuredClone(g.draft),
        n = drawingNodes(r)[g.index];
      if (!(r.kind === "extendRoad" && g.index === 0)) n.point = snapped;
      result.draft = smoothRoadDraft(r);
      result.intent = toDraftIntent(result.draft);
    } else if (g.kind === "node") {
      const r = moveRoadNode(
        g.object,
        g.index,
        g.handle,
        g.handle === "point" ? snapped : p,
      );
      result.draft = r;
      result.intent = toDraftIntent(r);
    } else if (g.kind === "areaPoint" || g.kind === "moveArea") {
      const a = structuredClone(g.object);
      if (g.kind === "areaPoint") a.points[g.index] = p;
      else
        a.points = a.points.map((q) => [
          q[0] + p[0] - g.start[0],
          q[1] + p[1] - g.start[1],
        ]);
      result.draft = editAreaDraft(a);
      result.intent = toDraftIntent(result.draft);
    } else if (g.kind === "houseTransform") {
      const t = { ...g.object.transform };
      if (g.object.placement.kind === "parcel") {
        if (!g.parcel || g.parcel.id !== g.object.placement.parcelId)
          throw Error("Parzellenrahmen wird geladen");
        if (g.mode === "rotate")
          throw Error("Gebundene Häuser nur um 90° drehen");
        const a = toLocal(g.start, g.parcel.frame),
          b = toLocal(p, g.parcel.frame);
        const transform = parcelTransform(g.parcel.frame, {
          ...g.object.placement.gridPose,
          xCells: g.object.placement.gridPose.xCells + Math.round(b[0] - a[0]),
          yCells: g.object.placement.gridPose.yCells + Math.round(b[1] - a[1]),
        });
        Object.assign(t, transform);
      } else if (g.mode === "move") {
        t.x += p[0] - g.start[0];
        t.y += p[1] - g.start[1];
      } else t.angle = Math.atan2(p[1] - t.y, p[0] - t.x) + Math.PI / 2;
      result.intent = { type: "transformHouse", id: g.object.id, transform: t };
    } else if (g.kind === "houseRectangle") {
      const a = g.parcel ? toLocal(g.start, g.parcel.frame) : g.start;
      const b = g.parcel ? toLocal(p, g.parcel.frame) : p;
      const divisor = g.parcel ? 1 : 5;
      const x = g.parcel
        ? Math.round(Math.min(a[0], b[0]))
        : Math.min(a[0], b[0]);
      const y = g.parcel
        ? Math.round(Math.min(a[1], b[1]))
        : Math.min(a[1], b[1]);
      const w = Math.max(1, Math.round(Math.abs(b[0] - a[0]) / divisor));
      const d = Math.max(1, Math.round(Math.abs(b[1] - a[1]) / divisor));
      const transform = g.parcel
        ? parcelTransform(g.parcel.frame, {
            xCells: x,
            yCells: y,
            quarterTurns: 0,
          })
        : { x, y, angle: 0 };
      result.intent = {
        type: "createHouse",
        parcelId: g.parcel?.id ?? null,
        transform,
        width: w,
        depth: d,
      };
      result.guide = {
        points: (
          [
            [0, 0],
            [w, 0],
            [w, d],
            [0, d],
          ] as LocalPoint[]
        ).map((q) => toWorld(q, transform)),
        closed: true,
      };
    } else if (g.kind === "parcelRectangle") {
      const a = toLocal(g.start, g.parcel.frame),
        b = toLocal(p, g.parcel.frame);
      const start: LocalPoint = [Math.floor(a[0]), Math.floor(a[1])];
      const end: LocalPoint =
        moved < 5 ? start : [Math.floor(b[0]), Math.floor(b[1])];
      result.intent = {
        type: "createParcelHouse",
        parcelId: g.parcel.id,
        floor: g.floor,
        cells: rectangle(start, end),
      };
      result.guide = cellRectangleGuide(start, end, g.parcel.frame);
    } else {
      const cell = (q: WorldPoint): LocalPoint => {
        const v = toLocal(q, g.house.transform);
        return [Math.floor(v[0]), Math.floor(v[1])];
      };
      const a = cell(g.start),
        b = cell(p),
        dx = b[0] - a[0],
        dy = b[1] - a[1];
      if (g.kind === "roomMove") {
        if (dx || dy)
          result.intent = {
            type: "room",
            buildingId: g.house.id,
            intent: { kind: "move", roomId: g.room, dx, dy },
          };
        result.guide = {
          points: g.cells.length
            ? [
                toWorld(
                  [g.cells[0][0] + dx, g.cells[0][1] + dy],
                  g.house.transform,
                ),
                p,
              ]
            : [g.start, p],
        };
      } else if (g.kind === "stairs") {
        const horizontal =
          Math.abs(dx) === Math.abs(dy)
            ? (g.axis ?? true)
            : Math.abs(dx) > Math.abs(dy);
        result.gesture = { ...g, axis: horizontal };
        const direction = horizontal
          ? dx >= 0
            ? "east"
            : "west"
          : dy >= 0
            ? "south"
            : "north";
        const length = (horizontal ? Math.abs(dx) : Math.abs(dy)) + 1;
        if (length > 1)
          result.intent = {
            type: "connection",
            buildingId: g.house.id,
            intent: stairPlacement(g.floor, a, g.travel, direction, length),
          };
        result.guide = {
          points: [
            toWorld([a[0] + 0.5, a[1] + 0.5], g.house.transform),
            toWorld(
              [
                a[0] + 0.5 + (horizontal ? dx : 0),
                a[1] + 0.5 + (horizontal ? 0 : dy),
              ],
              g.house.transform,
            ),
          ],
          invalid: length > 64,
        };
      } else {
        if (g.tool === "assign" && !g.room) {
          if (moved < 5 && input.finish) return result;
          throw Error("Zuerst einen Raum auswählen");
        }
        const end = moved < 5 ? a : b,
          cells = rectangle(a, end);
        result.intent = {
          type: "room",
          buildingId: g.house.id,
          intent:
            g.tool === "assign"
              ? { kind: "assign", floor: g.floor, cells, roomId: g.room }
              : { kind: g.tool, floor: g.floor, cells },
        };
        result.guide = cellRectangleGuide(a, end, g.house.transform);
      }
    }
  } catch (e) {
    result.error = String(e);
  }
  return result;
}

function cellRectangleGuide(
  start: LocalPoint,
  end: LocalPoint,
  transform: House["transform"],
): Guide {
  const x = Math.min(start[0], end[0]),
    y = Math.min(start[1], end[1]),
    X = Math.max(start[0], end[0]) + 1,
    Y = Math.max(start[1], end[1]) + 1;
  return {
    points: (
      [
        [x, y],
        [X, y],
        [X, Y],
        [x, Y],
      ] as LocalPoint[]
    ).map((point) => toWorld(point, transform)),
    closed: true,
  };
}

export function editableRiver(
  draft: RiverAction | null,
  river: River | undefined,
): Extract<RiverAction, { kind: "put" }> | null {
  if (draft?.kind === "put") return structuredClone(draft);
  return river
    ? {
        kind: "put",
        id: river.id,
        name: river.name,
        nodes: structuredClone(river.nodes),
        settings: { ...river.settings },
        automatic: false,
        reverse: false,
        snap: 0,
      }
    : null;
}

// A borrowed view of the current controller state and passive App data. This is
// never retained by the input binding or used as another editor state.
export type CanvasInputSnapshot = Readonly<{
  workflow: EditorWorkflow;
  camera: Camera;
  lod: LodDecision;
  editable: boolean;
  navigation?: {
    bounds: import("./model").Bounds;
    scene: Scene;
  };
  overviewRoads?: MapFeature[];
  roughness?: RoadRoughness;
  terrainFollow?: TerrainFollow;
  deletion: boolean;
  tool: Tool;
  selected: string;
  selectedObject: MapObject | undefined;
  context: EditorContext;
  floor: number;
  room: string;
  connection: string;
  scene: Scene | undefined;
  detail: Detail | null | undefined;
  house: House | undefined;
  parcel: Parcel | undefined;
  selectionParcel: Parcel | undefined;
  boundaries: ReturnType<typeof parcelVisibility>["boundaries"];
  ground?: Omit<GroundBrush, "points" | "seed">;
  groundView?: GroundArgs;
  groundPicker?: boolean;
  river?: {
    river: River | undefined;
    views: RiverView[];
    settings: RiverSettings;
    width: number;
    mode: "draw" | "select";
    fresh: boolean;
  };
  region?: {
    id: string;
    diameter: number;
    mode: "paint" | "erase" | "select" | "label";
  };
  brush?: Omit<Brush, "points">;
  scenery?: Omit<
    import("./generated/SceneryBrush").SceneryBrush,
    "points" | "seed"
  >;
  scenerySeed?: number;
  terrainView?: import("./generated/TerrainArgs").TerrainArgs;
  roadWidth: number;
  material: string;
  opening: "door" | "passage";
  travel: "up" | "down";
  populateRoad: boolean;
  settings: PopulationSettings;
  stalePlanParcels?: Parcel[];
  planning?: {
    road: Road;
    objects: MapObject[];
    settings: PopulationSettings;
    selectedKey: string | null;
  };
}>;
export type CanvasCommand =
  | { kind: "riverSelection"; id: string }
  | {
      kind: "riverDraft";
      intent: Extract<Intent, { type: "riverEdit" }>;
      node: number;
      pointer: Extract<Gesture, { kind: "river" }> | null;
    }
  | { kind: "regionPick"; point: WorldPoint; label: boolean }
  | { kind: "groundSize"; factor: number }
  | { kind: "groundPick"; point: WorldPoint }
  | { kind: "planParcel"; key: string | null }
  | { kind: "extend"; end: "start" | "end" }
  | { kind: "beginGesture"; gesture: Gesture; rollback?: EditorDraft | null }
  | { kind: "draft"; draft: EditorDraft }
  | { kind: "intent"; intent: Intent }
  | { kind: "selection"; event: SelectionEvent }
  | { kind: "cancelEditor" }
  | { kind: "accept" }
  | { kind: "deleteSelection" }
  | { kind: "history"; redo: boolean }
  | { kind: "document"; kindOfDocument: "save" | "saveAs" }
  | { kind: "tool"; value: Tool }
  | { kind: "camera"; camera: Camera };
export type PointerInput = {
  pointer: number;
  time?: number;
  button: number;
  point: WorldPoint;
  screen: ScreenPoint;
  alt: boolean;
  space: boolean;
};
type InputDecision = {
  focus: boolean;
  capture: boolean;
  commands: CanvasCommand[];
};
export function snapToRoad(
  p: WorldPoint,
  alt: boolean,
  snapshot: CanvasInputSnapshot,
): WorldPoint {
  const { camera, selected, scene, workflow } = snapshot;
  const objects = scene?.objects ?? [];
  if (alt) return p;
  let nearest = p,
    d = 8 / camera.scale;
  for (const o of objects)
    if (
      o.kind === "road" &&
      !(workflowPointer(workflow)?.kind === "node" && o.id === selected)
    )
      for (let i = 1; i < o.path.length; i++) {
        const a = o.path[i - 1],
          b = o.path[i],
          dx = b[0] - a[0],
          dy = b[1] - a[1],
          length = dx * dx + dy * dy,
          t = length
            ? Math.max(
                0,
                Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length),
              )
            : 0;
        const q: WorldPoint = [a[0] + dx * t, a[1] + dy * t],
          n = distance(p, q);
        if (n < d) {
          d = n;
          nearest = q;
        }
      }
  return nearest;
}

const pointerBase = (input: PointerInput): Base => ({
  pointer: input.pointer,
  start: input.point,
  screen: input.screen,
});

function roadPointerDown(
  snapshot: CanvasInputSnapshot,
  input: PointerInput,
  decision: InputDecision,
): InputDecision {
  const { camera, roadWidth, material, populateRoad, settings } = snapshot;
  const p = input.point;
  const draft = workflowDraft(snapshot.workflow);
  const base = pointerBase(input);
  const { commands } = decision;
  const begin = (gesture: Gesture, rollback?: EditorDraft | null) =>
    commands.push({ kind: "beginGesture", gesture, rollback });
  commands.push({ kind: "planParcel", key: null });
  const q = snapToRoad(p, input.alt, snapshot);
  const r =
    draft?.kind === "newRoad" || draft?.kind === "extendRoad"
      ? structuredClone(draft)
      : newRoadDraft(
          {
            name: "Straße",
            width: roadWidth,
            material: material === "stone" ? "stone" : "earth",
          },
          populateRoad ? settings : null,
        );
  if (!draft) {
    r.roughness = snapshot.roughness;
    r.terrainFollow = snapshot.terrainFollow;
  }
  const anchor =
    r.kind === "extendRoad" &&
    !r.nodes.length &&
    distance(q, r.anchor.point) * camera.scale < 9;
  const hitIndex = drawingNodes(r).findIndex(
    (n) => distance(n.point, p) * camera.scale < 9,
  );
  if (hitIndex < 0 && !anchor) {
    const last = drawingNodes(r).at(-1);
    if (last && distance(last.point, q) < 1e-7) return decision;
    r.nodes.push({ point: q, incoming: null, outgoing: null });
  }
  begin(
    {
      ...base,
      kind: "newNode",
      index: hitIndex >= 0 ? hitIndex : drawingNodes(r).length - 1,
      draft: smoothRoadDraft(r),
    },
    draft,
  );
  return decision;
}

function nodePointerDown(
  snapshot: CanvasInputSnapshot,
  input: PointerInput,
  decision: InputDecision,
): boolean {
  const { selectedObject, camera } = snapshot;
  const draft = workflowDraft(snapshot.workflow);
  const overview =
    snapshot.context.kind === "exterior" && !snapshot.lod.policy.exact;
  const p = input.point;
  const base = pointerBase(input);
  const { commands } = decision;
  const begin = (gesture: Gesture) =>
    commands.push({ kind: "beginGesture", gesture });
  const nodeSelection = (value: string | number | null) =>
    commands.push({ kind: "selection", event: { type: "pointerNode", value } });
  const roadEdit =
    draft?.kind === "editRoad" && draft.roadId === selectedObject?.id
      ? draft
      : selectedObject?.kind === "road"
        ? editRoadDraft(selectedObject)
        : null;
  if (selectedObject?.kind === "road" && !draft) {
    for (const end of ["start", "end"] as const) {
      const nodes = selectedObject.nodes,
        n = nodes[end === "start" ? 0 : nodes.length - 1],
        other = nodes[end === "start" ? 1 : nodes.length - 2];
      const dx = n.point[0] - other.point[0],
        dy = n.point[1] - other.point[1],
        norm = Math.hypot(dx, dy) || 1;
      if (
        distance(p, [
          n.point[0] + ((dx / norm) * 22) / camera.scale,
          n.point[1] + ((dy / norm) * 22) / camera.scale,
        ]) *
          camera.scale <
        9
      ) {
        commands.push({ kind: "extend", end });
        decision.capture = false;
        return true;
      }
    }
  }
  if (roadEdit) {
    for (let i = 0; i < roadEdit.nodes.length; i++) {
      const n = roadEdit.nodes[i];
      for (const handle of overview
        ? (["point"] as const)
        : (["incoming", "outgoing", "point"] as const)) {
        const q = n[handle];
        if (q && distance(p, q) * camera.scale < 9) {
          nodeSelection(n.id);
          begin({
            ...base,
            kind: "node",
            index: i,
            handle,
            object: structuredClone(roadEdit),
          });
          return true;
        }
      }
    }
  }
  if (!overview && selectedObject?.kind === "area") {
    const i = selectedObject.points.findIndex(
      (q) => distance(p, q) * camera.scale < 9,
    );
    if (i >= 0) {
      nodeSelection(i);
      begin({
        ...base,
        kind: "areaPoint",
        index: i,
        object: structuredClone(selectedObject),
      });
      return true;
    }
  }
  return false;
}

function interiorPointerDown(
  snapshot: CanvasInputSnapshot,
  input: PointerInput,
  decision: InputDecision,
): boolean {
  const { house, detail, floor, room } = snapshot;
  if (!house || !detail) return false;
  const p = input.point;
  const base = pointerBase(input);
  const { commands } = decision;
  const begin = (gesture: Gesture) =>
    commands.push({ kind: "beginGesture", gesture });
  const connectionSelection = (id: string) =>
    commands.push({
      kind: "selection",
      event: { type: "pointerConnection", id },
    });
  const roomSelection = (room: string) =>
    commands.push({
      kind: "selection",
      event: { type: "pointerRoom", id: room },
    });
  const q = toLocal(p, house.transform);
  const con = detail.connections.find((c) => {
    if (c.type === "opening")
      return c.floor === floor && distance(q, openingPoint(c, 0.5)) < 0.25;
    if (c.floor !== floor && c.floor + 1 !== floor) return false;
    const [dx, dy] = {
      north: [0, -1],
      east: [1, 0],
      south: [0, 1],
      west: [-1, 0],
    }[c.direction];
    return Array.from({ length: c.length }, (_, i) => [
      c.x + dx * i,
      c.y + dy * i,
    ]).some(([x, y]) => Math.floor(q[0]) === x && Math.floor(q[1]) === y);
  });
  if (con) {
    connectionSelection(con.id);
    roomSelection("");
    return true;
  }
  const hit = detail.cells.find(
    (c) => c.x === Math.floor(q[0]) && c.y === Math.floor(q[1]),
  );
  if (hit) {
    connectionSelection("");
    if (room === hit.roomId) {
      begin({
        ...base,
        kind: "roomMove",
        room,
        house: structuredClone(house),
        floor,
        cells: detail.cells
          .filter((c) => c.roomId === room)
          .map((c) => [c.x, c.y]),
      });
    } else roomSelection(hit.roomId);
    return true;
  }
  return false;
}

function drawingPointerDown(
  snapshot: CanvasInputSnapshot,
  input: PointerInput,
  decision: InputDecision,
): InputDecision {
  const { context, house, parcel, tool, floor, opening, travel, room } =
    snapshot;
  const interior = context.kind !== "exterior";
  const active = house?.id ?? "";
  const objects = snapshot.scene?.objects ?? [];
  const p = input.point;
  const base = pointerBase(input);
  const begin = (gesture: Gesture) =>
    decision.commands.push({ kind: "beginGesture", gesture });
  const intent = (intent: Intent) =>
    decision.commands.push({ kind: "intent", intent });
  if (interior && !house && !parcel) return decision;
  if (tool === "opening" && house) {
    const q = toLocal(p, house.transform),
      x = Math.floor(q[0]),
      y = Math.floor(q[1]);
    const vertical =
      Math.min(q[0] - x, 1 - (q[0] - x)) < Math.min(q[1] - y, 1 - (q[1] - y));
    intent({
      type: "connection",
      buildingId: active,
      intent: {
        action: "createOpening",
        floor,
        x: vertical ? Math.round(q[0]) : x,
        y: vertical ? y : Math.round(q[1]),
        axis: vertical ? "vertical" : "horizontal",
        kind: opening,
      },
    });
    return decision;
  }
  if (tool === "house") {
    // Geometry identifies the target polygon; only a scene selection closure
    // may decide whether it has an owner (including an offscreen owner).
    const target = objects.find(
      (o): o is Parcel => o.kind === "parcel" && hitObject(o, p),
    );
    begin({
      ...base,
      kind: "houseRectangle",
      parcel: target ? structuredClone(target) : undefined,
    });
  } else if (!house && parcel && tool === "draw")
    begin({
      ...base,
      kind: "parcelRectangle",
      parcel: structuredClone(parcel),
      floor,
    });
  else if (house && tool === "stairs")
    begin({
      ...base,
      kind: "stairs",
      house: structuredClone(house),
      floor,
      travel,
      axis: null,
    });
  else if (house && (tool === "draw" || tool === "erase" || tool === "assign"))
    begin({
      ...base,
      kind: "interiorRectangle",
      house: structuredClone(house),
      floor,
      tool,
      room,
    });

  return decision;
}

function riverPointerDown(
  snapshot: CanvasInputSnapshot,
  input: PointerInput,
  decision: InputDecision,
): InputDecision {
  const { camera } = snapshot;
  const p = input.point;
  const base = pointerBase(input);
  const { commands } = decision;
  const r = snapshot.river;
  if (!snapshot.editable || snapshot.deletion || !r?.fresh) return decision;
  const operation =
    snapshot.workflow.kind === "geometry" &&
    snapshot.workflow.operation.kind === "river"
      ? snapshot.workflow.operation
      : null;
  const current = editableRiver(operation?.intent.action ?? null, r.river);
  const append = operation?.append ?? null;
  const edit = (
    action: NonNullable<typeof current>,
    node: number,
    dragging = false,
  ) => {
    const intent = {
      type: "riverEdit" as const,
      action,
      view: snapshot.terrainView ?? null,
    };
    decision.capture = dragging;
    commands.push({
      kind: "riverDraft",
      intent,
      node,
      pointer: dragging
        ? { ...base, kind: "river", index: node, intent }
        : null,
    });
  };
  if (current && !append) {
    const index = current.nodes.findIndex(
      (node) => distance(node.point, p) * camera.scale < 9,
    );
    if (index >= 0) {
      edit(current, index, true);
      return decision;
    }
  }
  if (r.mode === "select" && !append) {
    commands.push({
      kind: "riverSelection",
      id: riverHit(r.views, p, camera.scale)?.view.river.id ?? "",
    });
    return decision;
  }
  const next =
    current && (append || !current.id)
      ? current
      : {
          kind: "put" as const,
          id: null,
          name: "Fluss",
          nodes: [],
          settings: { ...r.settings },
          automatic: true,
          reverse: false,
          snap: 8 / camera.scale,
        };
  const last = append === "start" ? next.nodes[0] : next.nodes.at(-1);
  if (last && distance(last.point, p) * camera.scale < 2) return decision;
  const node = { id: "", point: p, width: r.width };
  if (append === "start") next.nodes.unshift(node);
  else next.nodes.push(node);
  next.snap = next.id ? 0 : 8 / camera.scale;
  edit(next, append === "start" ? 0 : next.nodes.length - 1);
  return decision;
}

function brushPointerDown(
  snapshot: CanvasInputSnapshot,
  input: PointerInput,
  decision: InputDecision,
): boolean {
  const { tool, camera, context } = snapshot;
  if (context.kind !== "exterior") return false;
  const p = input.point;
  const base = pointerBase(input);
  const { commands } = decision;
  const begin = (gesture: Gesture) =>
    commands.push({ kind: "beginGesture", gesture });
  if (tool === "regions" && snapshot.region) {
    const r = snapshot.region;
    if (r.mode === "select" || r.mode === "label") {
      decision.capture = false;
      commands.push({
        kind: "regionPick",
        point: p,
        label: r.mode === "label",
      });
    } else if (r.id)
      begin({
        ...base,
        kind: "region",
        id: r.id,
        points: [p],
        radius: r.diameter / 2 / camera.scale,
        erase: r.mode === "erase",
      });
    return true;
  }
  if (tool === "area" && snapshot.ground) {
    if (snapshot.groundPicker) {
      decision.capture = false;
      commands.push({ kind: "groundPick", point: p });
    } else
      begin({
        ...base,
        kind: "ground",
        started: input.time ?? 0,
        view: snapshot.groundView,
        brush: {
          ...snapshot.ground,
          resolution: groundResolution(camera.scale),
          diameter: snapshot.ground.diameter / camera.scale,
          seed: snapshot.scenerySeed ?? 1,
          points: [[p[0], p[1], 0]],
        },
      });
    return true;
  }
  if (tool === "scenery" && snapshot.scenery) {
    begin({
      ...base,
      kind: "scenery",
      brush: {
        ...snapshot.scenery,
        radius: snapshot.scenery.radius / camera.scale,
        seed: snapshot.scenerySeed ?? 1,
        points: [p],
      },
    });
    return true;
  }
  if ((tool === "terrain" || tool === "water") && snapshot.brush) {
    begin({
      ...base,
      kind: "terrain",
      water: tool === "water",
      view: snapshot.terrainView,
      brush: {
        ...snapshot.brush,
        resolution:
          tool === "water"
            ? 0
            : isFeatureBrush(snapshot.brush.mode)
              ? featureResolution(snapshot.brush.radius)
              : snapshot.brush.mode === "land" || snapshot.brush.mode === "sea"
                ? landAuthorResolution(camera.scale)
                : snapshot.lod.authorTerrainLevel,
        radius:
          terrainScreenRadius(snapshot.brush, camera.scale, tool === "water") /
          camera.scale,
        points: [p],
      },
    });
    return true;
  }
  return false;
}

export function decidePointerDown(
  snapshot: CanvasInputSnapshot,
  input: PointerInput,
): InputDecision {
  const decision: InputDecision = {
    focus: false,
    capture: false,
    commands: [],
  };
  const { commands } = decision;
  if (
    input.button === 2 &&
    !workflowPointer(snapshot.workflow) &&
    snapshot.editable &&
    !snapshot.deletion
  ) {
    const draft = workflowDraft(snapshot.workflow);
    if (draft?.kind === "newRoad" || draft?.kind === "extendRoad")
      commands.push({ kind: toDraftIntent(draft) ? "accept" : "cancelEditor" });
    else if (
      snapshot.tool === "river" ||
      draft?.kind === "newArea" ||
      snapshot.workflow.kind === "populate" ||
      ("candidate" in snapshot.workflow &&
        snapshot.workflow.candidate?.intent.type === "roughenRoad")
    )
      commands.push({ kind: "accept" });
    return decision;
  }
  if (workflowPointer(snapshot.workflow) || ![0, 1].includes(input.button))
    return decision;
  decision.focus = true;
  const {
    camera,
    editable,
    deletion,
    tool,
    selected,
    selectedObject,
    context,
    selectionParcel,
  } = snapshot;
  const p = input.point,
    interior = context.kind !== "exterior";
  const objects = snapshot.scene?.objects ?? [];
  const draft = workflowDraft(snapshot.workflow);
  const base = pointerBase(input);
  const begin = (gesture: Gesture, rollback?: EditorDraft | null) =>
    commands.push({ kind: "beginGesture", gesture, rollback });
  if (input.button === 1 || input.space) {
    decision.capture = true;
    begin({ ...base, kind: "pan", camera: { ...camera } });
    return decision;
  }
  if (tool === "river" && !interior)
    return riverPointerDown(snapshot, input, decision);
  const overview = context.kind === "exterior" && !snapshot.lod.policy.exact;
  if (overview && !editable && !deletion && input.button === 0) {
    decision.capture = true;
    begin({ ...base, kind: "pan", camera: { ...camera } });
    return decision;
  }
  if (!editable || deletion) return decision;
  decision.capture = true;
  if (brushPointerDown(snapshot, input, decision)) return decision;
  const planning = snapshot.planning;
  if (planning && !overview) {
    const layout = freezeLayout(
      planning.objects,
      planning.road,
      planning.settings,
    );
    const parcels = planning.objects.filter(
      (o): o is Parcel => o.kind === "parcel",
    );
    const selectedParcel = parcels.find(
      (p) =>
        plannedForParcel(layout, p, planning.road)?.key ===
        planning.selectedKey,
    );
    if (selectedParcel) {
      const handle = parcelHandles(selectedParcel, planning.road).find(
        (h) => distance(p, h.point) * camera.scale < 9,
      );
      if (handle) {
        const settings = { ...planning.settings, layout };
        const drawing =
          draft?.kind === "newRoad" || draft?.kind === "extendRoad"
            ? { ...draft, population: settings }
            : undefined;
        begin(
          {
            ...base,
            kind: "parcel",
            parcel: structuredClone(selectedParcel),
            road: structuredClone(planning.road),
            handle: handle.kind,
            draft: drawing,
            settings,
            key: planning.selectedKey!,
          },
          draft,
        );
        return decision;
      }
    }
    const nodeHit =
      draft &&
      (draft.kind === "newRoad" || draft.kind === "extendRoad") &&
      drawingNodes(draft).some((n) => distance(n.point, p) * camera.scale < 9);
    const hit = !nodeHit && parcels.find((parcel) => hitObject(parcel, p));
    if (hit) {
      commands.push({
        kind: "planParcel",
        key: plannedForParcel(layout, hit, planning.road)?.key ?? null,
      });
      decision.capture = false;
      return decision;
    }
  }
  if (
    !overview &&
    tool === "select" &&
    selectedObject?.kind === "parcel" &&
    selectedObject.source.kind === "road"
  ) {
    const roadId = selectedObject.source.roadId;
    const road = objects.find(
      (o): o is Road => o.kind === "road" && o.id === roadId,
    );
    const handle =
      road &&
      parcelHandles(selectedObject, road).find(
        (h) => distance(p, h.point) * camera.scale < 9,
      );
    if (road && handle) {
      begin({
        ...base,
        kind: "parcel",
        parcel: structuredClone(selectedObject),
        road: structuredClone(road),
        handle: handle.kind,
      });
      return decision;
    }
  }
  if (
    !overview &&
    !planning &&
    snapshot.stalePlanParcels?.some((parcel) => hitObject(parcel, p))
  ) {
    decision.capture = false;
    return decision;
  }
  if (tool === "road") return roadPointerDown(snapshot, input, decision);

  if (tool === "select") {
    if (nodePointerDown(snapshot, input, decision)) return decision;
    if (overview) {
      const hit = overviewRoadAt(snapshot, p);
      if (hit) {
        commands.push({
          kind: "selection",
          event: { type: "selectObject", id: hit.id },
        });
        decision.capture = false;
      } else begin({ ...base, kind: "pan", camera: { ...camera } });
      return decision;
    }
    if (interiorPointerDown(snapshot, input, decision)) return decision;
    if (
      selectedObject?.kind === "house" &&
      !interior &&
      selectedObject.placement.kind === "free" &&
      distance(p, toWorld([0, -3], selectedObject.transform)) * camera.scale <
        10
    ) {
      begin({
        ...base,
        kind: "houseTransform",
        mode: "rotate",
        object: structuredClone(selectedObject),
      });
      return decision;
    }
    const hit = hitScene(objects, p, 3 / camera.scale, snapshot.boundaries);
    if (hit?.id === selected && hit.kind === "house" && !interior) {
      begin({
        ...base,
        kind: "houseTransform",
        mode: "move",
        object: structuredClone(hit),
        parcel: selectionParcel ? structuredClone(selectionParcel) : undefined,
      });
      return decision;
    }
    if (hit?.id === selected && hit.kind === "area" && !interior) {
      begin({
        ...base,
        kind: "moveArea",
        object: structuredClone(hit),
      });
      return decision;
    }
    if (!interior)
      commands.push({
        kind: "selection",
        event: { type: "selectObject", id: hit?.id ?? "" },
      });
    return decision;
  }
  return drawingPointerDown(snapshot, input, decision);
}

function isBrushTool(tool: Tool) {
  return ["area", "terrain", "water", "scenery", "regions"].includes(tool);
}

export function decideKey(
  snapshot: CanvasInputSnapshot,
  key: {
    key: string;
    code: string;
    ctrl: boolean;
    meta: boolean;
    shift: boolean;
    formTarget: boolean;
  },
): {
  preventDefault: boolean;
  space: boolean | null;
  commands: CanvasCommand[];
} {
  const commands: CanvasCommand[] = [];
  const result = {
    preventDefault: false,
    space: null as boolean | null,
    commands,
  };
  if (key.formTarget) return result;
  if (
    snapshot.tool === "river" &&
    (key.ctrl || key.meta) &&
    ["z", "y", "o", "n"].includes(key.key.toLowerCase())
  )
    commands.push({ kind: "cancelEditor" });
  if (
    isBrushTool(snapshot.tool) &&
    !key.ctrl &&
    !key.meta &&
    ["[", "]"].includes(key.key)
  ) {
    result.preventDefault = true;
    commands.push({
      kind: "groundSize",
      factor: key.key === "]" ? 1.1 : 1 / 1.1,
    });
    return result;
  }
  if (key.key === "Escape") {
    commands.push({ kind: "cancelEditor" });
    return result;
  }
  if (key.code === "Space") {
    result.space = true;
    result.preventDefault = true;
  }
  if (key.key === "Enter") {
    result.preventDefault = true;
    if (!snapshot.deletion) commands.push({ kind: "accept" });
  }
  if (key.key === "Delete") {
    result.preventDefault = true;
    commands.push({ kind: "deleteSelection" });
  }
  if ((key.ctrl || key.meta) && key.key.toLowerCase() === "z") {
    result.preventDefault = true;
    commands.push({ kind: "history", redo: key.shift });
  }
  if ((key.ctrl || key.meta) && key.key.toLowerCase() === "s") {
    result.preventDefault = true;
    commands.push({
      kind: "document",
      kindOfDocument: key.shift ? "saveAs" : "save",
    });
  }
  if (key.key === "PageUp" || key.key === "PageDown") {
    result.preventDefault = true;
    if (snapshot.context.kind !== "exterior")
      commands.push({
        kind: "selection",
        event: { type: "stepFloor", delta: key.key === "PageUp" ? 1 : -1 },
      });
  }
  if (key.key.toLowerCase() === "v")
    commands.push({ kind: "tool", value: "select" });
  return result;
}
export function decideBlur(snapshot: CanvasInputSnapshot): CanvasCommand[] {
  return snapshot.tool === "river" ? [{ kind: "cancelEditor" }] : [];
}

export function decideWheel(
  snapshot: CanvasInputSnapshot,
  point: WorldPoint,
  deltaY: number,
  alt = false,
): CanvasCommand[] {
  const pointer = workflowPointer(snapshot.workflow);
  if (isLiveBrush(pointer) || pointer?.kind === "scenery") return [];
  if (alt && isBrushTool(snapshot.tool))
    return [{ kind: "groundSize", factor: deltaY < 0 ? 1.1 : 1 / 1.1 }];
  if (pointer) return [];
  const { camera, context } = snapshot;
  const scale = Math.max(
    context.kind === "house" ? 1.28 : MIN_CITY_SCALE,
    Math.min(25.6, camera.scale * Math.exp(-deltaY * 0.0015)),
  );
  return [
    {
      kind: "camera",

      camera: {
        scale,
        x: camera.x + point[0] * (camera.scale - scale),
        y: camera.y + point[1] * (camera.scale - scale),
      },
    },
  ];
}
export function decideDoubleClick(
  snapshot: CanvasInputSnapshot,
  point: WorldPoint,
): CanvasCommand[] {
  const { editable, selectedObject, tool, context } = snapshot;
  if (tool === "river" && context.kind === "exterior")
    return editable ? [{ kind: "accept" }] : [];
  if (context.kind === "exterior" && !snapshot.lod.policy.exact) {
    if (tool === "road" || workflowDraft(snapshot.workflow)) return [];
    if (tool === "select" && overviewRoadAt(snapshot, point)) {
      if (
        editable &&
        selectedObject?.kind === "road" &&
        overviewRoadAt(snapshot, point)?.id === selectedObject.id
      )
        return [
          { kind: "intent", intent: roadInsertion(selectedObject, point) },
        ];
      return [];
    }
    return [
      {
        kind: "camera",
        camera: zoomIntoCity(
          snapshot.camera,
          point,
          snapshot.lod.navigationLevel,
        ),
      },
    ];
  }
  // Camera navigation only needs current geometry under its anchor, not
  // completed raster reads for a newly exposed inspector-side margin.
  const known = snapshot.navigation;
  const pad = 3 / snapshot.camera.scale;
  const navigation =
    known &&
    point[0] - pad >= known.bounds[0] &&
    point[1] - pad >= known.bounds[1] &&
    point[0] + pad <= known.bounds[2] &&
    point[1] + pad <= known.bounds[3]
      ? {
          objects: known.scene.objects,
          boundaries: parcelVisibility(known.scene, context, tool).boundaries,
        }
      : editable && snapshot.scene
        ? { objects: snapshot.scene.objects, boundaries: snapshot.boundaries }
        : undefined;
  if (
    context.kind === "exterior" &&
    snapshot.lod.policy.exact &&
    tool === "select" &&
    navigation &&
    !selectedObject &&
    !snapshot.selected &&
    !snapshot.deletion &&
    snapshot.workflow.kind === "idle" &&
    !workflowPointer(snapshot.workflow) &&
    !snapshot.planning &&
    snapshot.lod.navigationLevel > 0 &&
    !snapshot.stalePlanParcels?.some((parcel) => hitObject(parcel, point)) &&
    !hitScene(
      navigation.objects,
      point,
      3 / snapshot.camera.scale,
      navigation.boundaries,
    )
  )
    return [
      {
        kind: "camera",
        camera: zoomAt(
          snapshot.camera,
          point,
          viewScale(snapshot.lod.navigationLevel - 1),
        ),
      },
    ];
  if (!editable) return [];
  if (selectedObject?.kind === "road" && tool === "select")
    return [{ kind: "intent", intent: roadInsertion(selectedObject, point) }];
  if (selectedObject?.kind === "area" && tool === "select") {
    const points = [...selectedObject.points];
    let index = 0,
      best = Infinity;
    points.forEach((a, i) => {
      const d = segmentDistance(point, a, points[(i + 1) % points.length]);
      if (d < best) {
        best = d;
        index = i;
      }
    });
    points.splice(index + 1, 0, point);
    return [
      {
        kind: "intent",
        intent: {
          type: "updateArea",
          areaId: selectedObject.id,
          area: { material: selectedObject.material, points },
        },
      },
    ];
  }
  if (selectedObject?.kind === "house" && context.kind === "exterior")
    return [
      {
        kind: "selection",
        event: { type: "openHouse", id: selectedObject.id },
      },
    ];
  if (selectedObject?.kind === "parcel" && context.kind === "exterior")
    return [
      {
        kind: "selection",
        event: { type: "openParcel", id: selectedObject.id },
      },
    ];
  return [];
}

// Move and finish share exactly the same geometry and node-snap evaluation.
export function evaluatePointer(
  snapshot: CanvasInputSnapshot,
  input: Pick<PointerInput, "pointer" | "point" | "screen" | "alt" | "time">,
  finish: boolean,
): Evaluation | null {
  const gesture = workflowPointer(snapshot.workflow);
  return gesture
    ? evaluateGesture(
        gesture.kind === "ground"
          ? { ...gesture, view: snapshot.groundView }
          : gesture.kind === "terrain"
            ? { ...gesture, view: snapshot.terrainView }
            : gesture,
        {
          ...input,
          snapped:
            gesture.kind === "node"
              ? snapToRoad(input.point, input.alt, snapshot)
              : input.point,
          finish,
        },
      )
    : null;
}

export function evaluateHold(
  snapshot: CanvasInputSnapshot,
  time: number,
): Evaluation | null {
  const gesture = workflowPointer(snapshot.workflow);
  if (gesture?.kind !== "ground") return null;
  const last = gesture.brush.points[gesture.brush.points.length - 1];
  return evaluatePointer(
    snapshot,
    {
      pointer: gesture.pointer,
      point: [last[0], last[1]],
      screen: gesture.screen,
      alt: false,
      time,
    },
    false,
  );
}

export function hoverAtPoint(snapshot: CanvasInputSnapshot, point: WorldPoint) {
  if (
    snapshot.context.kind === "exterior" &&
    point.some((v) => Math.abs(v) > WORLD_LIMIT)
  )
    return {
      point: worldToScreen(point, snapshot.camera),
      reason: "Außerhalb der Welt · zum Malen hineinzoomen",
      outsideWorld: true,
    };
  const diagnostic = workflowPreview(
    snapshot.workflow,
  )?.generationDiagnostics.find(
    (s) => distance(s.point, point) * snapshot.camera.scale < 10,
  );
  return diagnostic
    ? {
        point: worldToScreen(point, snapshot.camera),
        reason: diagnostic.message,
      }
    : null;
}

function overviewRoadAt(snapshot: CanvasInputSnapshot, point: WorldPoint) {
  let best: MapFeature | undefined;
  let distance = Infinity;
  for (const feature of snapshot.overviewRoads ?? []) {
    const exactSelected =
      snapshot.selectedObject?.kind === "road" &&
      snapshot.selectedObject.id === snapshot.selected &&
      feature.id === snapshot.selectedObject.id;
    if (
      feature.kind !== "road" ||
      (!exactSelected &&
        !overviewRoadVisible(
          feature,
          snapshot.camera.scale,
          snapshot.lod.policy,
        ))
    )
      continue;
    for (const path of feature.paths)
      for (let i = 1; i < path.length; i++) {
        const d = segmentDistance(point, path[i - 1], path[i]);
        if (
          d <= feature.width / 2 + 8 / snapshot.camera.scale &&
          d < distance
        ) {
          best = feature;
          distance = d;
        }
      }
  }
  return best;
}
