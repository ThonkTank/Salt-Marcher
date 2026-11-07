import type { RegionName } from "./regionView";
import type { LodDecision } from "./lod";
import type { MapFeature } from "./generated/MapFeature";
import type { Bounds, Camera } from "./model";
type MapLabel = {
  key: string;
  lines: string[];
  x: number;
  y: number;
  angle: number;
  box: Bounds;
  priority: number;
};
type Measure = (text: string) => number;
const collide = (a: Bounds, b: Bounds) =>
  a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
function linesFor(
  name: string,
  measure: Measure,
  max: number,
  multiline: boolean,
) {
  const letters = [...name];
  if (measure(name) <= max) return [name];
  let first = "";
  while (letters.length && measure(first + letters[0]) <= max - 12)
    first += letters.shift();
  if (!multiline) return [first + "…"];
  let second = "";
  while (letters.length && measure(second + letters[0]) <= max - 12)
    second += letters.shift();
  return [first, second + (letters.length ? "…" : "")];
}
/** Screen-space decluttering shared by every visible tile. Stable world anchors
 * keep labels still during pan; prior choices win only within their priority. */
export function layoutMapLabels(
  features: MapFeature[],
  camera: Camera,
  policy: LodDecision["policy"],
  width: number,
  height: number,
  selected: string,
  measure: Measure,
  prior = new Set<string>(),
  obstacles: Bounds[] = [],
  regionCandidates: RegionName[] = [],
): { labels: MapLabel[]; regions: RegionName[] } {
  const candidates: MapLabel[] = [];
  const orderedFeatures = features
    .filter((f) => {
      if (!f.name || f.kind === "area") return false;
      const focused = f.id === selected,
        road = f.kind === "road";
      if (!focused && !f.important && !road && !policy.buildingNames)
        return false;
      if (!focused && road && f.width < policy.minRoadLabelWidth) return false;
      if (!focused && !road && f.important && !policy.importantNames)
        return false;
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const ring of f.paths)
        for (const [x, y] of ring) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      // Text is at most 180px wide. Invisible owners neither consume the
      // placement budget nor trigger font measurements on each pan frame.
      return (
        maxX * camera.scale + camera.x >= -200 &&
        minX * camera.scale + camera.x <= width + 200 &&
        maxY * camera.scale + camera.y >= -200 &&
        minY * camera.scale + camera.y <= height + 200
      );
    })
    .sort((a, b) => {
      const priority = (f: MapFeature) =>
        f.id === selected ? 4 : f.important ? 3 : f.kind === "road" ? 2 : 1;
      return (
        priority(b) - priority(a) || b.rank - a.rank || a.id.localeCompare(b.id)
      );
    });
  // Count feature owners and regions together before creating placement options.
  const owners = [
    ...orderedFeatures.map((feature) => ({
      feature,
      priority:
        feature.id === selected
          ? 4
          : feature.important
            ? 3
            : feature.kind === "road"
              ? 2
              : 1,
    })),
    ...regionCandidates.map((region) => ({ region, priority: 2.5 })),
  ]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3000);
  const ordered = owners.flatMap((item) =>
    "feature" in item ? [item.feature] : [],
  );
  const eligibleRegions = owners.flatMap((item) =>
    "region" in item ? [item.region] : [],
  );
  for (const f of ordered) {
    const isRoad = f.kind === "road",
      focused = f.id === selected;
    const lines = linesFor(f.name, measure, isRoad ? 180 : 160, !isRoad);
    const textWidth = Math.max(...lines.map(measure));
    const textHeight = lines.length * 16;
    const priority = focused ? 4 : f.important ? 3 : isRoad ? 2 : 1;
    const add = (key: string, x: number, y: number, angle: number) => {
      const w =
        Math.abs(Math.cos(angle)) * textWidth +
        Math.abs(Math.sin(angle)) * textHeight +
        10;
      const h =
        Math.abs(Math.sin(angle)) * textWidth +
        Math.abs(Math.cos(angle)) * textHeight +
        8;
      const box: Bounds = [x - w / 2, y - h / 2, x + w / 2, y + h / 2];
      if (box[0] < 4 || box[1] < 4 || box[2] > width - 4 || box[3] > height - 4)
        return;
      candidates.push({ key, lines, x, y, angle, box, priority });
    };
    if (isRoad) {
      const path = f.paths[0] ?? [];
      const lengths = [0];
      for (let i = 1; i < path.length; i++)
        lengths.push(
          lengths[i - 1] +
            Math.hypot(
              path[i][0] - path[i - 1][0],
              path[i][1] - path[i - 1][1],
            ) *
              camera.scale,
        );
      const total = lengths.at(-1) ?? 0;
      const at = (distance: number): [number, number] => {
        let lo = 0,
          hi = lengths.length - 1;
        while (lo + 1 < hi) {
          const mid = (lo + hi) >> 1;
          if (lengths[mid] < distance) lo = mid;
          else hi = mid;
        }
        const t =
          (distance - lengths[lo]) /
          Math.max(0.00001, lengths[hi] - lengths[lo]);
        return [
          camera.x +
            (path[lo][0] + t * (path[hi][0] - path[lo][0])) * camera.scale,
          camera.y +
            (path[lo][1] + t * (path[hi][1] - path[lo][1])) * camera.scale,
        ];
      };
      const anchors = new Set<number>();
      if (total >= textWidth + 24 && total < 400) anchors.add(total / 2);
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1],
          b = path[i];
        if (
          Math.max(a[0], b[0]) * camera.scale + camera.x < -200 ||
          Math.min(a[0], b[0]) * camera.scale + camera.x > width + 200 ||
          Math.max(a[1], b[1]) * camera.scale + camera.y < -200 ||
          Math.min(a[1], b[1]) * camera.scale + camera.y > height + 200
        )
          continue;
        // Restrict long crossing segments to their visible parametric interval.
        let low = 0,
          high = 1;
        for (const [v, d, min, max] of [
          [
            camera.x + a[0] * camera.scale,
            (b[0] - a[0]) * camera.scale,
            -200,
            width + 200,
          ],
          [
            camera.y + a[1] * camera.scale,
            (b[1] - a[1]) * camera.scale,
            -200,
            height + 200,
          ],
        ]) {
          if (d !== 0) {
            const u = (min - v) / d,
              w = (max - v) / d;
            low = Math.max(low, Math.min(u, w));
            high = Math.min(high, Math.max(u, w));
          }
        }
        const start = lengths[i - 1] + low * (lengths[i] - lengths[i - 1]),
          end = lengths[i - 1] + high * (lengths[i] - lengths[i - 1]);
        for (let n = Math.ceil((start - 200) / 400); 200 + n * 400 <= end; n++)
          anchors.add(200 + n * 400);
      }
      for (const distance of anchors) {
        if (
          distance < textWidth / 2 + 12 ||
          distance > total - textWidth / 2 - 12
        )
          continue;
        const a = at(distance - textWidth / 2),
          b = at(distance + textWidth / 2),
          center = at(distance);
        // Reject a sharp turn or U-bend under the text instead of warping glyphs.
        if (
          Math.hypot(b[0] - a[0], b[1] - a[1]) < textWidth * 0.95 ||
          Math.hypot(
            center[0] - (a[0] + b[0]) / 2,
            center[1] - (a[1] + b[1]) / 2,
          ) > 4
        )
          continue;
        let angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
        if (angle > Math.PI / 2) angle -= Math.PI;
        if (angle < -Math.PI / 2) angle += Math.PI;
        add(`${f.id}/${distance}`, center[0], center[1], angle);
      }
    } else {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const ring of f.paths)
        for (const p of ring) {
          minX = Math.min(minX, p[0]);
          maxX = Math.max(maxX, p[0]);
          minY = Math.min(minY, p[1]);
          maxY = Math.max(maxY, p[1]);
        }
      if (!Number.isFinite(minX)) continue;
      if (
        !focused &&
        !f.important &&
        Math.max(maxX - minX, maxY - minY) * camera.scale < 18
      )
        continue;
      const x = camera.x + ((minX + maxX) / 2) * camera.scale,
        y = camera.y + ((minY + maxY) / 2) * camera.scale;
      add(`${f.id}/center`, x, y, 0);
      add(
        `${f.id}/below`,
        x,
        camera.y + maxY * camera.scale + textHeight / 2 + 6,
        0,
      );
    }
  }
  candidates.sort(
    (a, b) =>
      b.priority - a.priority ||
      Number(prior.has(b.key)) - Number(prior.has(a.key)),
  );
  const grid = new Map<string, Bounds[]>(),
    accepted: MapLabel[] = [],
    acceptedRegions: RegionName[] = [],
    acceptedOwners = new Map<string, [number, number][]>();
  const keys = (b: Bounds) => {
    const result: string[] = [];
    for (let x = Math.floor(b[0] / 64); x <= Math.floor(b[2] / 64); x++)
      for (let y = Math.floor(b[1] / 64); y <= Math.floor(b[3] / 64); y++)
        result.push(`${x}/${y}`);
    return result;
  };
  for (const box of obstacles)
    for (const key of keys(box)) grid.set(key, [...(grid.get(key) ?? []), box]);
  const placements = [
    ...candidates.map((label) => ({ label, priority: label.priority })),
    ...eligibleRegions.map((region) => ({ region, priority: 2.5 })),
  ].sort((a, b) => b.priority - a.priority);
  for (const placement of placements) {
    if ("region" in placement) {
      const region = placement.region;
      const cells = keys(region.box);
      if (
        cells.some((key) =>
          (grid.get(key) ?? []).some((box) => collide(region.box, box)),
        )
      )
        continue;
      acceptedRegions.push(region);
      for (const key of cells)
        grid.set(key, [...(grid.get(key) ?? []), region.box]);
      if (accepted.length + acceptedRegions.length >= 500) break;
      continue;
    }
    const label = placement.label;
    const owner = label.key.slice(0, label.key.lastIndexOf("/"));
    if (
      (acceptedOwners.get(owner) ?? []).some(
        (p) => Math.hypot(p[0] - label.x, p[1] - label.y) < 400,
      )
    )
      continue;
    const cells = keys(label.box);
    if (
      cells.some((key) =>
        (grid.get(key) ?? []).some((box) => collide(label.box, box)),
      )
    )
      continue;
    accepted.push(label);
    acceptedOwners.set(owner, [
      ...(acceptedOwners.get(owner) ?? []),
      [label.x, label.y],
    ]);
    for (const key of cells)
      grid.set(key, [...(grid.get(key) ?? []), label.box]);
    if (accepted.length + acceptedRegions.length >= 500) break;
  }
  return { labels: accepted, regions: acceptedRegions };
}
export function layoutLabels(
  ...args: Parameters<typeof layoutMapLabels>
): MapLabel[] {
  return layoutMapLabels(...args).labels;
}
export function paintLabels(c: CanvasRenderingContext2D, labels: MapLabel[]) {
  c.save();
  c.font = "13px system-ui, sans-serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.lineJoin = "round";
  c.lineWidth = 3.5;
  c.strokeStyle = "#f7f1df";
  c.fillStyle = "#343b32";
  for (const label of labels) {
    c.save();
    c.translate(label.x, label.y);
    c.rotate(label.angle);
    label.lines.forEach((line, i) => {
      const y = (i - (label.lines.length - 1) / 2) * 16;
      c.strokeText(line, 0, y);
      c.fillText(line, 0, y);
    });
    c.restore();
  }
  c.restore();
}
