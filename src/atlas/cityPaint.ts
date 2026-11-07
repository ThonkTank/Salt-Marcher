import { visibleRasterTile } from "./rasterVisibility";
import type { LodDecision } from "./lod";
import { overviewRoadVisible, type CityView } from "./cityView";
import type { MapFeature } from "./generated/MapFeature";
export function paintCity(
  c: CanvasRenderingContext2D,
  view: CityView,
  features: readonly MapFeature[],
  scale: number,
  policy: LodDecision["policy"],
  exactRoadId?: string,
  paintWater?: () => void,
): void {
  const cell = 16 * 2 ** view.level;
  const path = (f: MapFeature) => {
    c.beginPath();
    for (const ring of f.paths) {
      ring.forEach((p, i) => (i ? c.lineTo(...p) : c.moveTo(...p)));
      if (f.kind !== "road") c.closePath();
    }
  };
  for (const f of features
    .filter((f) => f.kind === "area")
    .sort((a, b) => a.rank - b.rank)) {
    path(f);
    c.save();
    c.globalAlpha = paintWater && f.color !== "#91bcc5" ? 0.55 : 1;
    c.fillStyle = f.color;
    c.fill("evenodd");
    c.restore();
  }
  for (const f of features.filter((f) => f.kind === "scenery")) {
    path(f);
    c.fillStyle = f.color;
    c.fill();
  }
  paintWater?.();
  c.save();
  c.fillStyle = "#a19586";
  const transform = c.getTransform();
  for (const tile of view.tiles) {
    if (!visibleRasterTile(tile, 32 * cell, transform, c.canvas)) continue;
    for (const [x, y, mass] of tile.density) {
      if (mass <= 0) continue;
      c.globalAlpha = Math.min(0.75, 0.12 + Math.sqrt(mass) * 0.63);
      c.fillRect(
        (tile.x * 32 + x) * cell,
        (tile.y * 32 + y) * cell,
        cell,
        cell,
      );
    }
  }
  c.restore();
  for (const kind of ["road", "house"]) {
    for (const f of features) {
      if (f.kind !== kind || (kind === "road" && f.id === exactRoadId))
        continue;
      if (kind === "house" && (!policy.roofs || Math.sqrt(f.rank) * scale < 6))
        continue;
      if (kind === "road" && !overviewRoadVisible(f, scale, policy)) continue;
      path(f);
      if (kind === "road") {
        c.strokeStyle = f.color;
        c.lineWidth = Math.max(f.width, 2 / scale);
        c.lineJoin = "round";
        c.lineCap = "round";
        c.stroke();
      } else {
        c.fillStyle = f.color;
        c.fill("evenodd");
        if (policy.buildingNames) {
          c.strokeStyle = "#514c43";
          c.lineWidth = 0.7 / scale;
          c.stroke();
        }
      }
    }
  }
}
