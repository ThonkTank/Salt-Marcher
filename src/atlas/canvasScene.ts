import { overviewFeatures, sceneFeatures } from "./cityView";
import type { Presentation } from "./presentationLoader";
import type { MapObject, Preview } from "./model";

/** Pure scene preparation: no DOM, canvas resources, reads or editor mutations. */
export function prepareCanvasScene(
  presentation: Presentation | null,
  preview: Preview | null,
  selected: string,
  visibility: { boundaries: string[]; grids: string[] },
) {
  const objects = presentation?.scene.objects ?? [];
  const terrainPreview = preview?.valid ? preview.terrain : undefined;
  const base = presentation?.terrain;
  const proposed = terrainPreview?.surface;
  const terrain =
    proposed && base && proposed.level === base.level
      ? {
          ...proposed,
          tiles: [
            ...base.tiles.filter(
              (t) => !proposed.tiles.some((p) => p.x === t.x && p.y === t.y),
            ),
            ...proposed.tiles,
          ],
        }
      : (proposed ?? base);
  const kinds = presentation?.overview
    ? ["road"]
    : ["area", "scenery", "parcel", "road", "house"];
  const layers = kinds.map((kind) => ({
    kind,
    objects: objects
      .filter(
        (o) =>
          o.kind === kind &&
          (o.kind !== "parcel" || visibility.boundaries.includes(o.id)),
      )
      .sort((a, b) =>
        a.kind === "area" && b.kind === "area" ? a.order - b.order : 0,
      ),
  }));
  const selectedObject = objects.find((o) => o.id === selected);
  const features = !presentation
    ? []
    : presentation.overview
      ? [
          ...overviewFeatures(presentation.overview).filter(
            (f) => f.id !== selected,
          ),
          ...sceneFeatures(presentation.scene).filter((f) => f.id === selected),
        ]
      : sceneFeatures(presentation.scene);
  return {
    terrain,
    terrainPreview: terrainPreview?.surface ? undefined : terrainPreview,
    foundationTops: new Map(
      terrain?.tiles.flatMap((t) => t.foundationTops ?? []) ?? [],
    ),
    layers,
    selectedObject:
      selectedObject &&
      (selectedObject.kind !== "parcel" ||
        visibility.boundaries.includes(selectedObject.id))
        ? selectedObject
        : undefined,
    selectedRoad: objects.some((o) => o.kind === "road" && o.id === selected)
      ? selected
      : undefined,
    grids: objects.filter(
      (o): o is Extract<MapObject, { kind: "parcel" }> =>
        o.kind === "parcel" && visibility.grids.includes(o.id),
    ),
    features: features.filter((f) => f.id !== presentation?.detail?.buildingId),
  };
}
