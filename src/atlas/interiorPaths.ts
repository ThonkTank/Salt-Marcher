import type { Detail } from "./model";
import {
  prepareInterior,
  type CellPreparation,
  type InteriorPreparation,
} from "./interiorPreparation";
export type CellGeometry = {
  fills: Map<string, Path2D>;
  walls: Path2D;
  grid: Path2D;
};
export type InteriorGeometry = {
  main: CellGeometry;
  ghost: CellGeometry;
};
function segments(values: Float64Array): Path2D {
  const path = new Path2D();
  for (let i = 0; i < values.length; i += 4) {
    path.moveTo(values[i], values[i + 1]);
    path.lineTo(values[i + 2], values[i + 3]);
  }
  return path;
}
function cellPaths(value: CellPreparation): CellGeometry {
  const fills = new Map<string, Path2D>();
  for (const { room, rectangles } of value.fills) {
    const path = new Path2D();
    for (let i = 0; i < rectangles.length; i += 4)
      path.rect(
        rectangles[i],
        rectangles[i + 1],
        rectangles[i + 2],
        rectangles[i + 3],
      );
    fills.set(room, path);
  }
  return { fills, walls: segments(value.walls), grid: segments(value.grid) };
}
export function materializeInterior(value: InteriorPreparation) {
  return { main: cellPaths(value.main), ghost: cellPaths(value.ghost) };
}
export function buildInteriorPaths(detail: Detail): InteriorGeometry {
  return materializeInterior(prepareInterior(detail));
}
