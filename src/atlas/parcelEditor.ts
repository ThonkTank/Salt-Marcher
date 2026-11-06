import {
  hitObject,
  toWorld,
  toLocal,
  type Bounds,
  type EditorContext,
  type GridPose,
  type House,
  type MapObject,
  type Parcel,
  type Scene,
  type Transform,
  type WorldPoint,
} from "./model";

export const contextKey = (context: EditorContext) =>
  context.kind === "exterior"
    ? "exterior"
    : context.kind === "house"
      ? `house:${context.houseId}`
      : `parcel:${context.parcelId}`;

export function polygonBounds(points: [number, number][]): Bounds | null {
  if (!points.length) return null;
  return points.reduce<Bounds>(
    (b, p) => [
      Math.min(b[0], p[0]),
      Math.min(b[1], p[1]),
      Math.max(b[2], p[0]),
      Math.max(b[3], p[1]),
    ],
    [Infinity, Infinity, -Infinity, -Infinity],
  );
}

export function parcelTransform(frame: Transform, pose: GridPose): Transform {
  const [x, y] = toWorld([pose.xCells, pose.yCells], frame);
  return { x, y, angle: frame.angle + (pose.quarterTurns * Math.PI) / 2 };
}

export function rotateParcelHouse(
  house: House,
  parcel: Parcel,
  delta: -1 | 1,
): Transform {
  if (house.placement.kind !== "parcel") return house.transform;
  return parcelTransform(parcel.frame, {
    ...house.placement.gridPose,
    quarterTurns: ((house.placement.gridPose.quarterTurns + delta + 4) %
      4) as GridPose["quarterTurns"],
  });
}

// Ownership is resolved exclusively by scene's revision-coherent states. These
// IDs may refer to objects outside the viewport; visible geometry is no proxy.
export function resolvedParcel(
  scene: Scene,
  which: "context" | "selection",
): Parcel | undefined {
  const state = which === "context" ? scene.contextState : scene.selectionState;
  return scene.objects.find(
    (o): o is Parcel => o.kind === "parcel" && o.id === state.parcelId,
  );
}

export function parcelVisibility(
  scene: Scene | undefined,
  context: EditorContext,
  tool: string,
): {
  boundaries: string[];
  grids: string[];
} {
  if (!scene) return { boundaries: [], grids: [] };
  const grids = [
    ...new Set(
      [scene.contextState.parcelId, scene.selectionState.parcelId].filter(
        (id): id is string => !!id,
      ),
    ),
  ];
  return {
    boundaries:
      tool === "road" ||
      tool === "house" ||
      (tool === "select" && context.kind === "exterior")
        ? scene.objects.filter((o) => o.kind === "parcel").map((o) => o.id)
        : grids,
    grids:
      context.kind === "exterior" && !scene.selectionState.exists ? [] : grids,
  };
}

export function hitScene(
  objects: MapObject[],
  p: WorldPoint,
  tolerance: number,
  visibleParcels: string[],
): MapObject | undefined {
  const visibleParcelIds = new Set(visibleParcels);
  for (const kind of ["house", "road", "parcel", "scenery", "area"] as const) {
    const candidates = objects.filter(
      (o) =>
        o.kind === kind && (o.kind !== "parcel" || visibleParcelIds.has(o.id)),
    );
    if (kind === "area")
      candidates.sort((a, b) =>
        a.kind === "area" && b.kind === "area"
          ? (a.order ?? 0) - (b.order ?? 0)
          : 0,
      );
    const hit = candidates.reverse().find((o) => hitObject(o, p, tolerance));
    if (hit) return hit;
  }
  return undefined;
}

// Bounds restrict generation before clipping; low zoom never builds huge grids.
export function parcelGridRange(
  parcel: Parcel,
  viewport: Bounds,
  scale: number,
): Bounds | null {
  if (5 * scale < 4) return null;
  const localParcel = polygonBounds(
    parcel.polygon.map((p) => toLocal(p, parcel.frame)),
  );
  const localView = polygonBounds(
    (
      [
        [viewport[0], viewport[1]],
        [viewport[2], viewport[1]],
        [viewport[2], viewport[3]],
        [viewport[0], viewport[3]],
      ] as WorldPoint[]
    ).map((p) => toLocal(p, parcel.frame)),
  );
  if (!localParcel || !localView) return null;
  const range: Bounds = [
    Math.max(localParcel[0], localView[0]),
    Math.max(localParcel[1], localView[1]),
    Math.min(localParcel[2], localView[2]),
    Math.min(localParcel[3], localView[3]),
  ];
  return range[0] <= range[2] && range[1] <= range[3] ? range : null;
}
