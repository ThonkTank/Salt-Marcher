import { riverDisplay } from "./riverView";
import type { RiverView } from "./generated/RiverView";
import type { Region } from "./generated/Region";
import { sameVersion } from "./documentVersion";
import { overviewFeatures, sceneFeatures } from "./cityView";
import type { Presentation } from "./presentationLoader";
import type { MapObject, Preview } from "./model";

/** Pure scene preparation: no DOM, canvas resources, reads or editor mutations. */
export function prepareCanvasScene(
  presentation: Presentation | null,
  preview: Preview | null,
  selected: string,
  visibility: { boundaries: string[]; grids: string[] },
  landscape: { rivers?: RiverView[]; regions?: Region[] } = {},
) {
  const objects = presentation?.scene.objects ?? [];
  const terrainPreview = preview?.valid ? preview.terrain : undefined;
  const base = presentation?.terrain;
  const proposed = terrainPreview?.surface;
  const terrain =
    proposed &&
    base &&
    proposed.level === base.level &&
    sameVersion(proposed.status, base.status)
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
  const groundBase = presentation?.ground;
  const groundPreview = preview?.valid ? preview.ground : undefined;
  const groundCandidate =
    groundBase &&
    groundPreview &&
    groundBase.level === groundPreview.level &&
    sameVersion(groundBase.status, groundPreview.status)
      ? {
          ...groundBase,
          tiles: groundBase.tiles.map(
            (tile) =>
              groundPreview.tiles.find(
                (p) => p.x === tile.x && p.y === tile.y,
              ) ?? tile,
          ),
        }
      : (groundBase ?? groundPreview);
  const ground =
    groundCandidate &&
    terrain &&
    !sameVersion(groundCandidate.status, terrain.status)
      ? undefined
      : groundCandidate;
  const landscapeBase = presentation?.landscape;
  const landscapePreview = preview?.valid ? preview.landscape : undefined;
  const landscapeCandidate =
    landscapeBase &&
    landscapePreview &&
    landscapeBase.level === landscapePreview.level &&
    sameVersion(landscapeBase.status, landscapePreview.status)
      ? {
          ...landscapeBase,
          tiles: landscapeBase.tiles.map(
            (tile) =>
              landscapePreview.tiles.find(
                (p) => p.x === tile.x && p.y === tile.y,
              ) ?? tile,
          ),
        }
      : (landscapeBase ?? landscapePreview);
  const landscapeView =
    landscapeCandidate &&
    terrain &&
    !sameVersion(landscapeCandidate.status, terrain.status)
      ? undefined
      : landscapeCandidate;
  const visibleBoundaries = new Set(visibility.boundaries);
  const kinds = presentation?.overview
    ? ["road"]
    : ["area", "scenery", "parcel", "road", "house"];
  const layers = kinds.map((kind) => ({
    kind,
    objects: objects
      .filter(
        (o) =>
          o.kind === kind &&
          (o.kind !== "parcel" || visibleBoundaries.has(o.id)),
      )
      .sort((a, b) =>
        a.kind === "area" && b.kind === "area" ? a.order - b.order : 0,
      ),
  }));
  const selectedObject = objects.find((o) => o.id === selected);
  const cityFeatures = presentation?.overview
    ? overviewFeatures(presentation.overview)
    : [];
  const features = !presentation
    ? []
    : presentation.overview
      ? [
          ...cityFeatures.filter((f) => f.id !== selected),
          ...sceneFeatures(presentation.scene).filter((f) => f.id === selected),
        ]
      : sceneFeatures(presentation.scene);
  const regions = (landscape.regions ?? []).map(
    (region) =>
      (preview?.valid
        ? preview.regions?.find((next) => next.id === region.id)
        : null) ?? region,
  );
  const rivers = riverDisplay(
    landscape.rivers ?? [],
    preview?.valid ? preview.rivers : null,
  );
  const waters = [
    ...new Map(
      terrain?.tiles
        .flatMap((tile) => tile.waters ?? [])
        .map((water) => [water.id, water]) ?? [],
    ).values(),
  ];
  return {
    regions,
    rivers,
    waters,
    ground,
    landscape: landscapeView,
    terrain,
    terrainPreview: terrainPreview?.surface ? undefined : terrainPreview,
    foundationTops: new Map(
      terrain?.tiles.flatMap((t) => t.foundationTops ?? []) ?? [],
    ),
    layers,
    selectedObject:
      selectedObject &&
      (selectedObject.kind !== "parcel" ||
        visibleBoundaries.has(selectedObject.id))
        ? selectedObject
        : undefined,
    selectedRoad: objects.some((o) => o.kind === "road" && o.id === selected)
      ? selected
      : undefined,
    grids: objects.filter(
      (o): o is Extract<MapObject, { kind: "parcel" }> =>
        o.kind === "parcel" && visibility.grids.includes(o.id),
    ),
    cityFeatures,
    features: features.filter((f) => f.id !== presentation?.detail?.buildingId),
  };
}
