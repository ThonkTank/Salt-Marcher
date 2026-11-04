import type { RoadRoughness } from "./generated/RoadRoughness";
import type {
  Area,
  AreaInput,
  CurveNodeInput,
  ExistingNodeInput,
  Intent,
  PopulationSettings,
  Road,
  RoadEditInput,
  RoadProperties,
  WorldPoint,
} from "./model";

export type NewRoadDraft = RoadProperties & {
  kind: "newRoad";
  roughness?: RoadRoughness;
  nodes: CurveNodeInput[];
  population: PopulationSettings | null;
};
export type RoadExtensionDraft = {
  kind: "extendRoad";
  roughness?: RoadRoughness;
  roadId: string;
  end: "start" | "end";
  anchor: CurveNodeInput;
  nodes: CurveNodeInput[];
  width: number;
  material: Road["material"];
  population: PopulationSettings | null;
};
export type RoadEditDraft = RoadProperties & {
  kind: "editRoad";
  roadId: string;
  nodes: ExistingNodeInput[];
};
export type DrawingRoadDraft = NewRoadDraft | RoadExtensionDraft;
export type RoadDraft = DrawingRoadDraft | RoadEditDraft;
export type AreaDraft =
  | { kind: "newArea"; material: string; points: WorldPoint[] }
  | {
      kind: "editArea";
      areaId: string;
      material: string;
      points: WorldPoint[];
    };
export type EditorDraft = RoadDraft | AreaDraft;
export type RoadOverlayGeometry = {
  kind: "road";
  width: number;
  material: Road["material"];
  nodes: Omit<CurveNodeInput, "id">[];
};
export type DraftGeometry =
  | RoadOverlayGeometry
  | { kind: "area"; material: string; points: WorldPoint[] };
const copyPoint = (p: WorldPoint): WorldPoint => [p[0], p[1]];
const nodeInput = ({
  point,
  incoming,
  outgoing,
}: Omit<CurveNodeInput, "id">): CurveNodeInput => ({
  point: copyPoint(point),
  incoming: incoming ? copyPoint(incoming) : null,
  outgoing: outgoing ? copyPoint(outgoing) : null,
});
export const newRoadDraft = (
  properties: RoadProperties,
  population: PopulationSettings | null = null,
): NewRoadDraft => ({
  kind: "newRoad",
  name: properties.name,
  width: properties.width,
  material: properties.material,
  nodes: [],
  population: structuredClone(population),
});
export const editRoadDraft = (road: Road | RoadEditDraft): RoadEditDraft => ({
  kind: "editRoad",
  roadId: road.kind === "editRoad" ? road.roadId : road.id,
  ...roadEditInput(road),
});
export function extensionRoadDraft(
  road: Road,
  end: "start" | "end",
  population: PopulationSettings | null,
): RoadExtensionDraft {
  const index = end === "start" ? 0 : road.nodes.length - 1;
  const endpoint = road.nodes[index];
  const inner = end === "start" ? endpoint.outgoing : endpoint.incoming;
  const other = road.nodes[end === "start" ? 1 : index - 1].point;
  const tangent: WorldPoint = inner
    ? [2 * endpoint.point[0] - inner[0], 2 * endpoint.point[1] - inner[1]]
    : [
        endpoint.point[0] + (endpoint.point[0] - other[0]) / 3,
        endpoint.point[1] + (endpoint.point[1] - other[1]) / 3,
      ];
  return {
    kind: "extendRoad",
    roadId: road.id,
    end,
    width: road.width,
    material: road.material,
    anchor: nodeInput({
      point: endpoint.point,
      incoming: null,
      outgoing:
        (end === "start" ? endpoint.incoming : endpoint.outgoing) ?? tangent,
    }),
    nodes: [],
    population: structuredClone(population),
  };
}
export function roadEditInput(
  road: RoadProperties & { nodes: ExistingNodeInput[] },
): RoadEditInput {
  return {
    name: road.name,
    width: road.width,
    material: road.material,
    nodes: road.nodes.map((n) => ({ id: n.id, ...nodeInput(n) })),
  };
}
export const areaInput = (area: {
  material: string;
  points: WorldPoint[];
}): AreaInput => ({
  material: area.material,
  points: area.points.map(copyPoint),
});
export const editAreaDraft = (area: Area): AreaDraft => ({
  kind: "editArea",
  areaId: area.id,
  ...areaInput(area),
});
export function drawingNodes(draft: DrawingRoadDraft): CurveNodeInput[] {
  return draft.kind === "extendRoad"
    ? [draft.anchor, ...draft.nodes]
    : draft.nodes;
}
export function toRoadIntent(draft: RoadDraft): Intent | null {
  if (draft.kind === "editRoad")
    return draft.nodes.length >= 2
      ? { type: "updateRoad", roadId: draft.roadId, road: roadEditInput(draft) }
      : null;
  if (draft.kind === "newRoad")
    return draft.nodes.length >= 2
      ? {
          type: "createRoad",
          roughness: draft.roughness,
          road: {
            name: draft.name,
            width: draft.width,
            material: draft.material,
            nodes: draft.nodes.map(nodeInput),
          },
          population: structuredClone(draft.population),
        }
      : null;
  if (!draft.nodes.length) return null;
  const nodes = draft.nodes.map(nodeInput);
  return {
    type: "extendRoad",
    roughness: draft.roughness,
    roadId: draft.roadId,
    end: draft.end,
    nodes:
      draft.end === "end"
        ? nodes
        : nodes.reverse().map((n) => ({
            point: n.point,
            incoming: n.outgoing,
            outgoing: n.incoming,
          })),
    endpointHandle: draft.anchor.outgoing
      ? copyPoint(draft.anchor.outgoing)
      : null,
    population: structuredClone(draft.population),
  };
}
export function toDraftIntent(draft: EditorDraft): Intent | null {
  if (draft.kind === "newArea" || draft.kind === "editArea")
    return draft.points.length < 3
      ? null
      : draft.kind === "newArea"
        ? { type: "createArea", area: areaInput(draft) }
        : { type: "updateArea", areaId: draft.areaId, area: areaInput(draft) };
  return toRoadIntent(draft);
}
export function roadDraftGeometry(draft: RoadDraft): RoadOverlayGeometry {
  return {
    kind: "road",
    width: draft.width,
    material: draft.material,
    nodes: (draft.kind === "extendRoad"
      ? [draft.anchor, ...draft.nodes]
      : draft.nodes
    ).map(nodeInput),
  };
}
export const draftGeometry = (draft: EditorDraft): DraftGeometry =>
  draft.kind === "newArea" || draft.kind === "editArea"
    ? { kind: "area", ...areaInput(draft) }
    : roadDraftGeometry(draft);

