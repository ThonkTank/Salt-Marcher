import { containsPolygon } from "./model";
import type { Region } from "./generated/Region";
import type { RegionResponse } from "./generated/RegionResponse";
import type { RegionCatalog } from "./generated/RegionCatalog";
import type { RegionSummary } from "./generated/RegionSummary";
import type { Bounds, Camera, WorldPoint } from "./model";
export function displayedRegions(
  regions: Region[],
  catalog: RegionCatalog | undefined,
  shown: string[],
): Region[] {
  const categories = new Map(
    catalog?.categories.map((category, index) => [category.id, index]),
  );
  const order = new Map(
    catalog?.ranks.map((rank) => [
      rank.id,
      categories.get(rank.categoryId) ?? -1,
    ]),
  );
  return regions
    .filter((region) => shown.includes(region.rankId))
    .sort(
      (a, b) =>
        (order.get(a.rankId) ?? 0) - (order.get(b.rankId) ?? 0) ||
        a.id.localeCompare(b.id),
    );
}

export function visibleRanks(
  c: RegionCatalog,
  s: RegionSummary[],
  scale: number,
  prior: Map<string, string>,
  editing?: string,
): string[] {
  const result: string[] = [];
  for (const cat of c.categories) {
    const ranks = c.ranks.filter((r) => r.categoryId === cat.id);
    if (editing && ranks.some((r) => r.id === editing)) {
      result.push(editing);
      continue;
    }
    if (!cat.visible) continue;
    if (cat.fixedRank) {
      result.push(cat.fixedRank);
      continue;
    }
    if (cat.markers) {
      result.push(...ranks.map((r) => r.id));
      continue;
    }
    const scores = ranks
      .map((r) => {
        const sizes = s
          .filter((x) => x.rankId === r.id && x.area > 0)
          .map((x) => Math.sqrt(x.area))
          .sort((a, b) => a - b);
        return {
          id: r.id,
          score: sizes.length
            ? Math.abs(
                Math.log((sizes[Math.floor(sizes.length / 2)] * scale) / 400),
              )
            : Infinity,
        };
      })
      .filter((x) => Number.isFinite(x.score))
      .sort((a, b) => a.score - b.score);
    const best = scores[0];
    if (!best) continue;
    const previous = scores.find((x) => x.id === prior.get(cat.id));
    const id =
      previous && previous.score <= best.score + Math.log(1.2)
        ? previous.id
        : best.id;
    prior.set(cat.id, id);
    result.push(id);
  }
  return result;
}
export function hitRegion(
  regions: Region[],
  p: WorldPoint,
): Region | undefined {
  return regions.find((r) =>
    r.polygons.some((poly) => containsPolygon(poly, p)),
  );
}
export function paintRegions(
  c: CanvasRenderingContext2D,
  regions: Region[],
  scale: number,
  fill: boolean,
  selected: string,
) {
  for (const r of regions) {
    c.save();
    c.beginPath();
    for (const p of r.polygons)
      for (const ring of [p.outer, ...p.holes]) {
        ring.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
        c.closePath();
      }
    if (fill) {
      c.globalAlpha = r.style.opacity;
      c.fillStyle = r.style.color;
      c.fill("evenodd");
    } else {
      c.strokeStyle = r.id === selected ? "#ffe397" : r.style.color;
      c.lineWidth = (r.style.width + (r.id === selected ? 1 : 0)) / scale;
      c.setLineDash(
        (r.style.dash === "dashed"
          ? [8, 5]
          : r.style.dash === "dotted"
            ? [1, 4]
            : []
        ).map((n) => n / scale),
      );
      c.stroke();
    }
    c.restore();
  }
}
export type RegionName = {
  id: string;
  name: string;
  x: number;
  y: number;
  size: number;
  box: Bounds;
  marker?: [number, number];
};
export function regionNameCandidates(
  c: CanvasRenderingContext2D,
  regions: Region[],
  summaries: RegionResponse["summaries"],
  camera: Camera,
  width: number,
  height: number,
  markerRanks: string[] = [],
): RegionName[] {
  const byId = new Map(summaries.map((s) => [s.id, s]));
  const result: RegionName[] = [];
  for (const r of [...regions].sort(
    (a, b) =>
      (byId.get(b.id)?.area ?? 0) - (byId.get(a.id)?.area ?? 0) ||
      a.id.localeCompare(b.id),
  )) {
    const s = byId.get(r.id);
    const markers = markerRanks.includes(r.rankId);
    if (!s || (s.area <= 0 && !(markers && r.label.anchor))) continue;
    const projected = Math.sqrt(s.area) * camera.scale;
    if (
      camera.scale <
        (r.label.minScale ?? (markers ? 0 : 80 / Math.sqrt(s.area))) ||
      camera.scale >
        (r.label.maxScale ?? (s.area > 0 ? 1400 / Math.sqrt(s.area) : Infinity))
    )
      continue;
    const a = r.label.anchor ?? s.anchor;
    const marker = markers && projected < 80;
    const x = camera.x + a[0] * camera.scale,
      anchorY = camera.y + a[1] * camera.scale,
      y = anchorY - (marker ? 14 : 0),
      size = marker ? 13 : Math.max(14, Math.min(28, 14 + projected / 100));
    // Even a zero-width label cannot fit if its anchor/vertical extent is out
    // of view. Avoid measuring and truncating those names during navigation.
    if (
      x < 4 ||
      x > width - 4 ||
      y - size / 2 - 4 < 4 ||
      (marker ? anchorY + 5 : y + size / 2 + 4) > height - 4
    )
      continue;
    c.font = `${size}px system-ui, sans-serif`;
    let name = r.name;
    while (name.length > 1 && c.measureText(name).width > 300)
      name = name.slice(0, -2) + "…";
    const w = c.measureText(name).width + 12;
    const box: Bounds = [
      x - w / 2,
      y - size / 2 - 4,
      x + w / 2,
      marker ? anchorY + 5 : y + size / 2 + 4,
    ];
    if (box[0] < 4 || box[1] < 4 || box[2] > width - 4 || box[3] > height - 4)
      continue;
    result.push({
      id: r.id,
      name,
      x,
      y,
      size,
      box,
      marker: marker ? [x, anchorY] : undefined,
    });
  }
  return result;
}
/** Standalone region layout, used by callers that do not have map features. */
export function regionNames(
  c: CanvasRenderingContext2D,
  regions: Region[],
  summaries: RegionResponse["summaries"],
  camera: Camera,
  width: number,
  height: number,
  obstacles: Bounds[],
  limit = 500,
  markerRanks: string[] = [],
): RegionName[] {
  const result: RegionName[] = [];
  const collide = (a: Bounds, b: Bounds) =>
    a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
  for (const name of regionNameCandidates(
    c,
    regions,
    summaries,
    camera,
    width,
    height,
    markerRanks,
  )) {
    if (result.length >= limit) break;
    if (
      [...obstacles, ...result.map((r) => r.box)].some((box) =>
        collide(box, name.box),
      )
    )
      continue;
    result.push(name);
  }
  return result;
}
export function paintRegionNames(
  c: CanvasRenderingContext2D,
  names: RegionName[],
) {
  c.save();
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.lineJoin = "round";
  for (const n of names) {
    c.font = `${n.size}px system-ui, sans-serif`;
    c.lineWidth = 4;
    c.strokeStyle = "#f8f3e6";
    c.strokeText(n.name, n.x, n.y);
    c.fillStyle = "#39372f";
    c.fillText(n.name, n.x, n.y);
    if (n.marker) {
      c.beginPath();
      c.arc(...n.marker, 3, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.restore();
}
