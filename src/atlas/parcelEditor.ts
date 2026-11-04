import {
  hitObject,
  toWorld,
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
  for (const kind of ["house", "road", "parcel", "area"] as const) {
    const candidates = objects.filter(
      (o) =>
        o.kind === kind &&
        (o.kind !== "parcel" || visibleParcels.includes(o.id)),
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