export function changeRoadProperties(
  road: Road | RoadEditDraft,
  properties: Partial<RoadProperties>,
): RoadEditDraft {
  return { ...editRoadDraft(road), ...properties };
}

export function setRoadHandles(
  road: Road | RoadEditDraft,
  nodeId: string,
  curved: boolean,
): RoadEditDraft {
  const draft = editRoadDraft(road);
  const index = draft.nodes.findIndex((node) => node.id === nodeId);
  if (index < 0) return draft;
  const node = draft.nodes[index];
  const a = draft.nodes[Math.max(0, index - 1)].point;
  const b = draft.nodes[Math.min(draft.nodes.length - 1, index + 1)].point;
  const dx = (b[0] - a[0]) / 6,
    dy = (b[1] - a[1]) / 6;
  node.incoming = curved ? [node.point[0] - dx, node.point[1] - dy] : null;
  node.outgoing = curved ? [node.point[0] + dx, node.point[1] + dy] : null;
  return draft;
}

export function moveRoadNode(
  road: Road | RoadEditDraft,
  index: number,
  handle: "point" | "incoming" | "outgoing",
  point: WorldPoint,
): RoadEditDraft {
  const draft = editRoadDraft(road),
    node = draft.nodes[index];
  if (handle === "point") {
    const dx = point[0] - node.point[0],
      dy = point[1] - node.point[1];
    node.point = copyPoint(point);
    if (node.incoming)
      node.incoming = [node.incoming[0] + dx, node.incoming[1] + dy];
    if (node.outgoing)
      node.outgoing = [node.outgoing[0] + dx, node.outgoing[1] + dy];
  } else node[handle] = copyPoint(point);
  return draft;
}

/** Centripetal Catmull–Rom interpolant, represented by the persisted cubic nodes. */
export function smoothRoadDraft<T extends DrawingRoadDraft>(draft: T): T {
  const result = structuredClone(draft);
  const nodes = drawingNodes(result);
  const points = nodes.map((n) => n.point);
  if (nodes.length < 2) return result;
  for (const node of nodes) {
    node.incoming = null;
    node.outgoing = null;
  }
  for (let i = 0; i < points.length - 1; i++) {
    const b = points[i],
      c = points[i + 1];
    const a: WorldPoint = points[i - 1] ?? [2 * b[0] - c[0], 2 * b[1] - c[1]];
    const d: WorldPoint = points[i + 2] ?? [2 * c[0] - b[0], 2 * c[1] - b[1]];
    const dt = (u: WorldPoint, v: WorldPoint) =>
      Math.max(1e-6, Math.sqrt(Math.hypot(u[0] - v[0], u[1] - v[1])));
    const ab = dt(a, b),
      bc = dt(b, c),
      cd = dt(c, d);
    const m1 = [0, 1].map(
      (k) =>
        bc *
        ((b[k] - a[k]) / ab - (c[k] - a[k]) / (ab + bc) + (c[k] - b[k]) / bc),
    );
    const m2 = [0, 1].map(
      (k) =>
        bc *
        ((c[k] - b[k]) / bc - (d[k] - b[k]) / (bc + cd) + (d[k] - c[k]) / cd),
    );
    nodes[i].outgoing = [b[0] + m1[0] / 3, b[1] + m1[1] / 3];
    nodes[i + 1].incoming = [c[0] - m2[0] / 3, c[1] - m2[1] / 3];
  }
  if (
    result.kind === "extendRoad" &&
    draft.kind === "extendRoad" &&
    draft.anchor.outgoing
  ) {
    const a = result.anchor.point,
      h = draft.anchor.outgoing;
    const length = Math.hypot(points[1][0] - a[0], points[1][1] - a[1]) / 3;
    const norm = Math.hypot(h[0] - a[0], h[1] - a[1]);
    if (norm > 1e-8)
      result.anchor.outgoing = [
        a[0] + ((h[0] - a[0]) * length) / norm,
        a[1] + ((h[1] - a[1]) * length) / norm,
      ];
  }
  return result;
}
