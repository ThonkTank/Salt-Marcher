import { MIN_CITY_SCALE, zoomIntoCity } from "./cityView";
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
import {
  hitScene,
  parcelTransform,
  type parcelVisibility,
} from "./parcelEditor";
import type { Tool } from "./editorSelection";
import {
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

export type PlannedAction = { operationId: number; intent: Intent };

type Base = { pointer: number; start: WorldPoint; screen: ScreenPoint };
type Interior = { house: House; floor: number };
export type Gesture = Base &
  (
    | { kind: "pan"; camera: Camera }
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
export function evaluateGesture(
  g: Gesture,
  input: {
    pointer: number;
    point: WorldPoint;
    screen: ScreenPoint;
    snapped: WorldPoint;
    finish: boolean;
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
      const x = Math.min(start[0], end[0]),
        y = Math.min(start[1], end[1]);
      const X = Math.max(start[0], end[0]) + 1,
        Y = Math.max(start[1], end[1]) + 1;
      result.guide = {
        points: (
          [
            [x, y],
            [X, y],
            [X, Y],
            [x, Y],
          ] as LocalPoint[]
        ).map((q) => toWorld(q, g.parcel.frame)),
        closed: true,
      };
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
        const x = Math.min(a[0], end[0]),
          y = Math.min(a[1], end[1]),
          X = Math.max(a[0], end[0]) + 1,
          Y = Math.max(a[1], end[1]) + 1;
        result.guide = {
          points: (
            [
              [x, y],
              [X, y],
              [X, Y],
              [x, Y],
            ] as LocalPoint[]
          ).map((q) => toWorld(q, g.house.transform)),
          closed: true,
        };
      }
    }
  } catch (e) {
    result.error = String(e);
  }
  return result;
}

// A borrowed view of the current controller state and passive App data. This is
// never retained by the input binding or used as another editor state.
export type CanvasInputSnapshot = Readonly<{
  workflow: EditorWorkflow;
  camera: Camera;
  editable: boolean;
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
  | { kind: "planParcel"; key: string | null }
  | { kind: "extend"; end: "start" | "end" }
  | { kind: "beginGesture"; gesture: Gesture; rollback?: EditorDraft | null }
  | { kind: "draft"; draft: EditorDraft }
  | { kind: "intent"; intent: Intent }
  | { kind: "nodeSelection"; value: string | number | null }
  | { kind: "roomSelection"; room: string }
  | { kind: "connectionSelection"; id: string }
  | { kind: "select"; object: MapObject | undefined }
  | { kind: "openHouse"; house: House }
  | { kind: "openParcel"; parcel: Parcel }
  | { kind: "cancelEditor" }
  | { kind: "accept" }
  | { kind: "deleteSelection" }
  | { kind: "history"; redo: boolean }
  | { kind: "document"; kindOfDocument: "save" | "saveAs" }
  | { kind: "floor"; delta: -1 | 1 }
  | { kind: "tool"; value: Tool }
  | { kind: "camera"; camera: Camera };
export type PointerInput = {
  pointer: number;
  button: number;
  point: WorldPoint;
  screen: ScreenPoint;
  alt: boolean;
  space: boolean;
};
export type InputDecision = {
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
    else if (draft?.kind === "newArea" || snapshot.workflow.kind === "populate")
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
    floor,
    room,
    house,
    parcel,
    selectionParcel,
    detail,
    roadWidth,
    material,
    opening,
    travel,
    populateRoad,
    settings,
  } = snapshot;
  const p = input.point,
    interior = context.kind !== "exterior";
  const objects = snapshot.scene?.objects ?? [],
    active = house?.id ?? "";
  const draft = workflowDraft(snapshot.workflow);
  const base = { pointer: input.pointer, start: p, screen: input.screen };
  const begin = (gesture: Gesture, rollback?: EditorDraft | null) =>
    commands.push({ kind: "beginGesture", gesture, rollback });
  const nodeSelection = (value: string | number | null) =>
    commands.push({ kind: "nodeSelection", value });
  const connectionSelection = (id: string) =>
    commands.push({ kind: "connectionSelection", id });
  const roomSelection = (room: string) =>
    commands.push({ kind: "roomSelection", room });
  const intent = (intent: Intent) => commands.push({ kind: "intent", intent });
  if (
    input.button === 1 ||
    input.space ||
    (context.kind === "exterior" && camera.scale < 1.28)
  ) {
    decision.capture = true;
    begin({ ...base, kind: "pan", camera: { ...camera } });
    return decision;
  }
  if (!editable || deletion) return decision;
  decision.capture = true;
  const planning = snapshot.planning;
  if (planning) {
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
    !planning &&
    snapshot.stalePlanParcels?.some((parcel) => hitObject(parcel, p))
  ) {
    decision.capture = false;
    return decision;
  }
  if (tool === "road") {
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
  if (tool === "area") {
    const a: EditorDraft =
      draft?.kind === "newArea"
        ? structuredClone(draft)
        : { kind: "newArea", material, points: [] };
    a.points.push(p);
    commands.push({ kind: "draft", draft: a });
    decision.capture = false;
    return decision;
  }
  if (tool === "select") {
    const editableObject = selectedObject;
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
          return decision;
        }
      }
    }
    if (roadEdit) {
      for (let i = 0; i < roadEdit.nodes.length; i++) {
        const n = roadEdit.nodes[i];
        for (const handle of ["incoming", "outgoing", "point"] as const) {
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
            return decision;
          }
        }
      }
    }
    if (editableObject?.kind === "area") {
      const i = editableObject.points.findIndex(
        (q) => distance(p, q) * camera.scale < 9,
      );
      if (i >= 0) {
        nodeSelection(i);
        begin({
          ...base,
          kind: "areaPoint",
          index: i,
          object: structuredClone(editableObject),
        });
        return decision;
      }
    }
    if (house && detail) {
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
        return decision;
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
        return decision;
      }
    }
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
    if (!interior) commands.push({ kind: "select", object: hit });
    return decision;
  }
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
        kind: "floor",
        delta: key.key === "PageUp" ? 1 : -1,
      });
  }
  if (key.key.toLowerCase() === "v")
    commands.push({ kind: "tool", value: "select" });
  return result;
}
export function decideWheel(
  snapshot: CanvasInputSnapshot,
  point: WorldPoint,
  deltaY: number,
): CanvasCommand[] {
  if (workflowPointer(snapshot.workflow)) return [];
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
  if (context.kind === "exterior" && snapshot.camera.scale < 1.28)
    return [{ kind: "camera", camera: zoomIntoCity(snapshot.camera, point) }];
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
    return [{ kind: "openHouse", house: selectedObject }];
  if (selectedObject?.kind === "parcel" && context.kind === "exterior")
    return [{ kind: "openParcel", parcel: selectedObject }];
  return [];
}

// Move and finish share exactly the same geometry and node-snap evaluation.
export function evaluatePointer(
  snapshot: CanvasInputSnapshot,
  input: Pick<PointerInput, "pointer" | "point" | "screen" | "alt">,
  finish: boolean,
): Evaluation | null {
  const gesture = workflowPointer(snapshot.workflow);
  return gesture
    ? evaluateGesture(gesture, {
        ...input,
        snapped:
          gesture.kind === "node"
            ? snapToRoad(input.point, input.alt, snapshot)
            : input.point,
        finish,
      })
    : null;
}

export function hoverAtPoint(snapshot: CanvasInputSnapshot, point: WorldPoint) {
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
