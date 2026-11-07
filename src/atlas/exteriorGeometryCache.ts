import { CACHE_BUDGETS } from "./cacheBudgets";
import { toWorld, type MapObject, type WorldPoint } from "./model";

export type ExteriorShape = Exclude<MapObject, { kind: "scenery" }>;
type Budget = { bytes: number; entries: number };

/** Retention cost is an estimate, not a measurement of native Path2D memory. */
export class ExteriorGeometryCache {
  private readonly paths = new Map<
    ExteriorShape,
    { path: Path2D; cost: number }
  >();
  private cost = 0;
  private session: string | null = null;
  constructor(
    private readonly budget: Budget = CACHE_BUDGETS.exteriorGeometry,
  ) {}
  setSession(session: string | null) {
    if (session !== this.session) {
      this.paths.clear();
      this.cost = 0;
      this.session = session;
    }
  }
  /** Base and overlay share one working set; overflow must not evict its peers. */
  retain(objects: Iterable<MapObject>) {
    if (!this.paths.size) return;
    const obsolete = new Set(this.paths.keys());
    for (const object of objects) {
      if (object.kind !== "scenery") obsolete.delete(object);
      if (!obsolete.size) return;
    }
    for (const object of obsolete) {
      this.cost -= this.paths.get(object)!.cost;
      this.paths.delete(object);
    }
  }
  get(object: ExteriorShape): Path2D | null {
    const cached = this.paths.get(object);
    if (cached) return cached.path;
    const finite = (p: readonly number[]) =>
      p.length === 2 && p.every(Number.isFinite);
    let rings: WorldPoint[][];
    if (object.kind === "road") {
      if (!Number.isFinite(object.width) || !object.path.every(finite))
        return null;
      rings = [object.path];
    } else if (object.kind === "area") {
      if (!object.points.every(finite)) return null;
      rings = [object.points];
    } else if (object.kind === "parcel") {
      if (!object.polygon.every(finite)) return null;
      rings = [object.polygon];
    } else {
      if (
        ![object.transform.x, object.transform.y, object.transform.angle].every(
          Number.isFinite,
        ) ||
        !object.contours.every((ring) => ring.every(finite))
      )
        return null;
      rings = object.contours.map((ring) =>
        ring.map((point) => toWorld(point, object.transform)),
      );
      if (!rings.every((ring) => ring.every(finite))) return null;
    }
    const path = new Path2D();
    let count = 0;
    for (const ring of rings) {
      count += ring.length;
      ring.forEach((point, i) =>
        i ? path.lineTo(point[0], point[1]) : path.moveTo(point[0], point[1]),
      );
      if (object.kind !== "road") path.closePath();
    }
    const cost = 256 + 32 * count;
    if (
      this.cost + cost <= this.budget.bytes &&
      this.paths.size < this.budget.entries
    ) {
      this.paths.set(object, { path, cost });
      this.cost += cost;
    }
    return path;
  }
}
