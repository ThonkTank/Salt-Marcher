import type { LandscapeRecord } from "./atlas-landscape";
/** Display widths are screen based; canonical dimensions and hit tests stay exact. */
export function mapLineVisible(
  kind: "road" | "river",
  width: number,
  mpp: number,
  minor = false,
) {
  return (
    mpp <= 0 || width / mpp >= (minor ? 0.4 : kind === "river" ? 0.12 : 0.18)
  );
}
export function mapLineWidth(width: number, mpp: number) {
  return mpp <= 0 ? width : Math.max(width, mpp * 1.4);
}
export function mapRecordVisible(r: LandscapeRecord, mpp: number) {
  return r.kind === "road" || r.kind === "river"
    ? mapLineVisible(
        r.kind,
        r.width,
        mpp,
        r.style === "path" || r.style === "stream",
      )
    : r.kind !== "place" || mpp <= 1000;
}
export function mapFootprintVisible(
  points: readonly { x: number; y: number }[],
  mpp: number,
) {
  if (mpp <= 0) return true;
  let x = Infinity,
    y = Infinity,
    xx = -Infinity,
    yy = -Infinity;
  for (const p of points) {
    x = Math.min(x, p.x);
    y = Math.min(y, p.y);
    xx = Math.max(xx, p.x);
    yy = Math.max(yy, p.y);
  }
  return Math.max(xx - x, yy - y) / mpp >= 2;
}
