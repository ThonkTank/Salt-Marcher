import type { Detail } from "./model";
import { AGGREGATE_CELL_BUDGET } from "./detailAggregate";

type GeometryIdentity = {
  session: string;
  building: string;
  floor: number;
  includeLower: boolean;
  bounds: string;
  cells: WeakRef<Detail["cells"]>;
  lower: WeakRef<Detail["lower"]>;
};
function geometryMatches(g: GeometryIdentity, d: Detail) {
  return (
    g.session === d.status.sessionId &&
    g.building === d.buildingId &&
    g.floor === d.floor &&
    g.includeLower === d.includeLower &&
    g.bounds === JSON.stringify(d.bounds) &&
    g.cells.deref() === d.cells &&
    g.lower.deref() === d.lower
  );
}
// Paths cannot retain aggregate arrays or tile records after eviction.
export class InteriorGeometryCache<T> {
  private entries: Array<{
    identity: GeometryIdentity;
    geometry: T;
    count: number;
  }> = [];
  constructor(private readonly build: (detail: Detail) => T) {}
  clear() {
    this.entries = [];
  }
  get(detail: Detail): T {
    const first = this.entries[0]?.identity;
    if (
      first &&
      (first.session !== detail.status.sessionId ||
        first.building !== detail.buildingId ||
        first.floor !== detail.floor ||
        first.includeLower !== detail.includeLower)
    ) {
      this.clear();
    }
    const index = this.entries.findIndex((e) =>
      geometryMatches(e.identity, detail),
    );
    if (index >= 0) {
      const [entry] = this.entries.splice(index, 1);
      this.entries.unshift(entry);
      return entry.geometry;
    }
    const count = detail.cells.length + detail.lower.length;
    const entry = {
      identity: {
        session: detail.status.sessionId,
        building: detail.buildingId,
        floor: detail.floor,
        includeLower: detail.includeLower,
        bounds: JSON.stringify(detail.bounds),
        cells: new WeakRef(detail.cells),
        lower: new WeakRef(detail.lower),
      },
      geometry: this.build(detail),
      count,
    };
    const previous = this.entries[0];
    this.entries =
      previous && previous.count + count <= AGGREGATE_CELL_BUDGET
        ? [entry, previous]
        : [entry];
    return entry.geometry;
  }
}
