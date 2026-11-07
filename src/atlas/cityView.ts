import {
  tileRequest,
  MIN_WORLD_SCALE,
  DETAIL_SCALE,
  viewScale,
  zoomAt,
} from "./lod";
import type { LodDecision } from "./lod";
import type { Bounds, Camera, Scene } from "./model";
import type { MapFeature } from "./generated/MapFeature";
import type { MapTile } from "./generated/MapTile";
import { toWorld } from "./model";

export const MIN_CITY_SCALE = MIN_WORLD_SCALE;
export const EDIT_SCALE = DETAIL_SCALE;
export type CityView = { level: number; tiles: MapTile[] };
export function overviewRoadVisible(
  feature: MapFeature,
  scale: number,
  policy: LodDecision["policy"],
): boolean {
  return (
    feature.kind === "road" &&
    feature.width >= policy.minRoadWidth &&
    (feature.rank / Math.max(1, feature.width)) * scale >= 8
  );
}
export function cityRequest(bounds: Bounds, level: number) {
  return tileRequest(bounds, level, 512, 20);
}
export function sceneFeatures(scene: Scene): MapFeature[] {
  return scene.objects.flatMap((o): MapFeature[] => {
    if (o.kind === "house") {
      const paths = o.contours.map((r) =>
        r.map((p) => toWorld(p, o.transform)),
      );
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const ring of paths)
        for (const p of ring) {
          minX = Math.min(minX, p[0]);
          minY = Math.min(minY, p[1]);
          maxX = Math.max(maxX, p[0]);
          maxY = Math.max(maxY, p[1]);
        }
      const rank = Number.isFinite(minX) ? (maxX - minX) * (maxY - minY) : 0;
      return [
        {
          id: o.id,
          kind: "house",
          name: o.name,
          important: o.importantPlace,
          paths,
          color: o.roof,
          width: 0,
          rank,
        },
      ];
    }
    if (o.kind === "road")
      return [
        {
          id: o.id,
          kind: "road",
          name: o.name,
          important: false,
          paths: [o.path],
          color: "",
          width: o.width,
          rank:
            o.width *
            o.path.reduce(
              (sum, p, i) =>
                i
                  ? sum +
                    Math.hypot(p[0] - o.path[i - 1][0], p[1] - o.path[i - 1][1])
                  : 0,
              0,
            ),
        },
      ];
    return [];
  });
}
export function overviewFeatures(view: CityView): MapFeature[] {
  return [
    ...new Map(
      view.tiles.flatMap((tile) => tile.features).map((f) => [f.id, f]),
    ).values(),
  ];
}
export function zoomIntoCity(
  camera: Camera,
  point: [number, number],
  level: number,
): Camera {
  const scale = Math.min(EDIT_SCALE, viewScale(Math.max(2, level - 1)));
  return zoomAt(camera, point, Math.max(camera.scale, scale));
}
