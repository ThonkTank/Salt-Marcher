import type { Bounds, Camera, Scene } from "./model";
import type { MapFeature } from "./generated/MapFeature";
import type { MapTile } from "./generated/MapTile";
import { toWorld } from "./model";

export const MIN_CITY_SCALE = 0.000064;
export const EDIT_SCALE = 1.28;
export type CityView = { level: number; tiles: MapTile[] };
export function cityLevel(scale: number, previous?: number) {
  const ideal = Math.max(0, Math.min(20, Math.floor(Math.log2(1 / scale))));
  if (previous !== undefined) {
    const pixels = 16 * 2 ** previous * scale;
    if (pixels >= 7.2 && pixels <= 17.6) return previous;
  }
  return ideal;
}
export function cityTiles(bounds: Bounds, level: number): [number, number][] {
  const size = 512 * 2 ** level;
  const result: [number, number][] = [];
  for (
    let x = Math.floor(bounds[0] / size);
    x <= Math.floor(bounds[2] / size);
    x++
  )
    for (
      let y = Math.floor(bounds[1] / size);
      y <= Math.floor(bounds[3] / size);
      y++
    )
      result.push([x, y]);
  return result;
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
export function zoomIntoCity(camera: Camera, point: [number, number]): Camera {
  const scale =
    camera.scale < 0.064 ? 0.064 : camera.scale < 0.32 ? 0.32 : EDIT_SCALE;
  return {
    scale,
    x: camera.x + point[0] * (camera.scale - scale),
    y: camera.y + point[1] * (camera.scale - scale),
  };
}
