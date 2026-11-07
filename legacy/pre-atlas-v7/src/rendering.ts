import type { MapObject, MapPath, Polygon } from "./model";

export type PathRenderGroup = "ground" | "detail";

/** Keep the overview grid readable without giving up the one-field detail grid. */
export function gridStep(pixelsPerField: number): number {
  return pixelsPerField < 4 ? 10 : pixelsPerField < 8 ? 5 : 1;
}

/** Broad road paths are walkable floor areas; symbolic line paths stay above rooms. */
export function pathRenderGroup(path: Pick<MapPath, "style">): PathRenderGroup {
  return path.style === "road" ? "ground" : "detail";
}

/** The overview shows room geometry first; details appear once they can be read. */
export function compactObjectVisible(
  object: Pick<MapObject, "width" | "height" | "label" | "note">,
  pixelsPerField: number,
): boolean {
  const footprint = Math.max(object.width, object.height) * pixelsPerField;
  return footprint >= (object.label || object.note ? 12 : 9);
}

/** Include a small screen margin to avoid popping while panning. */
export function objectNearViewport(
  object: Pick<MapObject, "x" | "y" | "width" | "height">,
  camera: { x: number; y: number; scale: number },
  viewport: { width: number; height: number },
  margin = 32,
): boolean {
  const radius = Math.hypot(object.width, object.height) * camera.scale / 2,
    x = object.x * camera.scale + camera.x,
    y = object.y * camera.scale + camera.y;
  return (
    x + radius >= -margin &&
    y + radius >= -margin &&
    x - radius <= viewport.width + margin &&
    y - radius <= viewport.height + margin
  );
}

export interface RoomMeasurement {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Maximum exterior width and depth of the room contour, in map fields. */
export function roomMeasurement(room: {
  polygons: readonly Polygon[];
}): RoomMeasurement {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const point of room.polygons.flatMap((polygon) => polygon.outer)) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function fieldMeasurementLabel(value: number): string {
  const rounded = Math.round(value * 100) / 100,
    number = String(rounded).replace(".", ",");
  return `${number} ${rounded === 1 ? "Feld" : "Felder"}`;
}
