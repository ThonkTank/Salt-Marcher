import { atlasPaint, type AtlasPaint } from "./atlas-paint";
import type { LandscapeRecord, LandscapeBox } from "./atlas-landscape";
import {
  territoryOpacity,
  territoryLabelPoint,
  type AtlasRegionLayer,
} from "./atlas-territory";
export function drawTerritories(
  root: AtlasPaint,
  records: LandscapeRecord[],
  box: LandscapeBox,
  mpp: number,
  layers: readonly AtlasRegionLayer[],
  selected?: string,
) {
  const visible = records.filter(
    (r) =>
      r.territory &&
      r.polygons.length &&
      layers.some((l) => l.id === r.territory!.layerId && l.visible) &&
      (r.id === selected || territoryOpacity(r.territory!.prominence, mpp) > 0),
  );
  const labels: { x: number; y: number; w: number; h: number }[] = [];
  for (const r of [...visible].sort(
    (a, b) =>
      (layers.find((l) => l.id === a.territory!.layerId)?.order ?? 0) -
        (layers.find((l) => l.id === b.territory!.layerId)?.order ?? 0) ||
      b.territory!.prominence - a.territory!.prominence ||
      a.id.localeCompare(b.id),
  )) {
    const t = r.territory!,
      opacity = r.id === selected ? 1 : territoryOpacity(t.prominence, mpp);
    root.append(
      atlasPaint("polygons", {
        polygons: r.polygons.map((p) => ({
          outer: p.outer.map((p) => ({ x: p.x - box.x, y: p.y - box.y })),
          holes: p.holes.map((h) =>
            h.map((p) => ({ x: p.x - box.x, y: p.y - box.y })),
          ),
        })),
        opacity,
        pointer: false,
        style: {
          fill: t.fillOpacity ? t.color : null,
          fillOpacity: t.fillOpacity,
          stroke: t.border ? t.color : null,
          lineWidth: mpp * (r.id === selected ? 2 : 1),
          fillRule: "evenodd",
        },
        data: { territoryId: r.id },
      }),
    );
  }
  for (const r of [...visible].sort(
    (a, b) =>
      Number(b.id === selected) - Number(a.id === selected) ||
      b.territory!.prominence - a.territory!.prominence ||
      a.id.localeCompare(b.id),
  )) {
    const t = r.territory!,
      p = territoryLabelPoint(r);
    if (!p) continue;
    const angle = (t.label.angle * Math.PI) / 180,
      w = mpp * t.label.size * r.name.length * 0.65,
      h = mpp * t.label.size * 1.4,
      b = {
        x: p.x,
        y: p.y,
        w: Math.abs(w * Math.cos(angle)) + Math.abs(h * Math.sin(angle)),
        h: Math.abs(w * Math.sin(angle)) + Math.abs(h * Math.cos(angle)),
      };
    if (
      p.x + b.w / 2 < box.x ||
      p.x - b.w / 2 > box.x + box.width ||
      p.y + b.h / 2 < box.y ||
      p.y - b.h / 2 > box.y + box.height ||
      labels.some(
        (a) =>
          Math.abs(a.x - b.x) < (a.w + b.w) / 2 &&
          Math.abs(a.y - b.y) < (a.h + b.h) / 2,
      )
    )
      continue;
    labels.push(b);
    root.append(
      atlasPaint(
        "text",
        {
          x: 0,
          y: 0,
          matrix: [
            Math.cos(angle),
            Math.sin(angle),
            -Math.sin(angle),
            Math.cos(angle),
            p.x - box.x,
            p.y - box.y,
          ],
          opacity: r.id === selected ? 1 : territoryOpacity(t.prominence, mpp),
          pointer: false,
          style: {
            fontSize: t.label.size * mpp,
            textAlign: "center",
            fill: t.color,
            stroke: "#fff9ec",
            lineWidth: 3 * mpp,
          },
          data: { territoryLabel: r.id },
        },
        r.name,
      ),
    );
  }
}
