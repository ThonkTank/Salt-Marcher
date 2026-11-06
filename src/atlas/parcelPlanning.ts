import {
  bezier,
  distance,
  type Parcel,
  type Road,
  type MapObject,
  type PopulationSettings,
  type WorldPoint,
  type Intent,
} from "./model";
import type { PlannedParcel } from "./generated/PlannedParcel";
export type ParcelHandle = "start" | "end" | "setback" | "depth";
export type BoundSource = Extract<Parcel["source"], { kind: "road" }>;
const sectionIds = (road: Road) => [...new Set(road.edgeSections)];
function sectionPath(road: Road, sectionId: string): WorldPoint[] {
  const points: WorldPoint[] = [];
  for (let i = 0; i < road.edgeSections.length; i++)
    if (road.edgeSections[i] === sectionId) {
      const a = road.nodes[i],
        b = road.nodes[i + 1];
      for (let j = points.length ? 1 : 0; j <= 64; j++)
        points.push(
          bezier(
            a.point,
            a.outgoing ?? a.point,
            b.incoming ?? b.point,
            b.point,
            j / 64,
          ),
        );
    }
  return points;
}
function arc(path: WorldPoint[]) {
  const lengths = [0];
  for (let i = 1; i < path.length; i++)
    lengths.push(lengths[i - 1] + distance(path[i - 1], path[i]));
  return lengths;
}
function sampleSection(road: Road, source: BoundSource, t: number) {
  const path = sectionPath(road, source.sectionId),
    lengths = arc(path),
    total = lengths.at(-1) ?? 0;
  const target = Math.max(0, Math.min(1, t)) * total;
  let i = 1;
  while (i < path.length - 1 && lengths[i] < target) i++;
  const a = path[i - 1] ?? [0, 0],
    b = path[i] ?? a,
    len = distance(a, b) || 1;
  const f = (target - (lengths[i - 1] ?? 0)) / len;
  const point: WorldPoint = [
    a[0] + (b[0] - a[0]) * f,
    a[1] + (b[1] - a[1]) * f,
  ];
  const sign = source.side === "left" ? -1 : 1;
  const normal: WorldPoint = [
    (-(b[1] - a[1]) / len) * sign,
    ((b[0] - a[0]) / len) * sign,
  ];
  return { point, normal };
}
export function parcelHandles(
  parcel: Parcel,
  road: Road,
): { kind: ParcelHandle; point: WorldPoint }[] {
  if (parcel.source.kind !== "road") return [];
  const s = parcel.source;
  return (["start", "end", "setback", "depth"] as const).map((kind) => {
    const t =
      kind === "start"
        ? s.start
        : kind === "end"
          ? s.end
          : (s.start + s.end) / 2;
    const { point, normal } = sampleSection(road, s, t);
    const offset =
      road.width / 2 +
      s.setback +
      (kind === "depth"
        ? s.depth
        : kind === "start" || kind === "end"
          ? s.depth / 2
          : 0);
    return {
      kind,
      point: [point[0] + normal[0] * offset, point[1] + normal[1] * offset],
    };
  });
}
export function resizeParcel(
  parcel: Parcel,
  road: Road,
  handle: ParcelHandle,
  point: WorldPoint,
): BoundSource {
  if (parcel.source.kind !== "road") throw Error("Freie Parzelle");
  const source = { ...parcel.source };
  if (handle === "start" || handle === "end") {
    const path = sectionPath(road, source.sectionId),
      lengths = arc(path),
      total = lengths.at(-1) ?? 1;
    let best = Infinity,
      at = 0;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1],
        b = path[i],
        dx = b[0] - a[0],
        dy = b[1] - a[1],
        square = dx * dx + dy * dy;
      const t = square
        ? Math.max(
            0,
            Math.min(
              1,
              ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / square,
            ),
          )
        : 0;
      const d = distance(point, [a[0] + dx * t, a[1] + dy * t]);
      if (d < best) {
        best = d;
        at = (lengths[i - 1] + Math.sqrt(square) * t) / total;
      }
    }
    source[handle] =
      handle === "start"
        ? Math.min(source.end - 1e-5, Math.max(0, at))
        : Math.max(source.start + 1e-5, Math.min(1, at));
  } else {
    const { point: center, normal } = sampleSection(
      road,
      source,
      (source.start + source.end) / 2,
    );
    const offset =
      (point[0] - center[0]) * normal[0] +
      (point[1] - center[1]) * normal[1] -
      road.width / 2;
    if (handle === "setback")
      source.setback = Math.max(0, Math.min(1000, offset));
    else source.depth = Math.max(5, Math.min(2000, offset - source.setback));
  }
  return source;
}
export function parcelIntent(
  parcel: Parcel,
  source: BoundSource,
): Extract<Intent, { type: "updateParcel" }> {
  return {
    type: "updateParcel",
    id: parcel.id,
    start: source.start,
    end: source.end,
    setback: source.setback,
    depth: source.depth,
  };
}
export function freezeLayout(
  objects: MapObject[],
  road: Road,
  settings: PopulationSettings,
): PlannedParcel[] {
  if (settings.layout) return structuredClone(settings.layout);
  const sections = sectionIds(road);
  return objects
    .filter(
      (o): o is Parcel =>
        o.kind === "parcel" &&
        o.source.kind === "road" &&
        o.source.roadId === road.id,
    )
    .map((p, index) => {
      const s = p.source as BoundSource;
      const house = objects.find(
        (o) =>
          o.kind === "house" &&
          o.placement.kind === "parcel" &&
          o.placement.parcelId === p.id,
      );
      const points =
        house?.kind === "house" ? house.occupancyContours.flat() : [];
      const width = points.length
        ? Math.round(
            Math.max(...points.map((p) => p[0])) -
              Math.min(...points.map((p) => p[0])),
          )
        : settings.maxWidth;
      const depth = points.length
        ? Math.round(
            Math.max(...points.map((p) => p[1])) -
              Math.min(...points.map((p) => p[1])),
          )
        : settings.maxDepth;
      return {
        key: `parcel-${index}`,
        section: sections.indexOf(s.sectionId),
        side: s.side,
        start: s.start,
        end: s.end,
        setback: s.setback,
        depth: s.depth,
        width,
        houseDepth: depth,
        roofIndex:
          house?.kind === "house"
            ? Math.max(
                0,
                ["#9a705a", "#80756b", "#ad8765", "#6f7775"].indexOf(
                  house.roof,
                ),
              )
            : 0,
        excluded: false,
      };
    });
}
export function plannedForParcel(
  layout: PlannedParcel[],
  parcel: Parcel,
  road: Road,
) {
  if (parcel.source.kind !== "road") return undefined;
  const s = parcel.source,
    section = sectionIds(road).indexOf(s.sectionId);
  return layout.find(
    (p) =>
      p.section === section &&
      p.side === s.side &&
      Math.abs(p.start - s.start) < 1e-8 &&
      Math.abs(p.end - s.end) < 1e-8,
  );
}
